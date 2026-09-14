import { OpenAIService } from '../../../services/llm/OpenAIService.js';
import { LanguageService } from '../../../services/language/LanguageService.js';
import { ExternalServiceError } from '../../../services/error/AppError.js';
import OpenAI from 'openai';

// Mock dependencies
jest.mock('openai');
jest.mock('../../../services/language/LanguageService.js');

describe('OpenAIService', () => {
    let openAIService;
    let mockOpenAI;
    let mockLanguageService;
    const mockApiKey = 'test-api-key';
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup OpenAI mock
        mockOpenAI = {
            chat: {
                completions: {
                    create: jest.fn()
                }
            }
        };
        OpenAI.mockImplementation(() => mockOpenAI);
        
        // Setup LanguageService mock
        mockLanguageService = new LanguageService();
        
        // Mock console methods
        global.console.error = jest.fn();
        
        // Create instance
        openAIService = new OpenAIService(mockApiKey, mockLanguageService);
    });
    
    describe('constructor', () => {
        it('should initialize with API key and language service', () => {
            expect(OpenAI).toHaveBeenCalledWith({ apiKey: mockApiKey });
            expect(openAIService.openai).toBe(mockOpenAI);
            expect(openAIService.languageService).toBe(mockLanguageService);
        });
        
        it('should throw error if API key is not provided', () => {
            expect(() => new OpenAIService(null, mockLanguageService))
                .toThrow('OpenAI API key is required for OpenAIService.');
        });
    });
    
    describe('detectIntent', () => {
        it('should detect intent successfully', async () => {
            // Setup mock response
            const mockResponse = {
                choices: [
                    {
                        message: {
                            function_call: {
                                arguments: JSON.stringify({ intent: 'Book_Appointment' })
                            }
                        }
                    }
                ]
            };
            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);
            
            const result = await openAIService.detectIntent('I want to book an appointment');
            
            expect(result).toBe('Book_Appointment');
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
                model: 'gpt-4-turbo',
                messages: [{ role: 'user', content: 'I want to book an appointment' }],
                functions: expect.any(Array),
                function_call: 'auto'
            });
        });
        
        it('should return Unknown_Intent if no function call is returned', async () => {
            // Setup mock response without function call
            const mockResponse = {
                choices: [
                    {
                        message: {}
                    }
                ]
            };
            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);
            
            const result = await openAIService.detectIntent('Just saying hello');
            
            expect(result).toBe('Unknown_Intent');
        });
        
        it('should throw ExternalServiceError on API error', async () => {
            // Setup mock error
            const apiError = new Error('API error');
            mockOpenAI.chat.completions.create.mockRejectedValueOnce(apiError);
            
            await expect(openAIService.detectIntent('Test message'))
                .rejects.toThrow(ExternalServiceError);
            
            expect(console.error).toHaveBeenCalledWith('OpenAI Error in detectIntent:', apiError);
        });
    });
    
    describe('detectIntentAndHandle', () => {
        it('should return detected intent', async () => {
            // Mock detectIntent to return a valid intent
            jest.spyOn(openAIService, 'detectIntent').mockResolvedValueOnce('Book_Appointment');
            
            const result = await openAIService.detectIntentAndHandle('Book me an appointment', '+1234567890');
            
            expect(result).toBe('Book_Appointment');
            expect(openAIService.detectIntent).toHaveBeenCalledWith('Book me an appointment');
        });
        
        it('should return default message for Unknown_Intent', async () => {
            // Mock detectIntent to return Unknown_Intent
            jest.spyOn(openAIService, 'detectIntent').mockResolvedValueOnce('Unknown_Intent');
            
            const result = await openAIService.detectIntentAndHandle('Just chatting', '+1234567890');
            
            expect(result).toBe('No action required.');
        });
        
        it('should throw ExternalServiceError on error', async () => {
            // Mock detectIntent to throw an error
            const apiError = new Error('API error');
            jest.spyOn(openAIService, 'detectIntent').mockRejectedValueOnce(apiError);
            
            await expect(openAIService.detectIntentAndHandle('Test message', '+1234567890'))
                .rejects.toThrow(ExternalServiceError);
            
            expect(console.error).toHaveBeenCalledWith('OpenAI Error in detectIntentAndHandle:', apiError);
        });
    });
    
    describe('getResponse', () => {
        it('should get response without system message', async () => {
            // Setup mock response
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: 'This is a response'
                        }
                    }
                ]
            };
            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);
            
            const result = await openAIService.getResponse('Hello');
            
            expect(result).toBe('This is a response');
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
                model: 'gpt-4-turbo',
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 0.7,
                max_tokens: 150
            });
        });
        
        it('should get response with system message', async () => {
            // Setup mock response
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: 'This is a response'
                        }
                    }
                ]
            };
            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);
            
            const result = await openAIService.getResponse('Hello', 'You are a helpful assistant');
            
            expect(result).toBe('This is a response');
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
                model: 'gpt-4-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'Hello' }
                ],
                temperature: 0.7,
                max_tokens: 150
            });
        });
        
        it('should throw ExternalServiceError on API error', async () => {
            // Setup mock error
            const apiError = new Error('API error');
            mockOpenAI.chat.completions.create.mockRejectedValueOnce(apiError);
            
            await expect(openAIService.getResponse('Hello'))
                .rejects.toThrow(ExternalServiceError);
            
            expect(console.error).toHaveBeenCalledWith('OpenAI Error in getResponse:', apiError);
        });
    });
    
    describe('extractAppointmentTime', () => {
        const withArguments = (args) => ({
            choices: [{ message: { function_call: { name: 'extract_appointment_time', arguments: args } } }]
        });

        it('should force the extraction function and return the ISO time', async () => {
            mockOpenAI.chat.completions.create.mockResolvedValue(withArguments('{"appointment_time":"2025-04-15T10:00:00-07:00"}'));

            const result = await openAIService.extractAppointmentTime('tomorrow at 10', 'America/Los_Angeles');

            expect(result).toBe('2025-04-15T10:00:00-07:00');
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({
                function_call: { name: 'extract_appointment_time' },
                messages: [
                    expect.objectContaining({ role: 'system', content: expect.stringContaining('America/Los_Angeles') }),
                    { role: 'user', content: 'tomorrow at 10' }
                ]
            }));
        });

        it('should return null when no time was mentioned', async () => {
            mockOpenAI.chat.completions.create.mockResolvedValue(withArguments('{}'));

            await expect(openAIService.extractAppointmentTime('I want to book', 'UTC')).resolves.toBeNull();
        });

        it('should return null for a date without a clock time', async () => {
            mockOpenAI.chat.completions.create.mockResolvedValue(withArguments('{"appointment_time":"2025-04-18"}'));

            await expect(openAIService.extractAppointmentTime('next Friday', 'UTC')).resolves.toBeNull();
        });

        it('should return null for an unparseable time', async () => {
            mockOpenAI.chat.completions.create.mockResolvedValue(withArguments('{"appointment_time":"sometime soon"}'));

            await expect(openAIService.extractAppointmentTime('soon', 'UTC')).resolves.toBeNull();
        });

        it('should return null when the model skips the function call', async () => {
            mockOpenAI.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

            await expect(openAIService.extractAppointmentTime('hi', 'UTC')).resolves.toBeNull();
        });

        it('should throw ExternalServiceError on API error', async () => {
            mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

            await expect(openAIService.extractAppointmentTime('tomorrow', 'UTC'))
                .rejects.toThrow(ExternalServiceError);
        });
    });

    describe('isGoodbye', () => {
        it('should return true for goodbye message', async () => {
            // Setup mock response
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: 'true'
                        }
                    }
                ]
            };
            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);
            
            const result = await openAIService.isGoodbye('Goodbye');
            
            expect(result).toBe(true);
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
                model: 'gpt-4-turbo',
                messages: [
                    { role: 'system', content: 'Determine if the text is a goodbye message. Respond with true or false.' },
                    { role: 'user', content: 'Goodbye' }
                ],
                temperature: 0.3,
                max_tokens: 10
            });
        });
        
        it('should return false for non-goodbye message', async () => {
            // Setup mock response
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: 'false'
                        }
                    }
                ]
            };
            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);
            
            const result = await openAIService.isGoodbye('Hello');
            
            expect(result).toBe(false);
        });
        
        it('should throw ExternalServiceError on API error', async () => {
            // Setup mock error
            const apiError = new Error('API error');
            mockOpenAI.chat.completions.create.mockRejectedValueOnce(apiError);
            
            await expect(openAIService.isGoodbye('Goodbye'))
                .rejects.toThrow(ExternalServiceError);
            
            expect(console.error).toHaveBeenCalledWith('OpenAI Error in isGoodbye:', apiError);
        });
    });
});
