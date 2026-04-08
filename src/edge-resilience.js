class EdgeResilience {
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension, settings, logger) {
        this.zigbee = zigbee;
        this.state = state;
        this.eventBus = eventBus;
        this.logger = logger;
        this.lastBrightness = {}; 
        this.isInitializing = {}; 
        this.syncMap = {
            'Landing Slave': 'Landing Lights',
            'Lounge Slave': 'Lounge Lights'
        };
    }

    async start() {
        this.logger.info('EdgeResilience: Gold Master V4 (Ghost-Proof) Active');

        this.eventBus.onStateChange(this, async (data) => {
            if (!data || !data.entity || !data.update) return;

            const sourceName = data.entity.name;
            const targetName = this.syncMap[sourceName];

            if (targetName) {
                try {
                    const targetEntity = this.zigbee.resolveEntity(targetName);
                    const sourceEntity = this.zigbee.resolveEntity(sourceName);
                    if (!targetEntity || !sourceEntity) return;

                    // 1. POWER STATE & INHERITANCE
                    if (data.update.hasOwnProperty('state')) {
                        const stateStr = String(data.update.state).toLowerCase();
                        
                        // Sync physical relay
                        await targetEntity.endpoint(1).command('genOnOff', stateStr, {}, {});

                        if (stateStr === 'on') {
                            this.isInitializing[sourceName] = true;
                            
                            const targetStore = this.state.get(targetEntity);
                            const masterBrightness = (targetStore && targetStore.brightness) ? targetStore.brightness : 254;
                            
                            this.logger.info(`EdgeResilience: [${sourceName}] Inheriting ${masterBrightness} from ${targetName}`);
                            
                            await sourceEntity.endpoint(1).command('genLevelCtrl', 'moveToLevel', {level: masterBrightness, transtime: 0}, {});
                            this.lastBrightness[sourceName] = masterBrightness;

                            setTimeout(() => { this.isInitializing[sourceName] = false; }, 1000);
                        }
                    }

                    // 2. ROTARY BRIGHTNESS SYNC
                    if (data.update.hasOwnProperty('brightness')) {
                        if (this.isInitializing[sourceName]) return;

                        let val = Number(data.update.brightness);
                        if (isNaN(val)) return;

                        const prevVal = this.lastBrightness[sourceName] || val;
                        const delta = Math.abs(val - prevVal);

                      // GHOST PROTECTION: Block no-neutral "Reboot to 128" glitches
                        if (val === 128 && delta > 10 && prevVal !== 128) {
                            this.logger.info(`EdgeResilience: Ghost Reset detected on ${sourceName}. Ignoring and maintaining internal state at ${prevVal}.`);
                            
                            // CRITICAL: We do NOT send a command back to the slave here. 
                            // We just update our memory so the Master doesn't move.
                            this.lastBrightness[sourceName] = prevVal; 
                            return;
                        }

                        // WRAP-AROUND SHIELD: Block physical encoder jumps
                        if (delta > 60) {
                            this.logger.info(`EdgeResilience: Shielded jump on ${sourceName} (${prevVal} -> ${val})`);
                            this.lastBrightness[sourceName] = val;
                            return;
                        }

                        this.lastBrightness[sourceName] = val;

                        // Clamping & Landing Limit
                        if (val > 254) val = 254;
                        if (val < 1) val = 1;
                        if (sourceName === 'Landing Slave' && val > 230) val = 230;

                        await targetEntity.endpoint(1).command('genLevelCtrl', 'moveToLevel', {level: val, transtime: 0}, {});
                        this.logger.info(`EdgeResilience: [${targetName}] Level -> ${val}`);
                    }

                } catch (error) {
                    this.logger.error(`EdgeResilience Error: ${error.message}`);
                }
            }
        });
    }

    async stop() {
        this.eventBus.removeListeners(this);
    }
}

module.exports = EdgeResilience;
