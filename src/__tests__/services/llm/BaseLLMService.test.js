import { BaseLLMService } from '../../../services/llm/BaseLLMService.js';
import { LanguageService } from '../../../services/language/LanguageService.js';

// Mock dependencies
jest.mock('../../../services/language/LanguageService.js');

describe('BaseLLMService', () => {
    let mockLanguageService;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup LanguageService mock
        mockLanguageService = new LanguageService();
    });
    
    describe('constructor', () => {
        it('should throw error when instantiating abstract class directly', () => {
            expect(() => new BaseLLMService(mockLanguageService))
                .toThrow('Abstract class cannot be instantiated');
        });
        
        it('should initialize when extended by a concrete class', () => {
            // Create a concrete subclass
            class ConcreteLLMService extends BaseLLMService {
                async detectIntent() { return 'test'; }
                async detectIntentAndHandle() { return 'test'; }
                async getResponse() { return 'test'; }
                async isGoodbye() { return false; }
            }
            
            const service = new ConcreteLLMService(mockLanguageService);
            expect(service.languageService).toBe(mockLanguageService);
        });
    });
    
    describe('abstract methods', () => {
        // Create a concrete subclass that doesn't implement all methods
        class PartialLLMService extends BaseLLMService {
            constructor(languageService) {
                super(languageService);
            }
            // Only implement detectIntent
            async detectIntent() { return 'test'; }
        }
        
        let partialService;
        
        beforeEach(() => {
            partialService = new PartialLLMService(mockLanguageService);
        });
        
        it('should throw error when calling unimplemented detectIntentAndHandle', async () => {
            await expect(partialService.detectIntentAndHandle('test', '123'))
                .rejects.toThrow("Method 'detectIntentAndHandle' must be implemented");
        });
        
        it('should throw error when calling unimplemented getResponse', async () => {
            await expect(partialService.getResponse('test'))
                .rejects.toThrow("Method 'getResponse' must be implemented");
        });
        
        it('should throw error when calling unimplemented isGoodbye', async () => {
            await expect(partialService.isGoodbye('test'))
                .rejects.toThrow("Method 'isGoodbye' must be implemented");
        });
    });
});
