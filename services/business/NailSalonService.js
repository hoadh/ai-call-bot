import { BaseBusinessService } from './BaseBusinessService.js';
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
    async handleIntent(intent, userMessage, phoneNumber, customerInfo, language = 'en') {
        const translations = TRANSLATIONS[language] || TRANSLATIONS.en;
        
        switch (intent) {
            case "Book_Appointment":
            case "Reschedule_Appointment":
            case "Cancel_Appointment":
                const appointmentResult = await AppointmentService.handleAppointment(
                    intent,
                    phoneNumber,
                    null // appointment_time will be extracted by the LLM
                );

                if (appointmentResult.error) {
                    return {
                        response: await this.translateResponse(
                            `I apologize, but I encountered an error: ${appointmentResult.error}`,
                            language
                        ),
                        requiresFollowUp: false
                    };
                }
                return {
                    response: await this.translateResponse(appointmentResult.message, language),
                    requiresFollowUp: false
                };

            case "Ask_About_Services":
                return {
                    response: await this.translateResponse(translations.services, language),
                    requiresFollowUp: true
                };

            case "Ask_About_Pricing":
                return {
                    response: await this.translateResponse(translations.pricing, language),
                    requiresFollowUp: true
                };

            case "Speak_to_a_Human":
                return {
                    response: await this.translateResponse(translations.transfer, language),
                    requiresFollowUp: false,
                    shouldTransfer: true
                };

            default:
                return {
                    response: null,
                    requiresFollowUp: true
                };
        }
    }

    async getWelcomeMessage(customerInfo, language = 'en') {
        const translations = TRANSLATIONS[language] || TRANSLATIONS.en;
        if (customerInfo) {
            return await this.translateResponse(
                translations.welcome.returning
                    .replace('{title}', customerInfo.title)
                    .replace('{nickname}', customerInfo.nickname),
                language
            );
        }
        return await this.translateResponse(translations.welcome.new, language);
    }

    async getSystemPrompt(language = 'en') {
        const translations = TRANSLATIONS[language] || TRANSLATIONS.en;
        return await this.translateResponse(translations.system, language);
    }

    async getGoodbyePrompt(language = 'en') {
        const translations = TRANSLATIONS[language] || TRANSLATIONS.en;
        return await this.translateResponse(translations.goodbye, language);
    }
} 