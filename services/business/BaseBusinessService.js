export class BaseBusinessService {
    constructor() {
        if (this.constructor === BaseBusinessService) {
            throw new Error("Abstract class cannot be instantiated");
        }
    }

    async handleIntent(intent, userMessage, phoneNumber, customerInfo) {
        throw new Error("Method 'handleIntent' must be implemented");
    }

    async getWelcomeMessage(customerInfo) {
        throw new Error("Method 'getWelcomeMessage' must be implemented");
    }

    async getSystemPrompt() {
        throw new Error("Method 'getSystemPrompt' must be implemented");
    }

    async getGoodbyePrompt() {
        throw new Error("Method 'getGoodbyePrompt' must be implemented");
    }
} 