import { BusinessServiceFactory } from '../../../services/business/BusinessServiceFactory.js';
import { NailSalonService } from '../../../services/business/NailSalonService.js';
import { Container } from '../../../services/di/Container.js';
import { LanguageService } from '../../../services/language/LanguageService.js';
import { CustomerService } from '../../../services/customer/CustomerService.js';
import { AppointmentService } from '../../../services/appointmentService.js';

// Mock dependencies
jest.mock('../../../services/business/NailSalonService.js');
jest.mock('../../../services/di/Container.js');
jest.mock('../../../services/language/LanguageService.js');
jest.mock('../../../services/customer/CustomerService.js');
jest.mock('../../../services/appointmentService.js');

describe('BusinessServiceFactory', () => {
    let mockContainer;
    let mockNailSalonService;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Reset the container in the factory
        BusinessServiceFactory.container = new Container();
        
        // Setup mocks
        mockContainer = BusinessServiceFactory.container;
        mockNailSalonService = new NailSalonService();
        
        // Setup mock implementations
        mockContainer.register = jest.fn();
        mockContainer.get = jest.fn().mockReturnValue(mockNailSalonService);
    });
    
    describe('initialize', () => {
        it('should register all required services in the container', () => {
            BusinessServiceFactory.initialize();
            
            // Verify service registrations
            expect(mockContainer.register).toHaveBeenCalledWith('languageService', LanguageService);
            expect(mockContainer.register).toHaveBeenCalledWith('customerService', CustomerService);
            expect(mockContainer.register).toHaveBeenCalledWith('appointmentService', AppointmentService);
            expect(mockContainer.register).toHaveBeenCalledWith('nailSalonService', NailSalonService, [
                'languageService',
                'customerService',
                'appointmentService'
            ]);
            
            expect(mockContainer.register).toHaveBeenCalledTimes(4);
        });
    });
    
    describe('createService', () => {
        beforeEach(() => {
            // Initialize the factory before each test
            BusinessServiceFactory.initialize();
        });
        
        it('should create NailSalonService by default', () => {
            const service = BusinessServiceFactory.createService();
            
            expect(service).toBe(mockNailSalonService);
            expect(mockContainer.get).toHaveBeenCalledWith('nailSalonService');
        });
        
        it('should create NailSalonService when type is "nail_salon"', () => {
            const service = BusinessServiceFactory.createService('nail_salon');
            
            expect(service).toBe(mockNailSalonService);
            expect(mockContainer.get).toHaveBeenCalledWith('nailSalonService');
        });
        
        it('should create NailSalonService when type is "NAIL_SALON" (case insensitive)', () => {
            const service = BusinessServiceFactory.createService('NAIL_SALON');
            
            expect(service).toBe(mockNailSalonService);
            expect(mockContainer.get).toHaveBeenCalledWith('nailSalonService');
        });
        
        it('should throw error for unsupported business type', () => {
            expect(() => BusinessServiceFactory.createService('restaurant'))
                .toThrow('Unsupported business type: restaurant');
            
            expect(mockContainer.get).not.toHaveBeenCalled();
        });
    });
    
    describe('error handling', () => {
        it('should propagate container errors', () => {
            BusinessServiceFactory.initialize();
            
            const error = new Error('Service not found');
            mockContainer.get.mockImplementationOnce(() => {
                throw error;
            });
            
            expect(() => BusinessServiceFactory.createService())
                .toThrow(error);
        });
    });
});
