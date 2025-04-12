import { CustomerService } from '../../../services/customer/CustomerService.js';

describe('CustomerService', () => {
    let customerService;
    const mockPhoneNumber = '+1234567890';
    const mockCustomerData = { _id: 'customer123', name: 'Test Customer' };
    
    // Mock global fetch
    global.fetch = jest.fn();
    global.console.log = jest.fn();
    global.console.error = jest.fn();
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Set environment variable
        process.env.INTERNAL_BACKEND_API_URL = 'http://api.example.com';
        
        // Create instance
        customerService = new CustomerService();
    });
    
    describe('getCustomerInfo', () => {
        it('should fetch customer info successfully', async () => {
            // Mock successful response
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockCustomerData))
            });
            
            const result = await customerService.getCustomerInfo(mockPhoneNumber);
            
            expect(result).toEqual(mockCustomerData);
            expect(global.fetch).toHaveBeenCalledWith(
                `http://api.example.com/customers/phone/${mockPhoneNumber}`
            );
            expect(global.console.log).toHaveBeenCalledWith(
                'Fetching customer info from:',
                `http://api.example.com/customers/phone/${mockPhoneNumber}`
            );
            expect(global.console.log).toHaveBeenCalledWith(
                'Customer data:',
                JSON.stringify(mockCustomerData)
            );
        });
        
        it('should return null when customer not found (404)', async () => {
            // Mock 404 response
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: jest.fn().mockResolvedValueOnce('Not found')
            });
            
            const result = await customerService.getCustomerInfo(mockPhoneNumber);
            
            expect(result).toBeNull();
            expect(global.console.log).toHaveBeenCalledWith('Customer not found');
        });
        
        it('should throw error on server error (500)', async () => {
            // Mock 500 response
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: jest.fn().mockResolvedValueOnce('Server error')
            });
            
            await expect(customerService.getCustomerInfo(mockPhoneNumber))
                .rejects.toThrow('Internal server error');
            
            expect(global.console.error).toHaveBeenCalledWith('Internal server error');
        });
        
        it('should throw error on other non-ok responses', async () => {
            // Mock other error response
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: jest.fn().mockResolvedValueOnce('Bad request')
            });
            
            await expect(customerService.getCustomerInfo(mockPhoneNumber))
                .rejects.toThrow('Network response was not ok');
        });
        
        it('should throw error when fetch fails', async () => {
            // Mock fetch failure
            const networkError = new Error('Network failure');
            global.fetch.mockRejectedValueOnce(networkError);
            
            await expect(customerService.getCustomerInfo(mockPhoneNumber))
                .rejects.toThrow(networkError);
        });
        
        it('should throw error when response parsing fails', async () => {
            // Mock invalid JSON response
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: jest.fn().mockResolvedValueOnce('Invalid JSON')
            });
            
            await expect(customerService.getCustomerInfo(mockPhoneNumber))
                .rejects.toThrow();
        });
    });
});
