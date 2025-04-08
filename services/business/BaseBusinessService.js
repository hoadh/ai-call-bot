import { LanguageService } from '../language/LanguageService.js';

export class BaseBusinessService {
    constructor() {
        if (this.constructor === BaseBusinessService) {
            throw new Error("Abstract class cannot be instantiated");
        }
        this.languageService = new LanguageService();
    }

    async handleIntent(intent, userMessage, phoneNumber, customerInfo, language = 'en') {
        throw new Error("Method 'handleIntent' must be implemented");
    }

    async getWelcomeMessage(customerInfo, language = 'en') {
        throw new Error("Method 'getWelcomeMessage' must be implemented");
    }

    async getSystemPrompt(language = 'en') {
        throw new Error("Method 'getSystemPrompt' must be implemented");
    }

    async getGoodbyePrompt(language = 'en') {
        throw new Error("Method 'getGoodbyePrompt' must be implemented");
    }

    async translateResponse(response, language) {
        if (!response || language === 'en') {
            return response;
        }
        return await this.languageService.translate(response, language);
    }

    getTransferNumber(phoneNumberSid) {
        throw new Error("Method 'getTransferNumber' must be implemented");
    }
} 