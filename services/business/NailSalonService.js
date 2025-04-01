import { BaseBusinessService } from './BaseBusinessService.js';
import configService from '../config/ConfigService.js';
import { AppointmentService } from '../appointmentService.js';

const TRANSLATIONS = {
    en: {
        welcome: {
            returning: "Welcome back {title} {nickname}! How can I assist you today?",
            new: "Welcome to our nail salon! I'm here to help you. Could you please tell me your name?"
        },
        system: "You are a helpful AI Customer Service representative for a nail salon. Keep your responses concise and natural. You can help with appointments, services, pricing, and general inquiries.",
        goodbye: "You are a helpful AI Customer Service representative for a nail salon. The user wants to end the conversation. Keep your goodbye message friendly and professional.",
        services: "We offer a wide range of services including manicures, pedicures, nail art, and extensions. Would you like to know more about any specific service?",
        pricing: "Our prices vary depending on the service. A basic manicure starts at $25, and a pedicure starts at $35. Would you like to know more about specific service prices?",
        transfer: "I'll transfer you to one of our staff members who will be happy to assist you."
    },
    vi: {
        welcome: {
            returning: "Chào mừng {title} {nickname} quay lại! Tôi có thể giúp gì cho bạn?",
            new: "Chào mừng đến với tiệm làm móng của chúng tôi! Tôi ở đây để giúp bạn. Bạn có thể cho tôi biết tên của bạn không?"
        },
        system: "Bạn là đại diện dịch vụ khách hàng AI cho tiệm làm móng. Hãy giữ câu trả lời ngắn gọn và tự nhiên. Bạn có thể giúp với việc đặt lịch, dịch vụ, giá cả và các câu hỏi chung.",
        goodbye: "Bạn là đại diện dịch vụ khách hàng AI cho tiệm làm móng. Người dùng muốn kết thúc cuộc trò chuyện. Hãy giữ lời tạm biệt thân thiện và chuyên nghiệp.",
        services: "Chúng tôi cung cấp nhiều dịch vụ bao gồm làm móng tay, làm móng chân, vẽ móng nghệ thuật và móng giả. Bạn có muốn biết thêm về dịch vụ cụ thể nào không?",
        pricing: "Giá của chúng tôi thay đổi tùy theo dịch vụ. Làm móng tay cơ bản bắt đầu từ $25, và làm móng chân bắt đầu từ $35. Bạn có muốn biết thêm về giá cụ thể không?",
        transfer: "Tôi sẽ chuyển bạn đến một nhân viên của chúng tôi, người sẽ rất vui được hỗ trợ bạn."
    }
    // Add more languages as needed
};

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