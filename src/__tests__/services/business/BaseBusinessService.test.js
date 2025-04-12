import { BaseBusinessService } from '../../../services/business/BaseBusinessService.js';
import { LanguageService } from '../../../services/language/LanguageService.js';
import { CustomerService } from '../../../services/customer/CustomerService.js';

// Mock dependencies
jest.mock('../../../services/language/LanguageService.js');
jest.mock('../../../services/customer/CustomerService.js');

describe('BaseBusinessService', () => {
    let mockLanguageService;
    let mockCustomerService;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mocks
        mockLanguageService = new LanguageService();
        mockCustomerService = new CustomerService();
        
        // Setup mock implementations
        mockLanguageService.translate = jest.fn().mockImplementation(
            (text, language) => Promise.resolve(`Translated: ${text} to ${language}`)
        );
        mockCustomerService.getCustomerInfo = jest.fn().mockImplementation(
            (phoneNumber) => Promise.resolve({ _id: 'customer123', name: 'Test Customer', phone: phoneNumber })
        );
    });
    
    describe('constructor', () => {
        it('should throw error when instantiating abstract class directly', () => {
            expect(() => new BaseBusinessService(mockLanguageService, mockCustomerService))
                .toThrow('Abstract class cannot be instantiated');
        });
        
        it('should initialize when extended by a concrete class', () => {
            // Create a concrete subclass
            class ConcreteBusinessService extends BaseBusinessService {
                async handleIntent() { return {}; }
                async getWelcomeMessage() { return ''; }
                async getSystemPrompt() { return ''; }
                async getGoodbyePrompt() { return ''; }
                getTransferNumber() { return ''; }
            }
            
            const service = new ConcreteBusinessService(mockLanguageService, mockCustomerService);
            expect(service.languageService).toBe(mockLanguageService);
            expect(service.customerService).toBe(mockCustomerService);
        });
    });
    
    describe('abstract methods', () => {
        // Create a concrete subclass that doesn't implement all methods
        class PartialBusinessService extends BaseBusinessService {
            constructor(languageService, customerService) {
                super(languageService, customerService);
            }
            // Don't implement any abstract methods
        }
        
        let partialService;
        
        beforeEach(() => {
            partialService = new PartialBusinessService(mockLanguageService, mockCustomerService);
        });
        
        it('should throw error when calling unimplemented handleIntent', async () => {
            await expect(partialService.handleIntent('intent', 'message', '123', {}))
                .rejects.toThrow("Method 'handleIntent' must be implemented");
        });
        
        it('should throw error when calling unimplemented getWelcomeMessage', async () => {
            await expect(partialService.getWelcomeMessage({}, 'en'))
                .rejects.toThrow("Method 'getWelcomeMessage' must be implemented");
        });
        
        it('should throw error when calling unimplemented getSystemPrompt', async () => {
            await expect(partialService.getSystemPrompt('en'))
                .rejects.toThrow("Method 'getSystemPrompt' must be implemented");
        });
        
        it('should throw error when calling unimplemented getGoodbyePrompt', async () => {
            await expect(partialService.getGoodbyePrompt('en'))
                .rejects.toThrow("Method 'getGoodbyePrompt' must be implemented");
        });
        
        it('should throw error when calling unimplemented getTransferNumber', () => {
            expect(() => partialService.getTransferNumber('sid'))
                .toThrow("Method 'getTransferNumber' must be implemented");
        });
    });
    
    describe('translateResponse', () => {
        // Create a minimal concrete subclass
        class MinimalBusinessService extends BaseBusinessService {
            constructor(languageService, customerService) {
                super(languageService, customerService);
            }
            async handleIntent() { return {}; }
            async getWelcomeMessage() { return ''; }
            async getSystemPrompt() { return ''; }
            async getGoodbyePrompt() { return ''; }
            getTransferNumber() { return ''; }
        }
        
        let service;
        
        beforeEach(() => {
            service = new MinimalBusinessService(mockLanguageService, mockCustomerService);
        });
        
        it('should return original response if null', async () => {
            const result = await service.translateResponse(null, 'vi');
            expect(result).toBeNull();
            expect(mockLanguageService.translate).not.toHaveBeenCalled();
        });
        
        it('should return original response if language is English', async () => {
            const response = 'Hello world';
            const result = await service.translateResponse(response, 'en');
            expect(result).toBe(response);
            expect(mockLanguageService.translate).not.toHaveBeenCalled();
        });
        
        it('should translate response for non-English language', async () => {
            const response = 'Hello world';
            const language = 'vi';
            const result = await service.translateResponse(response, language);
            expect(result).toBe(`Translated: ${response} to ${language}`);
            expect(mockLanguageService.translate).toHaveBeenCalledWith(response, language);
        });
    });
    
    describe('getCustomerInfo', () => {
        // Create a minimal concrete subclass
        class MinimalBusinessService extends BaseBusinessService {
            constructor(languageService, customerService) {
                super(languageService, customerService);
            }
            async handleIntent() { return {}; }
            async getWelcomeMessage() { return ''; }
            async getSystemPrompt() { return ''; }
            async getGoodbyePrompt() { return ''; }
            getTransferNumber() { return ''; }
        }
        
        let service;
        
        beforeEach(() => {
            service = new MinimalBusinessService(mockLanguageService, mockCustomerService);
        });
        
        it('should call customerService.getCustomerInfo with phone number', async () => {
            const phoneNumber = '+1234567890';
            const result = await service.getCustomerInfo(phoneNumber);
            
            expect(result).toEqual({ _id: 'customer123', name: 'Test Customer', phone: phoneNumber });
            expect(mockCustomerService.getCustomerInfo).toHaveBeenCalledWith(phoneNumber);
        });
        
        it('should propagate errors from customerService.getCustomerInfo', async () => {
            const phoneNumber = '+1234567890';
            const error = new Error('Customer not found');
            mockCustomerService.getCustomerInfo.mockRejectedValueOnce(error);
            
            await expect(service.getCustomerInfo(phoneNumber)).rejects.toThrow(error);
        });
    });
});
