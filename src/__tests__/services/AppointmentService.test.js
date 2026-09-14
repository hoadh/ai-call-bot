import { AppointmentService } from '../../services/appointmentService.js';
import { CustomerService } from '../../services/customer/CustomerService.js';
import axios from 'axios';

// Mock dependencies
jest.mock('../../services/customer/CustomerService.js');
jest.mock('axios');

describe('AppointmentService', () => {
    let appointmentService;
    let mockLlmService;
    const mockCustomerInfo = { _id: 'customer123', name: 'Test Customer' };
    const mockPhoneNumber = '+1234567890';
    const mockAppointmentTime = '2025-04-15T10:00:00Z';
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup CustomerService mock
        CustomerService.prototype.getCustomerInfo = jest.fn().mockResolvedValue(mockCustomerInfo);
        mockLlmService = { extractAppointmentTime: jest.fn().mockResolvedValue(mockAppointmentTime) };
        
        // Setup axios mock responses
        axios.post = jest.fn().mockResolvedValue({ data: { id: 'booking123' } });
        axios.put = jest.fn().mockResolvedValue({ data: { id: 'booking123', updated: true } });
        axios.delete = jest.fn().mockResolvedValue({ data: { id: 'booking123', deleted: true } });
        
        // Set environment variable
        process.env.INTERNAL_BACKEND_API_URL = 'http://api.example.com';
        
        // Create instance
        appointmentService = new AppointmentService(new CustomerService(), mockLlmService);
    });
    
    describe('constructor', () => {
        it('should keep injected dependencies', () => {
            expect(appointmentService.customerService).toBeInstanceOf(CustomerService);
            expect(appointmentService.llmService).toBe(mockLlmService);
        });
    });

    describe('handleAppointmentRequest', () => {
        const settings = { timezone: 'UTC' };

        it('should ask for a time when none could be extracted', async () => {
            mockLlmService.extractAppointmentTime.mockResolvedValueOnce(null);

            const result = await appointmentService.handleAppointmentRequest('Book_Appointment', 'I want to book', mockPhoneNumber, settings);

            expect(mockLlmService.extractAppointmentTime).toHaveBeenCalledWith('I want to book', 'UTC');
            expect(result).toEqual({ message: 'What date and time would you like for your appointment?', needsTransfer: false });
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should book with the extracted time and confirm in spoken form', async () => {
            const result = await appointmentService.handleAppointmentRequest('Book_Appointment', 'Book me tomorrow at 10', mockPhoneNumber, settings);

            expect(axios.post).toHaveBeenCalledWith('http://api.example.com/booking', expect.objectContaining({
                customer: mockCustomerInfo._id,
                startTime: mockAppointmentTime
            }));
            expect(result).toEqual({
                message: 'Your appointment has been booked for Tuesday, April 15, 2025 at 10:00 AM.',
                needsTransfer: false
            });
        });

        it('should reschedule with the extracted time', async () => {
            const result = await appointmentService.handleAppointmentRequest('Reschedule_Appointment', 'Move it to the 15th at 10', mockPhoneNumber, settings);

            expect(axios.put).toHaveBeenCalledTimes(1);
            expect(result.message).toBe('Your appointment has been rescheduled for Tuesday, April 15, 2025 at 10:00 AM.');
            expect(result.needsTransfer).toBe(false);
        });

        it('should cancel without asking the LLM for a time', async () => {
            const result = await appointmentService.handleAppointmentRequest('Cancel_Appointment', 'Cancel my appointment', mockPhoneNumber, settings);

            expect(mockLlmService.extractAppointmentTime).not.toHaveBeenCalled();
            expect(axios.delete).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ message: 'Your appointment has been cancelled.', needsTransfer: false });
        });

        it('should transfer to staff when the customer is unknown', async () => {
            CustomerService.prototype.getCustomerInfo.mockResolvedValueOnce(null);

            const result = await appointmentService.handleAppointmentRequest('Book_Appointment', 'Book me', mockPhoneNumber, settings);

            expect(result.needsTransfer).toBe(true);
            expect(result.message).toContain('transfer you to our staff');
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should transfer to staff when time extraction fails', async () => {
            mockLlmService.extractAppointmentTime.mockRejectedValueOnce(new Error('OpenAI down'));

            const result = await appointmentService.handleAppointmentRequest('Book_Appointment', 'Book me', mockPhoneNumber, settings);

            expect(result.needsTransfer).toBe(true);
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should transfer to staff when the backend call fails', async () => {
            axios.post.mockRejectedValueOnce(new Error('down'));

            const result = await appointmentService.handleAppointmentRequest('Book_Appointment', 'Book me', mockPhoneNumber, settings);

            expect(result.needsTransfer).toBe(true);
        });

        it('should fall back to the server time zone when settings have none', async () => {
            const serverZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            await appointmentService.handleAppointmentRequest('Book_Appointment', 'Book me', mockPhoneNumber);

            expect(mockLlmService.extractAppointmentTime).toHaveBeenCalledWith('Book me', serverZone);
        });
    });
    
    describe('handleAppointment', () => {
        it('should return error if customer not found', async () => {
            CustomerService.prototype.getCustomerInfo.mockResolvedValueOnce(null);
            
            const result = await appointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({ error: 'Customer not found.' });
            expect(CustomerService.prototype.getCustomerInfo).toHaveBeenCalledWith(mockPhoneNumber);
        });
        
        it('should return error if appointment time is missing for booking', async () => {
            const result = await appointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, null);
            
            expect(result).toEqual({ error: 'Appointment time is required.' });
        });
        
        it('should return error if appointment time is missing for rescheduling', async () => {
            const result = await appointmentService.handleAppointment('Reschedule_Appointment', mockPhoneNumber, null);
            
            expect(result).toEqual({ error: 'Appointment time is required.' });
        });
        
        it('should book appointment successfully', async () => {
            const result = await appointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({
                success: true,
                message: 'Appointment booked successfully',
                data: { id: 'booking123' }
            });
            
            expect(axios.post).toHaveBeenCalledWith('http://api.example.com/booking', {
                customer: mockCustomerInfo._id,
                bookingDate: mockAppointmentTime.split('T')[0],
                startTime: mockAppointmentTime,
                appointment_time: mockAppointmentTime
            });
        });
        
        it('should reschedule appointment successfully', async () => {
            const result = await appointmentService.handleAppointment('Reschedule_Appointment', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({
                success: true,
                message: 'Appointment rescheduled successfully',
                data: { id: 'booking123', updated: true }
            });
            
            expect(axios.put).toHaveBeenCalledWith('http://api.example.com/booking', {
                customer: mockCustomerInfo._id,
                bookingDate: mockAppointmentTime.split('T')[0],
                startTime: mockAppointmentTime,
                new_time: mockAppointmentTime
            });
        });
        
        it('should cancel appointment successfully', async () => {
            const result = await appointmentService.handleAppointment('Cancel_Appointment', mockPhoneNumber, null);
            
            expect(result).toEqual({
                success: true,
                message: 'Appointment cancelled successfully',
                data: { id: 'booking123', deleted: true }
            });
            
            expect(axios.delete).toHaveBeenCalledWith('http://api.example.com/booking', {
                data: { customer: mockCustomerInfo._id }
            });
        });
        
        it('should return error for invalid action', async () => {
            const result = await appointmentService.handleAppointment('Invalid_Action', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({ error: 'Invalid action.' });
        });
        
        it('should handle axios error', async () => {
            const errorMessage = 'Network error';
            axios.post.mockRejectedValueOnce({ 
                response: { data: { message: errorMessage } } 
            });
            
            const result = await appointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({ error: errorMessage });
        });
        
        it('should handle generic error when no response data is available', async () => {
            axios.post.mockRejectedValueOnce(new Error('Some error'));
            
            const result = await appointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({ error: 'An error occurred while processing your request.' });
        });
    });
});
