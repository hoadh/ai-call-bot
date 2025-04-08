import { OpenAIService } from './OpenAIService.js';
import { Container } from '../di/Container.js';
import { LanguageService } from '../language/LanguageService.js';

export class LLMServiceFactory {
    static container = new Container();

    static initialize(languageService) {
        // Register services with their dependencies
        this.container.register('languageService', LanguageService);
        this.container.register('openAIService', OpenAIService, ['languageService']);
    }

    static createService() {
        return this.container.get('openAIService');
    }
} 