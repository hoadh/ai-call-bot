import { LLMServiceFactory } from '../../../services/llm/LLMServiceFactory.js';
import { LanguageService } from '../../../services/language/LanguageService.js'; // Import actual LanguageService for type checks
import { OpenAIService } from '../../../services/llm/OpenAIService.js';
import config from '../../../config/index.js'; // Import config to access API key

// Mock the OpenAIService module to check constructor arguments
jest.mock('../../../services/llm/OpenAIService.js');

// Mock LanguageService for simplicity in these tests
jest.mock('../../../services/language/LanguageService.js');

describe('LLMServiceFactory', () => {
    let mockLanguageServiceInstance;

    beforeEach(() => {
        // Reset mocks and clear factory state
        jest.clearAllMocks();
        LLMServiceFactory.languageServiceInstance = null; // Reset internal state

        // Create a mock instance for LanguageService
        mockLanguageServiceInstance = new LanguageService(); // Use the mocked constructor
        
        // Initialize factory with the mock instance
        LLMServiceFactory.initialize(mockLanguageServiceInstance);
    });

    test('should throw error if not initialized before creating service', () => {
        LLMServiceFactory.languageServiceInstance = null; // Ensure not initialized
        expect(() => LLMServiceFactory.createService('openai')).toThrow('LLMServiceFactory not initialized');
    });

    test('should create OpenAIService instance with correct arguments', () => {
        const service = LLMServiceFactory.createService('openai');

        expect(service).toBeDefined();
        // Check if OpenAIService constructor was called correctly
        expect(OpenAIService).toHaveBeenCalledTimes(1);
        expect(OpenAIService).toHaveBeenCalledWith(
            config.openai.apiKey, // Check if API key from config was passed
            mockLanguageServiceInstance // Check if the correct language service instance was passed
        );
        // Check if the returned service is an instance created by the mock constructor
        expect(service).toBeInstanceOf(OpenAIService); 
    });

    test('should throw error for unsupported service type', () => {
        expect(() => LLMServiceFactory.createService('unsupported_type'))
            .toThrow('Unsupported LLM service type: unsupported_type');
    });

    test('initialize should throw error if no languageService is provided', () => {
        LLMServiceFactory.languageServiceInstance = null; // Reset state
        expect(() => LLMServiceFactory.initialize(null)).toThrow('LanguageService instance is required');
    });
}); 