import { OpenAIService } from './OpenAIService.js';
// Removed Container import as we'll instantiate directly for now
// import { Container } from '../di/Container.js';
import { LanguageService } from '../language/LanguageService.js';
import config from '../../config/index.js'; // Import config

export class LLMServiceFactory {
    // Removed static container
    static languageServiceInstance = null;

    static initialize(languageService) {
        if (!languageService) {
            throw new Error("LanguageService instance is required for LLMServiceFactory initialization.");
        }
        this.languageServiceInstance = languageService;
        // Removed container registration
    }

    static createService(serviceType = 'openai') { // Added serviceType parameter
        if (!this.languageServiceInstance) {
            throw new Error("LLMServiceFactory not initialized. Call initialize() first.");
        }

        switch(serviceType) {
            case 'openai':
                // Instantiate directly, passing API key and language service
                return new OpenAIService(config.openai.apiKey, this.languageServiceInstance);
            // Add cases for other LLM types if needed
            // case 'another_llm':
            //     return new AnotherLLMService(config.anotherLlm.apiKey, this.languageServiceInstance);
            default:
                throw new Error(`Unsupported LLM service type: ${serviceType}`);
        }
    }
} 