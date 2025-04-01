import axios from 'axios';

class ConfigService {
    constructor() {
        this.configs = new Map(); // Store configs for different phone numbers
        this.apiBaseUrl = process.env.CONFIG_API_BASE_URL;
    }

    async loadConfig(phoneNumberSid) {
        try {
            // Check if config is already loaded and not expired (5 minutes)
            const existingConfig = this.configs.get(phoneNumberSid);
            if (existingConfig && Date.now() - existingConfig.timestamp < 5 * 60 * 1000) {
                return existingConfig.data;
            }

            // Load new config from API
            const response = await axios.get(`${this.apiBaseUrl}/businesses/${phoneNumberSid}`);
            const config = response.data;

            // Store config with timestamp
            this.configs.set(phoneNumberSid, {
                data: config,
                timestamp: Date.now()
            });

            // Set up cleanup for old configs
            this.cleanupOldConfigs();

            return config;
        } catch (error) {
            console.error('Error loading business configuration:', error);
            throw error;
        }
    }

    cleanupOldConfigs() {
        const now = Date.now();
        for (const [phoneNumberSid, config] of this.configs.entries()) {
            if (now - config.timestamp > 5 * 60 * 1000) {
                this.configs.delete(phoneNumberSid);
            }
        }
    }

    getConfig(phoneNumberSid) {
        const config = this.configs.get(phoneNumberSid);
        return config?.data;
    }

    // Basic business info
    getBusinessName(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.businessInfo?.name;
    }

    getBusinessAddress(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.businessInfo?.address;
    }

    getBusinessPhone(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.businessInfo?.phone;
    }

    getBusinessHours(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.businessInfo?.hours;
    }

    // Services and pricing
    getServices(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.services || [];
    }

    getPricing(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.pricing || {};
    }

    getServicePrice(phoneNumberSid, serviceName) {
        return this.getConfig(phoneNumberSid)?.pricing?.[serviceName];
    }

    // Staff information
    getStaffMembers(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.staff || [];
    }

    getAvailableStaff(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.staff?.filter(staff => staff.isAvailable) || [];
    }

    // Business-specific prompts
    getWelcomePrompt(phoneNumberSid, language = 'en') {
        return this.getConfig(phoneNumberSid)?.prompts?.[language]?.welcome;
    }

    getSystemPrompt(phoneNumberSid, language = 'en') {
        return this.getConfig(phoneNumberSid)?.prompts?.[language]?.system;
    }

    getGoodbyePrompt(phoneNumberSid, language = 'en') {
        return this.getConfig(phoneNumberSid)?.prompts?.[language]?.goodbye;
    }

    // Transfer settings
    getTransferPhoneNumber(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.transferSettings?.phoneNumber;
    }

    // Appointment settings
    getAppointmentSettings(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.appointmentSettings || {};
    }

    // Language settings
    getSupportedLanguages(phoneNumberSid) {
        return this.getConfig(phoneNumberSid)?.supportedLanguages || ['en'];
    }
}

// Create a singleton instance
const configService = new ConfigService();

export default configService; 