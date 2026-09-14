import { BaseBusinessService } from './BaseBusinessService.js';
import configService from '../config/ConfigService.js';

export class NailSalonService extends BaseBusinessService {
    constructor(languageService, customerService, appointmentService) {
        super(languageService, customerService);
        this.appointmentService = appointmentService;
    }

    async handleIntent(intent, userMessage, phoneNumber, customerInfo, language = 'en', phoneNumberSid) {
        await configService.loadConfig(phoneNumberSid);
        
        // Case labels must match the enum in llm/intentFunctions.js
        switch (intent) {
            case 'Book_Appointment':
            case 'Reschedule_Appointment':
            case 'Cancel_Appointment': {
                const { message, needsTransfer } = await this.appointmentService.handleAppointmentRequest(
                    intent,
                    userMessage,
                    phoneNumber,
                    configService.getAppointmentSettings(phoneNumberSid)
                );
                return {
                    // On transfer the caller is forwarded, not spoken to, so skip the translate round-trip
                    response: needsTransfer ? message : await this.translateResponse(message, language),
                    shouldTransfer: needsTransfer
                };
            }

            case 'Ask_About_Services':
                const services = configService.getServices(phoneNumberSid);
                const servicesResponse = this.formatServicesResponse(services, language, phoneNumberSid);
                return {
                    response: servicesResponse,
                    shouldTransfer: false
                };

            case 'Ask_About_Pricing':
                const pricing = configService.getPricing(phoneNumberSid);
                const pricesResponse = this.formatPricingResponse(pricing, language);
                return {
                    response: pricesResponse,
                    shouldTransfer: false
                };

            case 'Ask_for_Business_Hours':
                const hours = configService.getBusinessHours(phoneNumberSid);
                const hoursResponse = this.formatHoursResponse(hours, language, phoneNumberSid);
                return {
                    response: hoursResponse,
                    shouldTransfer: false
                };

            case 'Specific_Nail_Technician_Request':
                const availableStaff = configService.getAvailableStaff(phoneNumberSid);
                const staffResponse = this.formatStaffResponse(availableStaff, language);
                return {
                    response: staffResponse,
                    shouldTransfer: false
                };

            case 'Speak_to_a_Human':
                return {
                    response: await this.getTransferMessage(language, phoneNumberSid),
                    shouldTransfer: true
                };

            default:
                return {
                    response: null,
                    shouldTransfer: false
                };
        }
    }

    async getWelcomeMessage(customerInfo, language = 'en', phoneNumberSid) {
        await configService.loadConfig(phoneNumberSid);
        const welcomePrompt = configService.getWelcomePrompt(phoneNumberSid, language) || 'Welcome to our salon. How can I help you today?';
        const businessName = configService.getBusinessName(phoneNumberSid) || 'our salon';
        
        let message = welcomePrompt;
        
        // Safely replace placeholders
        if (message.includes('{businessName}')) {
            message = message.replace('{businessName}', businessName);
        }
        
        if (customerInfo?.name && message.includes('{customerName}')) {
            message = message.replace('{customerName}', customerInfo.name);
        }
        
        return message;
    }

    async getSystemPrompt(language = 'en', phoneNumberSid) {
        await configService.loadConfig(phoneNumberSid);
        return configService.getSystemPrompt(phoneNumberSid, language)
            .replace('{businessName}', configService.getBusinessName(phoneNumberSid))
            .replace('{businessAddress}', configService.getBusinessAddress(phoneNumberSid));
    }

    async getGoodbyePrompt(language = 'en', phoneNumberSid) {
        await configService.loadConfig(phoneNumberSid);
        return configService.getGoodbyePrompt(phoneNumberSid, language)
            .replace('{businessName}', configService.getBusinessName(phoneNumberSid));
    }

    formatServicesResponse(services, language, phoneNumberSid) {
        const businessName = configService.getBusinessName(phoneNumberSid);
        const intro = language === 'en' 
            ? `Here are our available services at ${businessName}:`
            : `Đây là các dịch vụ hiện có tại ${businessName}:`;
        
        const servicesList = services.map(service => 
            `- ${service.name[language]}: ${service.description[language]}`
        ).join('\n');

        return `${intro}\n\n${servicesList}`;
    }

    formatPricingResponse(pricing, language) {
        const intro = language === 'en'
            ? `Here are our current prices:`
            : `Đây là bảng giá hiện tại của chúng tôi:`;

        const priceList = Object.entries(pricing).map(([service, price]) =>
            `- ${service}: $${price}`
        ).join('\n');

        return `${intro}\n\n${priceList}`;
    }

    formatHoursResponse(hours, language, phoneNumberSid) {
        const businessName = configService.getBusinessName(phoneNumberSid);
        const intro = language === 'en'
            ? `Our business hours at ${businessName} are:`
            : `Giờ làm việc tại ${businessName} là:`;

        const hoursList = Object.entries(hours).map(([day, time]) =>
            `${day}: ${time}`
        ).join('\n');

        return `${intro}\n\n${hoursList}`;
    }

    formatStaffResponse(staff, language) {
        const intro = language === 'en'
            ? `Our available staff members are:`
            : `Các nhân viên hiện có:`;

        const staffList = staff.map(member =>
            `- ${member.name}: ${member.specialties[language]}`
        ).join('\n');

        return `${intro}\n\n${staffList}`;
    }

    async getTransferMessage(language, phoneNumberSid) {
        const transferNumber = configService.getTransferPhoneNumber(phoneNumberSid);
        return language === 'en'
            ? `I'll transfer you to our staff at ${transferNumber} for further assistance.`
            : `Tôi sẽ chuyển bạn đến nhân viên của chúng tôi theo số ${transferNumber} để được hỗ trợ thêm.`;
    }

    getTransferNumber(phoneNumberSid) {
        return configService.getTransferPhoneNumber(phoneNumberSid);
    }
} 