const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class EdgeResilience {
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension, settings, logger) {
        this.zigbee = zigbee;
        this.state = state;
        this.eventBus = eventBus;
        this.logger = logger;
        this.lastBrightness = {}; 
        this.isInitializing = {}; 
        this.syncMap = {};
        this.limits = {};

        this.loadConfig();
    }

loadConfig() {
        try {
            // We jump up one level from 'external_extensions' to 'data'
            const configPath = path.join(__dirname, '..', 'edge-resilience.yaml');
            
            this.logger.info(`EdgeResilience: Looking for config in Z2M data root: ${configPath}`);

            if (fs.existsSync(configPath)) {
                const fileContent = fs.readFileSync(configPath, 'utf8');
                const doc = yaml.load(fileContent);
                
                if (doc && doc.mappings) {
                    this.syncMap = {}; 
                    this.limits = {};
                    
                    doc.mappings.forEach(map => {
                        this.syncMap[map.slave] = map.master;
                        if (map.max_brightness) {
                            this.limits[map.slave] = map.max_brightness;
                        }
                    });
                    this.logger.info(`EdgeResilience: Successfully loaded ${doc.mappings.length} mappings from data root.`);
                }
            } else {
                this.logger.error(`EdgeResilience: edge-resilience.yaml NOT found at ${configPath}`);
            }
        } catch (e) {
            this.logger.error(`EdgeResilience: YAML Parse Error: ${e.message}`);
        }
    }

    async start() {
        this.logger.info('EdgeResilience: Gold Master V5 (Config-Driven) Active');

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

<<<<<<< develop
                        // GHOST PROTECTION: Block no-neutral "Reboot to 128" glitches
                        if (val === 128 && delta > 10 && prevVal !== 128) {
                            // CRITICAL: We do NOT send a command back to the slave here. 
                            // We just update our memory so the Master doesn't move.
=======
                        // GHOST PROTECTION
                        if (val === 128 && delta > 10 && prevVal !== 128) {
>>>>>>> main
                            this.logger.info(`EdgeResilience: Ghost detected on ${sourceName}. Maintaining ${prevVal}.`);
                            this.lastBrightness[sourceName] = prevVal; 
                            return;
                        }

                        // WRAP-AROUND SHIELD
                        if (delta > 60) {
                            this.logger.info(`EdgeResilience: Shielded jump on ${sourceName} (${prevVal} -> ${val})`);
                            this.lastBrightness[sourceName] = val;
                            return;
                        }

                        this.lastBrightness[sourceName] = val;

                        // Dynamic Clamping
                        const maxB = this.limits[sourceName] || 254;
                        if (val > maxB) val = maxB;
                        if (val < 1) val = 1;

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
