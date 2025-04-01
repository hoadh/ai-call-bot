import { OpenAIService } from './OpenAIService.js';

export class LLMServiceFactory {
    static createService(type = 'openai') {
        switch (type.toLowerCase()) {
            case 'openai':
                return new OpenAIService();
            // Add more cases here for other LLM services
            // case 'gemini':
            //     return new GeminiService();
            default:
                throw new Error(`Unsupported LLM service type: ${type}`);
        }
    }
} 