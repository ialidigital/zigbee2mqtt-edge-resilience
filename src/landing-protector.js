class LandingProtector {
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension, settings, logger) {
        this.zigbee = zigbee;
        this.state = state;
        this.eventBus = eventBus;
        this.logger = logger;
        
        this.lastCommandTime = 0;
        this.commandInterval = 1000; // 1Hz Cadence
        
        this.masterName = 'Landing Lights';
        this.slaveName = 'Landing Slave';
        this.brightnessCap = 220;
        this.brightnessFloor = 20;
        this.brightnessMidpoint = 127;

        this.logger.info('[LandingProtector] 1Hz Protection Logic Re-Engaged');
    }

    async start() {
        this.eventBus.onStateChange(this, async (data) => {
            var targetBrightness = 127; // Default to midpoint if brightness is undefined
            
            if (!data || !data.entity || data.entity.name !== this.slaveName) return;

            const now = Date.now();
            if (now - this.lastCommandTime < this.commandInterval) return;

            try {
                const targetEntity = this.zigbee.resolveEntity(this.masterName);
                const sourceEntity = this.zigbee.resolveEntity(this.slaveName);
                if (!targetEntity || !sourceEntity) return;

                const slaveState = this.state.get(sourceEntity);
                const masterState = this.state.get(targetEntity);
                
                const targetPower = (slaveState.state || 'OFF').toLowerCase();

                this.logger.info(`[LandingProtector] masterState.brightness: ${masterState.brightness}, slaveState.brightness: ${slaveState.brightness}`);

                if (slaveState.brightness === undefined || slaveState.brightness === null) 
                {
                    targetBrightness = this.brightnessMidpoint;
                } 
                else 
                {
                    targetBrightness = slaveState.brightness || this.brightnessCap;
                }

                if (targetBrightness > masterState.brightness)
                {                
                    targetBrightness = masterState.brightness;
                }

               this.logger.info(`[LandingProtector] targetBrightness: ${targetBrightness}`);

                // Apply the physical safety cap or floor for the 5x Aurora R6 loop
                if (targetBrightness > this.brightnessCap) targetBrightness = this.brightnessCap;
                if (targetBrightness < this.brightnessFloor) targetBrightness = this.brightnessFloor;

                // Skip if the change is negligible to reduce mesh chatter
                let delta = Math.abs((masterState.brightness || 0) - targetBrightness);
                if (targetPower === (masterState.state || '').toLowerCase() &&  delta < 5) 
                {
                    this.logger.info(`[LandingProtector] Skipping: delta is ${delta}... reducing mesh chatter`);
                    return;
                }

                this.lastCommandTime = now;
                this.logger.info(`[LandingProtector] Syncing: ${targetPower.toUpperCase()} @ ${targetBrightness}`);

                if (targetPower === 'on') {
                    // Smooth 1-second transition to ease the inrush current
                    await targetEntity.endpoint(1).command('genLevelCtrl', 'moveToLevel', {
                        level: targetBrightness, 
                        transtime: 10 
                    }, {});
                    
                    if (masterState.state !== 'ON') {
                        await new Promise(r => setTimeout(r, 200));
                        await targetEntity.endpoint(1).command('genOnOff', 'on', {}, {});
                    }
                } else {
                    await targetEntity.endpoint(1).command('genOnOff', 'off', {}, {});
                }

            } catch (e) {
                this.logger.info(`[LandingProtector] Sync Error: ${e.message}`);
            }
        });
    }

    async stop() {
        this.eventBus.removeListeners(this);
        this.logger.info('[LandingProtector] Stopped');
    }
}

module.exports = LandingProtector;