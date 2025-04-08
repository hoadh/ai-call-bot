import { LLMServiceFactory } from '../../../services/llm/LLMServiceFactory.js';
import { MockLanguageService } from '../../mocks/LanguageService.mock.js';
import { MockOpenAIService } from '../../mocks/OpenAIService.mock.js';

// Mock the LanguageService module
jest.mock('../../../services/language/LanguageService.js', () => {
    return {
        LanguageService: jest.fn().mockImplementation(() => {
            return new MockLanguageService();
        })
    };
});

// Mock the OpenAIService module
jest.mock('../../../services/llm/OpenAIService.js', () => {
    return {
        OpenAIService: jest.fn().mockImplementation((languageService) => {
            return new MockOpenAIService(languageService);
        })
    };
});

describe('LLMServiceFactory', () => {
    let mockLanguageService;

    beforeEach(() => {
        mockLanguageService = new MockLanguageService();
        LLMServiceFactory.initialize(mockLanguageService);
    });

    afterEach(() => {
        // Clear the container after each test
        LLMServiceFactory.container = new (require('../../../services/di/Container.js').Container)();
        // Clear all mocks
        jest.clearAllMocks();
    });

    test('should initialize with language service', () => {
        const service = LLMServiceFactory.createService();
        expect(service).toBeDefined();
        expect(service.languageService).toBeDefined();
    });

    test('should create OpenAIService instance', () => {
        const service = LLMServiceFactory.createService();
        expect(service).toBeDefined();
        expect(service.languageService).toBeInstanceOf(MockLanguageService);
    });

    test('should handle service creation errors', () => {
        // Force an error by clearing the container
        LLMServiceFactory.container = new (require('../../../services/di/Container.js').Container)();
        expect(() => LLMServiceFactory.createService()).toThrow();
    });
}); 