import { BaseBusinessService } from './BaseBusinessService.js';
import configService from '../config/ConfigService.js';
import { AppointmentService } from '../appointmentService.js';

export class NailSalonService extends BaseBusinessService {
    constructor() {
        super();
        this.appointmentService = new AppointmentService();
    }

    async handleIntent(intent, userMessage, phoneNumber, customerInfo, language = 'en', phoneNumberSid) {
        await configService.loadConfig(phoneNumberSid);
        
        switch (intent) {
            case 'Book_Appointment':
                const bookingResult = await this.appointmentService.bookAppointment(
                    userMessage,
                    phoneNumber,
                    customerInfo,
                    configService.getAppointmentSettings(phoneNumberSid)
                );
                return {
                    response: bookingResult.message,
                    shouldTransfer: bookingResult.needsTransfer
                };

            case 'Check_Services':
                const services = configService.getServices(phoneNumberSid);
                const servicesResponse = this.formatServicesResponse(services, language, phoneNumberSid);
                return {
                    response: servicesResponse,
                    shouldTransfer: false
                };

            case 'Check_Prices':
                const pricing = configService.getPricing(phoneNumberSid);
                const pricesResponse = this.formatPricingResponse(pricing, language);
                return {
                    response: pricesResponse,
                    shouldTransfer: false
                };

            case 'Check_Hours':
                const hours = configService.getBusinessHours(phoneNumberSid);
                const hoursResponse = this.formatHoursResponse(hours, language, phoneNumberSid);
                return {
                    response: hoursResponse,
                    shouldTransfer: false
                };

            case 'Check_Staff':
                const availableStaff = configService.getAvailableStaff(phoneNumberSid);
                const staffResponse = this.formatStaffResponse(availableStaff, language);
                return {
                    response: staffResponse,
                    shouldTransfer: false
                };

            case 'Transfer_To_Human':
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
        const welcomePrompt = configService.getWelcomePrompt(phoneNumberSid, language);
        const businessName = configService.getBusinessName(phoneNumberSid);
        
        if (customerInfo?.name) {
            return welcomePrompt
                .replace('{businessName}', businessName)
                .replace('{customerName}', customerInfo.name);
        }
        
        return welcomePrompt.replace('{businessName}', businessName);
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
} 