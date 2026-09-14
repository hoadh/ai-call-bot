export class BaseLLMService {
    constructor(languageService) {
        if (this.constructor === BaseLLMService) {
            throw new Error("Abstract class cannot be instantiated");
        }
        this.languageService = languageService;
    }

    async detectIntent(userMessage) {
        throw new Error("Method 'detectIntent' must be implemented");
    }

    async detectIntentAndHandle(userMessage, phoneNumber) {
        throw new Error("Method 'detectIntentAndHandle' must be implemented");
    }

    async getResponse(prompt, systemMessage) {
        throw new Error("Method 'getResponse' must be implemented");
    }

    // Resolve a spoken request ("tomorrow at 3pm") to an ISO 8601 string, or null
    async extractAppointmentTime(userMessage, timeZone) {
        throw new Error("Method 'extractAppointmentTime' must be implemented");
    }

    async isGoodbye(text) {
        throw new Error("Method 'isGoodbye' must be implemented");
    }
} 