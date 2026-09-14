import { NailSalonService } from '../../../services/business/NailSalonService.js';
import { LanguageService } from '../../../services/language/LanguageService.js';
import { CustomerService } from '../../../services/customer/CustomerService.js';
import { AppointmentService } from '../../../services/appointmentService.js';
import configService from '../../../services/config/ConfigService.js';

// Mock dependencies
jest.mock('../../../services/language/LanguageService.js');
jest.mock('../../../services/customer/CustomerService.js');
jest.mock('../../../services/appointmentService.js');
jest.mock('../../../services/config/ConfigService.js');

describe('NailSalonService', () => {
    let nailSalonService;
    let mockLanguageService;
    let mockCustomerService;
    let mockAppointmentService;
    const phoneNumberSid = 'PN123456';
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mocks
        mockLanguageService = new LanguageService();
        mockCustomerService = new CustomerService();
        mockAppointmentService = new AppointmentService();
        
        // Setup configService mock implementations
        configService.loadConfig = jest.fn().mockResolvedValue(undefined);
        configService.getAppointmentSettings = jest.fn().mockReturnValue({ maxDaysAhead: 7 });
        configService.getServices = jest.fn().mockReturnValue([
            { 
                name: { en: 'Manicure', vi: 'Làm móng tay' },
                description: { en: 'Basic manicure service', vi: 'Dịch vụ làm móng tay cơ bản' }
            },
            { 
                name: { en: 'Pedicure', vi: 'Làm móng chân' },
                description: { en: 'Basic pedicure service', vi: 'Dịch vụ làm móng chân cơ bản' }
            }
        ]);
        configService.getPricing = jest.fn().mockReturnValue({
            'Manicure': 25,
            'Pedicure': 30
        });
        configService.getBusinessHours = jest.fn().mockReturnValue({
            'Monday': '9:00 AM - 7:00 PM',
            'Tuesday': '9:00 AM - 7:00 PM'
        });
        configService.getAvailableStaff = jest.fn().mockReturnValue([
            { 
                name: 'Jane Doe',
                specialties: { en: 'Nail art, Gel nails', vi: 'Nghệ thuật móng, Móng gel' }
            }
        ]);
        configService.getWelcomePrompt = jest.fn().mockReturnValue('Welcome to {businessName}, {customerName}!');
        configService.getSystemPrompt = jest.fn().mockReturnValue('You are assisting customers at {businessName} located at {businessAddress}.');
        configService.getGoodbyePrompt = jest.fn().mockReturnValue('Thank you for contacting {businessName}!');
        configService.getBusinessName = jest.fn().mockReturnValue('Nail Salon');
        configService.getBusinessAddress = jest.fn().mockReturnValue('123 Main St');
        configService.getTransferPhoneNumber = jest.fn().mockReturnValue('+1234567890');
        
        // Setup appointmentService mock
        mockAppointmentService.handleAppointmentRequest = jest.fn().mockResolvedValue({
            message: 'Appointment booked successfully',
            needsTransfer: false
        });
        mockLanguageService.translate = jest.fn((text, lang) => Promise.resolve(`${text} [${lang}]`));
        
        // Create instance
        nailSalonService = new NailSalonService(mockLanguageService, mockCustomerService, mockAppointmentService);
    });
    
    describe('constructor', () => {
        it('should initialize with all dependencies', () => {
            expect(nailSalonService.languageService).toBe(mockLanguageService);
            expect(nailSalonService.customerService).toBe(mockCustomerService);
            expect(nailSalonService.appointmentService).toBe(mockAppointmentService);
        });
    });
    
    describe('handleIntent', () => {
        it('should handle Book_Appointment intent', async () => {
            const result = await nailSalonService.handleIntent(
                'Book_Appointment',
                'I want to book a manicure',
                '+1234567890',
                { name: 'John Doe' },
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(mockAppointmentService.handleAppointmentRequest).toHaveBeenCalledWith(
                'Book_Appointment',
                'I want to book a manicure',
                '+1234567890',
                { maxDaysAhead: 7 }
            );
            expect(mockLanguageService.translate).not.toHaveBeenCalled();
            expect(result).toEqual({
                response: 'Appointment booked successfully',
                shouldTransfer: false
            });
        });

        it.each(['Reschedule_Appointment', 'Cancel_Appointment'])('should route %s to the appointment service', async (intent) => {
            await nailSalonService.handleIntent(intent, 'change it', '+1234567890', null, 'en', phoneNumberSid);

            expect(mockAppointmentService.handleAppointmentRequest).toHaveBeenCalledWith(
                intent, 'change it', '+1234567890', { maxDaysAhead: 7 }
            );
        });

        it('should translate the appointment reply for non-English callers', async () => {
            const result = await nailSalonService.handleIntent('Book_Appointment', 'Đặt lịch', '+1234567890', null, 'vi', phoneNumberSid);

            expect(mockLanguageService.translate).toHaveBeenCalledWith('Appointment booked successfully', 'vi');
            expect(result).toEqual({ response: 'Appointment booked successfully [vi]', shouldTransfer: false });
        });

        it('should propagate a transfer request without translating', async () => {
            mockAppointmentService.handleAppointmentRequest.mockResolvedValueOnce({
                message: 'Let me transfer you.',
                needsTransfer: true
            });

            const result = await nailSalonService.handleIntent('Book_Appointment', 'Đặt lịch', '+1234567890', null, 'vi', phoneNumberSid);

            expect(mockLanguageService.translate).not.toHaveBeenCalled();
            expect(result).toEqual({ response: 'Let me transfer you.', shouldTransfer: true });
        });
        
        it('should handle Ask_About_Services intent', async () => {
            const result = await nailSalonService.handleIntent(
                'Ask_About_Services',
                'What services do you offer?',
                '+1234567890',
                { name: 'John Doe' },
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getServices).toHaveBeenCalledWith(phoneNumberSid);
            expect(result.response).toContain('Here are our available services at Nail Salon');
            expect(result.response).toContain('- Manicure: Basic manicure service');
            expect(result.response).toContain('- Pedicure: Basic pedicure service');
            expect(result.shouldTransfer).toBe(false);
        });
        
        it('should handle Ask_About_Pricing intent', async () => {
            const result = await nailSalonService.handleIntent(
                'Ask_About_Pricing',
                'How much do services cost?',
                '+1234567890',
                { name: 'John Doe' },
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getPricing).toHaveBeenCalledWith(phoneNumberSid);
            expect(result.response).toContain('Here are our current prices');
            expect(result.response).toContain('- Manicure: $25');
            expect(result.response).toContain('- Pedicure: $30');
            expect(result.shouldTransfer).toBe(false);
        });
        
        it('should handle Ask_for_Business_Hours intent', async () => {
            const result = await nailSalonService.handleIntent(
                'Ask_for_Business_Hours',
                'When are you open?',
                '+1234567890',
                { name: 'John Doe' },
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getBusinessHours).toHaveBeenCalledWith(phoneNumberSid);
            expect(result.response).toContain('Our business hours at Nail Salon are');
            expect(result.response).toContain('Monday: 9:00 AM - 7:00 PM');
            expect(result.response).toContain('Tuesday: 9:00 AM - 7:00 PM');
            expect(result.shouldTransfer).toBe(false);
        });
        
        it('should handle Specific_Nail_Technician_Request intent', async () => {
            const result = await nailSalonService.handleIntent(
                'Specific_Nail_Technician_Request',
                'Who works there?',
                '+1234567890',
                { name: 'John Doe' },
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getAvailableStaff).toHaveBeenCalledWith(phoneNumberSid);
            expect(result.response).toContain('Our available staff members are');
            expect(result.response).toContain('- Jane Doe: Nail art, Gel nails');
            expect(result.shouldTransfer).toBe(false);
        });
        
        it('should handle Speak_to_a_Human intent', async () => {
            const result = await nailSalonService.handleIntent(
                'Speak_to_a_Human',
                'I want to speak to a person',
                '+1234567890',
                { name: 'John Doe' },
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getTransferPhoneNumber).toHaveBeenCalledWith(phoneNumberSid);
            expect(result.response).toContain('I\'ll transfer you to our staff at +1234567890');
            expect(result.shouldTransfer).toBe(true);
        });
        
        it('should handle unknown intent', async () => {
            const result = await nailSalonService.handleIntent(
                'Unknown_Intent',
                'Random message',
                '+1234567890',
                { name: 'John Doe' },
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(result).toEqual({
                response: null,
                shouldTransfer: false
            });
        });
        
        it('should handle Vietnamese language', async () => {
            const result = await nailSalonService.handleIntent(
                'Ask_About_Services',
                'Bạn có những dịch vụ gì?',
                '+1234567890',
                { name: 'John Doe' },
                'vi',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getServices).toHaveBeenCalledWith(phoneNumberSid);
            expect(result.response).toContain('Đây là các dịch vụ hiện có tại Nail Salon');
            expect(result.response).toContain('- Làm móng tay: Dịch vụ làm móng tay cơ bản');
            expect(result.response).toContain('- Làm móng chân: Dịch vụ làm móng chân cơ bản');
            expect(result.shouldTransfer).toBe(false);
        });
    });
    
    describe('getWelcomeMessage', () => {
        it('should return welcome message with customer name', async () => {
            const result = await nailSalonService.getWelcomeMessage(
                { name: 'John Doe' },
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getWelcomePrompt).toHaveBeenCalledWith(phoneNumberSid, 'en');
            expect(configService.getBusinessName).toHaveBeenCalledWith(phoneNumberSid);
            expect(result).toBe('Welcome to Nail Salon, John Doe!');
        });
        
        it('should return welcome message without customer name', async () => {
            const result = await nailSalonService.getWelcomeMessage(
                null,
                'en',
                phoneNumberSid
            );
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getWelcomePrompt).toHaveBeenCalledWith(phoneNumberSid, 'en');
            expect(configService.getBusinessName).toHaveBeenCalledWith(phoneNumberSid);
            expect(result).toBe('Welcome to Nail Salon, {customerName}!');
        });
    });
    
    describe('getSystemPrompt', () => {
        it('should return system prompt with business details', async () => {
            const result = await nailSalonService.getSystemPrompt('en', phoneNumberSid);
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getSystemPrompt).toHaveBeenCalledWith(phoneNumberSid, 'en');
            expect(configService.getBusinessName).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getBusinessAddress).toHaveBeenCalledWith(phoneNumberSid);
            expect(result).toBe('You are assisting customers at Nail Salon located at 123 Main St.');
        });
    });
    
    describe('getGoodbyePrompt', () => {
        it('should return goodbye prompt with business name', async () => {
            const result = await nailSalonService.getGoodbyePrompt('en', phoneNumberSid);
            
            expect(configService.loadConfig).toHaveBeenCalledWith(phoneNumberSid);
            expect(configService.getGoodbyePrompt).toHaveBeenCalledWith(phoneNumberSid, 'en');
            expect(configService.getBusinessName).toHaveBeenCalledWith(phoneNumberSid);
            expect(result).toBe('Thank you for contacting Nail Salon!');
        });
    });
    
    describe('getTransferNumber', () => {
        it('should return transfer phone number', () => {
            const result = nailSalonService.getTransferNumber(phoneNumberSid);
            
            expect(configService.getTransferPhoneNumber).toHaveBeenCalledWith(phoneNumberSid);
            expect(result).toBe('+1234567890');
        });
    });
    
    describe('formatServicesResponse', () => {
        it('should format services response in English', () => {
            const services = [
                { 
                    name: { en: 'Manicure', vi: 'Làm móng tay' },
                    description: { en: 'Basic manicure service', vi: 'Dịch vụ làm móng tay cơ bản' }
                }
            ];
            
            const result = nailSalonService.formatServicesResponse(services, 'en', phoneNumberSid);
            
            expect(configService.getBusinessName).toHaveBeenCalledWith(phoneNumberSid);
            expect(result).toContain('Here are our available services at Nail Salon');
            expect(result).toContain('- Manicure: Basic manicure service');
        });
        
        it('should format services response in Vietnamese', () => {
            const services = [
                { 
                    name: { en: 'Manicure', vi: 'Làm móng tay' },
                    description: { en: 'Basic manicure service', vi: 'Dịch vụ làm móng tay cơ bản' }
                }
            ];
            
            const result = nailSalonService.formatServicesResponse(services, 'vi', phoneNumberSid);
            
            expect(configService.getBusinessName).toHaveBeenCalledWith(phoneNumberSid);
            expect(result).toContain('Đây là các dịch vụ hiện có tại Nail Salon');
            expect(result).toContain('- Làm móng tay: Dịch vụ làm móng tay cơ bản');
        });
    });
});
