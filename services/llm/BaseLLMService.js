export class BaseLLMService {
    constructor() {
        if (this.constructor === BaseLLMService) {
            throw new Error("Abstract class cannot be instantiated");
        }
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

    async isGoodbye(text) {
        throw new Error("Method 'isGoodbye' must be implemented");
    }
} 