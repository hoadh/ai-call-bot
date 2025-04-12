import { CallHandler } from '../../handlers/CallHandler';
import { RealtimeTranscriber } from 'assemblyai';
import { wsErrorHandler } from '../../middleware/errorHandler';
import { ExternalServiceError } from '../../services/error/AppError.js';

// --- Mocks ---
jest.mock('assemblyai', () => ({
    RealtimeTranscriber: jest.fn().mockImplementation(() => {
        return {
            connect: jest.fn(() => Promise.resolve()),
            on: jest.fn(),
            sendAudio: jest.fn(),
            close: jest.fn(() => Promise.resolve()),
        };
    }),
}));

jest.mock('../../middleware/errorHandler.js', () => ({
    wsErrorHandler: jest.fn(),
}));

jest.mock('../../config/logger');

// Mock services
jest.mock('../../services/llm/OpenAIService');
jest.mock('../../services/language/LanguageService');
jest.mock('../../services/conversation/ConversationService');
jest.mock('../../services/twilio/TwilioService');
jest.mock('../../services/business/NailSalonService'); 

// Mock the factories
jest.mock('../../services/llm/LLMServiceFactory');
jest.mock('../../services/business/BusinessServiceFactory');

describe('CallHandler - Additional Tests', () => {
    let mockWs;
    let mockLogger;
    let mockLlmService;
    let mockBusinessService;
    let mockLanguageService;
    let mockConversationService;
    let mockTwilioService;
    let mockTranscriberInstance;
    let handler;

    // Helper to simulate events
    const emitEvent = (emitter, eventName, ...args) => {
        const handler = emitter.on.mock.calls.find(call => call[0] === eventName)?.[1];
        if (handler) {
            return handler(...args);
        }
        throw new Error(`No handler registered for event ${eventName} on mock`);
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock WebSocket
        mockWs = {
            send: jest.fn((data, callback) => {
                if (callback) callback();
            }),
            close: jest.fn(),
            on: jest.fn(),
            readyState: 1, // Simulate OPEN state initially
        };

        // Mock Logger
        mockLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            trace: jest.fn(),
            child: jest.fn().mockReturnThis(), // Simple child mock
        };

        // Mock Service Instances
        mockLlmService = {
            detectIntent: jest.fn().mockResolvedValue('MockIntent'),
            detectIntentAndHandle: jest.fn().mockResolvedValue('No action required.'),
            getResponse: jest.fn().mockResolvedValue('Mock AI Response'),
            isGoodbye: jest.fn().mockResolvedValue(false),
        };
        mockBusinessService = {
            getSystemPrompt: jest.fn().mockResolvedValue('Mock Guideline'),
            getGoodbyePrompt: jest.fn().mockResolvedValue('Mock Goodbye Guideline'),
            handleIntent: jest.fn().mockResolvedValue({ shouldTransfer: false, response: 'Mock Business Response' }),
            getTransferNumber: jest.fn().mockReturnValue('+1112223333'),
            getCustomerInfo: jest.fn().mockResolvedValue({ name: 'Mock Customer' }),
            getWelcomeMessage: jest.fn().mockResolvedValue('Mock Welcome'),
        };
        mockLanguageService = {
            detectLanguage: jest.fn().mockResolvedValue('en'),
            translate: jest.fn((text, lang) => Promise.resolve(`${text} [translated to ${lang}]`)),
        };
        mockConversationService = {
            saveConversation: jest.fn().mockResolvedValue(undefined),
        };
        mockTwilioService = {
            getTwilioMessage: jest.fn().mockResolvedValue(JSON.stringify({ event: 'media', payload: 'mockBase64' })),
            forwardCall: jest.fn().mockResolvedValue(undefined),
        };

        // Instantiate CallHandler
        handler = new CallHandler(mockWs, { 
            logger: mockLogger, 
            llmService: mockLlmService,
            businessService: mockBusinessService,
            languageService: mockLanguageService,
            conversationService: mockConversationService,
            twilioService: mockTwilioService
        });
        
        // Get the mock instance
        if (RealtimeTranscriber.mock.results.length !== 1 || RealtimeTranscriber.mock.results[0].type !== 'return') {
            throw new Error(`Expected RealtimeTranscriber constructor mock to have been called and returned once.`);
        }
        mockTranscriberInstance = RealtimeTranscriber.mock.results[0].value;

        if (!mockTranscriberInstance) {
            throw new Error("Mock Transcriber instance was not created or retrieved correctly");
        }
    });

    test('handleTranscriberOpen should log info', async () => {
        await emitEvent(mockTranscriberInstance, 'open');
        expect(mockLogger.info).toHaveBeenCalledWith('Transcriber connection open.');
    });

    test('handleTranscriberPartial should log trace for non-empty text', async () => {
        await emitEvent(mockTranscriberInstance, 'transcript.partial', { text: 'partial text' });
        expect(mockLogger.trace).toHaveBeenCalledWith(
            { transcript: 'partial text' }, 
            "Partial transcript received"
        );
    });

    test('handleTranscriberPartial should not log for empty text', async () => {
        await emitEvent(mockTranscriberInstance, 'transcript.partial', { text: '' });
        expect(mockLogger.trace).not.toHaveBeenCalled();
    });

    test('handleTranscriberFinal should handle non-English language', async () => {
        // Simulate start event first to set call details
        const startMessage = JSON.stringify({ 
            event: 'start', 
            streamSid: 'stream123', 
            start: { 
                customParameters: { 
                    caller_id: 'user', 
                    phone_number_sid: 'PNsid',
                    host: 'host.com'
                }, 
                callSid: 'CAcall' 
            } 
        });
        await emitEvent(mockWs, 'message', startMessage);
        
        // Set language detection to return non-English
        mockLanguageService.detectLanguage.mockResolvedValueOnce('vi');
        
        const finalTranscript = { text: 'Xin chào' };
        
        await emitEvent(mockTranscriberInstance, 'transcript.final', finalTranscript);

        expect(mockLanguageService.detectLanguage).toHaveBeenCalledWith('Xin chào');
        expect(mockLlmService.getResponse).toHaveBeenCalled();
        expect(mockLanguageService.translate).toHaveBeenCalledWith('Mock AI Response', 'vi');
    });

    test('handleTranscriberFinal should handle goodbye response', async () => {
        // Simulate start event first to set call details
        const startMessage = JSON.stringify({ 
            event: 'start', 
            streamSid: 'stream123', 
            start: { 
                customParameters: { 
                    caller_id: 'user', 
                    phone_number_sid: 'PNsid',
                    host: 'host.com'
                }, 
                callSid: 'CAcall' 
            } 
        });
        await emitEvent(mockWs, 'message', startMessage);
        
        // Set isGoodbye to return true
        mockLlmService.isGoodbye.mockResolvedValueOnce(true);
        
        const finalTranscript = { text: 'Goodbye' };
        
        // Mock setTimeout
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = jest.fn((callback, delay) => {
            callback(); // Execute the callback immediately
            return 123; // Return a timeout ID
        });
        
        await emitEvent(mockTranscriberInstance, 'transcript.final', finalTranscript);

        expect(mockLlmService.isGoodbye).toHaveBeenCalledWith('Goodbye');
        expect(mockBusinessService.getGoodbyePrompt).toHaveBeenCalledWith('en', 'PNsid');
        
        // Verify setTimeout was called
        expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
        
        // Verify ws.close was called
        expect(mockWs.close).toHaveBeenCalled();
        
        // Restore original setTimeout
        global.setTimeout = originalSetTimeout;
    });

    test('handleTranscriberFinal should handle WebSocket send error', async () => {
        // Simulate start event first to set call details
        const startMessage = JSON.stringify({ 
            event: 'start', 
            streamSid: 'stream123', 
            start: { 
                customParameters: { 
                    caller_id: 'user', 
                    phone_number_sid: 'PNsid',
                    host: 'host.com'
                }, 
                callSid: 'CAcall' 
            } 
        });
        await emitEvent(mockWs, 'message', startMessage);
        
        // Mock WebSocket send to call callback with error
        const sendError = new Error('WebSocket send error');
        mockWs.send = jest.fn((data, callback) => {
            if (callback) callback(sendError);
        });
        
        const finalTranscript = { text: 'Hello' };
        
        // This should throw an error that gets caught in the try/catch
        await emitEvent(mockTranscriberInstance, 'transcript.final', finalTranscript);
        
        // The error should be passed to wsErrorHandler
        expect(wsErrorHandler).toHaveBeenCalledWith(expect.any(ExternalServiceError), mockWs);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.any(Error) }), 
            'Error processing final transcript.'
        );
    });

    test('handleTranscriberError should log error and call wsErrorHandler', async () => {
        const error = new Error('Transcriber error');
        
        await emitEvent(mockTranscriberInstance, 'error', error);
        
        expect(mockLogger.error).toHaveBeenCalledWith(
            { err: error }, 
            'Transcriber error.'
        );
        expect(wsErrorHandler).toHaveBeenCalledWith(
            expect.objectContaining({ 
                message: expect.stringContaining('Transcriber error')
            }), 
            mockWs
        );
    });

    test('handleTranscriberClose should log info', async () => {
        await emitEvent(mockTranscriberInstance, 'close');
        expect(mockLogger.info).toHaveBeenCalledWith('Transcriber connection closed.');
    });

    test('handleWsMessage should handle connected event', async () => {
        const connectedMessage = JSON.stringify({
            event: 'connected'
        });
        
        await emitEvent(mockWs, 'message', connectedMessage);
        
        expect(mockLogger.info).toHaveBeenCalledWith('Twilio media stream signaling connected.');
    });

    test('handleWsMessage should handle stop event', async () => {
        const stopMessage = JSON.stringify({
            event: 'stop'
        });
        
        await emitEvent(mockWs, 'message', stopMessage);
        
        expect(mockLogger.info).toHaveBeenCalledWith('Twilio media stream stopped.');
    });

    test('handleWsMessage should handle unknown event', async () => {
        const unknownMessage = JSON.stringify({
            event: 'unknown'
        });
        
        await emitEvent(mockWs, 'message', unknownMessage);
        
        expect(mockLogger.warn).toHaveBeenCalledWith(
            { event: 'unknown' }, 
            'Received unknown WebSocket event type'
        );
    });

    test('handleWsMessage should handle media event before transcriber connection', async () => {
        // Set transcriberConnectionPromise to null to simulate the condition
        handler.transcriberConnectionPromise = null;
        
        const mediaMessage = JSON.stringify({
            event: 'media',
            media: {
                payload: 'base64data'
            }
        });
        
        await emitEvent(mockWs, 'message', mediaMessage);
        
        expect(mockLogger.warn).toHaveBeenCalledWith('Received media before transcriber connection promise exists.');
        expect(mockTranscriberInstance.sendAudio).not.toHaveBeenCalled();
    });

    test('handleWsMessage should handle JSON parse error', async () => {
        const invalidMessage = 'not valid json';
        
        await emitEvent(mockWs, 'message', invalidMessage);
        
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ 
                err: expect.any(Error),
                rawMessage: 'not valid json'
            }), 
            'Error processing WebSocket message.'
        );
        expect(wsErrorHandler).toHaveBeenCalled();
    });

    test('handleWsClose should handle error when saving conversation', async () => {
        // Add something to the log
        handler.conversationLog.push({ role: 'user', content: 'test' });
        handler.streamSid = 'stream123'; // Set streamSid
        
        // Mock saveConversation to throw error
        const saveError = new Error('Save error');
        mockConversationService.saveConversation.mockRejectedValueOnce(saveError);
        
        await emitEvent(mockWs, 'close');
        
        expect(mockTranscriberInstance.close).toHaveBeenCalled();
        expect(mockConversationService.saveConversation).toHaveBeenCalledWith(
            handler.conversationLog, 
            'stream123'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ 
                err: saveError,
                streamSid: 'stream123'
            }), 
            'Failed to save conversation log.'
        );
    });

    test('initialize should handle transcriber connection error', async () => {
        // Reset the mock implementation
        RealtimeTranscriber.mockReset();
        
        // Create a new mock that will throw on connect
        const connectError = new Error('Connection error');
        RealtimeTranscriber.mockImplementation(() => ({
            connect: jest.fn().mockRejectedValue(connectError),
            on: jest.fn(),
        }));
        
        // Create a new handler with the error mock
        const newMockWs = {
            send: jest.fn(),
            close: jest.fn(),
            on: jest.fn(),
            readyState: 1,
        };
        
        // Create a new handler
        const errorHandler = new CallHandler(newMockWs, { 
            logger: mockLogger, 
            llmService: mockLlmService,
            businessService: mockBusinessService,
            languageService: mockLanguageService,
            conversationService: mockConversationService,
            twilioService: mockTwilioService
        });
        
        // Manually trigger the error handling by calling the catch handler
        // This is a workaround since the promise rejection happens asynchronously
        // and we can't easily wait for it in the test
        const connectPromise = errorHandler.transcriberConnectionPromise;
        if (connectPromise) {
            try {
                await connectPromise;
            } catch (error) {
                // This should trigger the error handling in the initialize method
            }
        }
        
        // Verify the error was handled correctly
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: connectError }), 
            'Transcriber connection failed.'
        );
        expect(wsErrorHandler).toHaveBeenCalledWith(connectError, newMockWs);
    }, 1000); // Set a timeout of 1 second for this test
});
