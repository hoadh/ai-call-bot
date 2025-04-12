import { AppointmentService } from '../../services/appointmentService.js';
import { CustomerService } from '../../services/customer/CustomerService.js';
import axios from 'axios';

// Mock dependencies
jest.mock('../../services/customer/CustomerService.js');
jest.mock('axios');

describe('AppointmentService', () => {
    let appointmentService;
    const mockCustomerInfo = { _id: 'customer123', name: 'Test Customer' };
    const mockPhoneNumber = '+1234567890';
    const mockAppointmentTime = '2025-04-15T10:00:00Z';
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup CustomerService mock
        CustomerService.prototype.getCustomerInfo = jest.fn().mockResolvedValue(mockCustomerInfo);
        
        // Setup axios mock responses
        axios.post = jest.fn().mockResolvedValue({ data: { id: 'booking123' } });
        axios.put = jest.fn().mockResolvedValue({ data: { id: 'booking123', updated: true } });
        axios.delete = jest.fn().mockResolvedValue({ data: { id: 'booking123', deleted: true } });
        
        // Set environment variable
        process.env.INTERNAL_BACKEND_API_URL = 'http://api.example.com';
        
        // Create instance
        appointmentService = new AppointmentService();
    });
    
    describe('constructor', () => {
        it('should initialize CustomerService', () => {
            expect(appointmentService.customerService).toBeInstanceOf(CustomerService);
        });
    });
    
    describe('handleAppointment', () => {
        it('should return error if customer not found', async () => {
            CustomerService.prototype.getCustomerInfo.mockResolvedValueOnce(null);
            
            const result = await AppointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({ error: 'Customer not found.' });
            expect(CustomerService.prototype.getCustomerInfo).toHaveBeenCalledWith(mockPhoneNumber);
        });
        
        it('should return error if appointment time is missing for booking', async () => {
            const result = await AppointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, null);
            
            expect(result).toEqual({ error: 'Appointment time is required.' });
        });
        
        it('should return error if appointment time is missing for rescheduling', async () => {
            const result = await AppointmentService.handleAppointment('Reschedule_Appointment', mockPhoneNumber, null);
            
            expect(result).toEqual({ error: 'Appointment time is required.' });
        });
        
        it('should book appointment successfully', async () => {
            const result = await AppointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, mockAppointmentTime);
            
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
            const result = await AppointmentService.handleAppointment('Reschedule_Appointment', mockPhoneNumber, mockAppointmentTime);
            
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
            const result = await AppointmentService.handleAppointment('Cancel_Appointment', mockPhoneNumber, null);
            
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
            const result = await AppointmentService.handleAppointment('Invalid_Action', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({ error: 'Invalid action.' });
        });
        
        it('should handle axios error', async () => {
            const errorMessage = 'Network error';
            axios.post.mockRejectedValueOnce({ 
                response: { data: { message: errorMessage } } 
            });
            
            const result = await AppointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({ error: errorMessage });
        });
        
        it('should handle generic error when no response data is available', async () => {
            axios.post.mockRejectedValueOnce(new Error('Some error'));
            
            const result = await AppointmentService.handleAppointment('Book_Appointment', mockPhoneNumber, mockAppointmentTime);
            
            expect(result).toEqual({ error: 'An error occurred while processing your request.' });
        });
    });
});
