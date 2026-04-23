const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class BacklightNightlyExtension {
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension, settings, logger) {
        this.zigbee = zigbee;
        this.eventBus = eventBus;
        this.logger = logger;
        
        // Path to your existing config file
        this.configPath = path.join(__dirname, '..', 'backlight_nightly.yaml');
        this.config = { monitored_lights: [], night_start: 22, night_end: 8 };
        
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileContents = fs.readFileSync(this.configPath, 'utf8');
                const fullConfig = yaml.load(fileContents);
                if (fullConfig && fullConfig.backlight_control) {
                    this.config = fullConfig.backlight_control;
                    this.logger.info(`[BacklightNightly] Config loaded. Monitoring: ${this.config.monitored_lights.join(', ')}`);
                }
            }
        } catch (e) {
            this.logger.info(`[BacklightNightly] Config Error: ${e.message}. Using defaults.`);
        }
    }

    async start() {
        this.eventBus.onStateChange(this, async (data) => {
            if (!data || !data.entity || !this.config.monitored_lights.includes(data.entity.name)) return;

            try {
                const entity = this.zigbee.resolveEntity(data.entity.name);
                const newState = (data.update && data.update.state) ? data.update.state.toUpperCase() : null;
                
                const currentHour = new Date().getHours();
                const isNightTime = currentHour >= this.config.night_start || currentHour < this.config.night_end;

                if (newState === 'OFF') {
                    const backlightState = isNightTime ? 0 : 1;
                    this.logger.info(`[BacklightNightly] ${data.entity.name} OFF. ${isNightTime ? 'Night' : 'Day'} mode: Backlight -> ${backlightState}`);
                    
                    await entity.endpoint(1).write('manuSpecificAurora', {backlight_led: backlightState}, {manufacturerCode: 0x1234});
                } else if (newState === 'ON') {
                    // Always ensure backlight is ON when the light is physically in use
                    await entity.endpoint(1).write('manuSpecificAurora', {backlight_led: 1}, {manufacturerCode: 0x1234});
                }
            } catch (e) {
                this.logger.info(`[BacklightNightly] ${data.entity.name} Error: ${e.message}`);
            }
        });
    }

    async stop() {
        this.eventBus.removeListeners(this);
        this.logger.info('[BacklightNightly] Extension Stopped');
    }
}

module.exports = BacklightNightlyExtension;
