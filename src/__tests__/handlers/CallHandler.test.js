import { CallHandler } from '../../handlers/CallHandler';
import { RealtimeTranscriber } from 'assemblyai';
import { wsErrorHandler } from '../../middleware/errorHandler';
import { LLMServiceFactory } from '../../services/llm/LLMServiceFactory.js'; // Might need mocks for these
import { BusinessServiceFactory } from '../../services/business/BusinessServiceFactory.js';
import { LanguageService } from '../../services/language/LanguageService.js';
import { ConversationService } from '../../services/conversation/ConversationService.js';
import { TwilioService } from '../../services/twilio/TwilioService.js';
import logger from '../../config/logger.js';

// --- Mocks ---
jest.mock('assemblyai', () => ({
    RealtimeTranscriber: jest.fn().mockImplementation(() => {
        // Return the mock instance structure directly
        return {
            connect: jest.fn(() => Promise.resolve()),
            on: jest.fn(),
            sendAudio: jest.fn(),
            close: jest.fn(() => Promise.resolve()),
        };
        // Cannot assign to external variable here
        // lastTranscriberInstance = instance; 
        // return instance;
    }),
    // Remove helper function
    // __getLastTranscriberInstance: () => lastTranscriberInstance, 
}));
jest.mock('../../middleware/errorHandler.js', () => ({
    wsErrorHandler: jest.fn(),
}));
jest.mock('../../config/logger');

// Mock services (replace with more specific mocks as needed)
jest.mock('../../services/llm/OpenAIService');
jest.mock('../../services/language/LanguageService');
jest.mock('../../services/conversation/ConversationService');
jest.mock('../../services/twilio/TwilioService');
jest.mock('../../services/business/NailSalonService'); 

// Mock the factories to control service instance creation
jest.mock('../../services/llm/LLMServiceFactory');
jest.mock('../../services/business/BusinessServiceFactory');


describe('CallHandler', () => {
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
        // Remove reset of external variable
        // lastTranscriberInstance = null; 

        // Mock WebSocket
        mockWs = {
            send: jest.fn(),
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
            detectIntentAndHandle: jest.fn().mockResolvedValue('No action required.'), // Default mock
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

        // Mock Factory return values
        LLMServiceFactory.createService.mockReturnValue(mockLlmService);
        BusinessServiceFactory.createService.mockReturnValue(mockBusinessService);
        
        // Instantiate CallHandler (this triggers the RealtimeTranscriber mock constructor)
        handler = new CallHandler(mockWs, { 
            logger: mockLogger, 
            llmService: mockLlmService,
            businessService: mockBusinessService,
            languageService: mockLanguageService,
            conversationService: mockConversationService,
            twilioService: mockTwilioService
        });
        
        // Get the mock instance created by the CallHandler via Jest's metadata
        // Ensure CallHandler actually calls the constructor exactly once as expected
        // Use mock.results instead of mock.instances
        if (RealtimeTranscriber.mock.results.length !== 1 || RealtimeTranscriber.mock.results[0].type !== 'return') {
             // Add more robust check before accessing results
             throw new Error(`Expected RealtimeTranscriber constructor mock to have been called and returned once. Results: ${JSON.stringify(RealtimeTranscriber.mock.results)}`);
        }
        // Retrieve the *returned value* from the mock constructor
        mockTranscriberInstance = RealtimeTranscriber.mock.results[0].value; 

        if (!mockTranscriberInstance) {
            throw new Error("Mock Transcriber instance was not created or retrieved correctly");
        }
    });

    test('constructor should initialize transcriber and register listeners', async () => {
        // initialize() is called by the constructor, so no need to await it here explicitly
        // await handler.initialize(); 
        
        // Check that the *instance* we retrieved had its methods called
        // expect(RealtimeTranscriber).toHaveBeenCalledTimes(1); <-- Remove this check
        
        // Assertions below now correctly target the instance used by the handler
        expect(mockTranscriberInstance.connect).toHaveBeenCalledTimes(1);
        expect(mockTranscriberInstance.on).toHaveBeenCalledWith('open', expect.any(Function));
        expect(mockTranscriberInstance.on).toHaveBeenCalledWith('transcript.partial', expect.any(Function));
        expect(mockTranscriberInstance.on).toHaveBeenCalledWith('transcript.final', expect.any(Function));
        expect(mockTranscriberInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(mockTranscriberInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
        expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
        expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
        expect(mockLogger.info).toHaveBeenCalledWith('CallHandler initialized.');
        expect(mockLogger.info).toHaveBeenCalledWith('Transcriber connection established.');
    });

    test('handleWsMessage - start event should log info, get customer info, send welcome message', async () => {
        const startMessage = JSON.stringify({
            event: 'start',
            streamSid: 'stream123',
            start: {
                customParameters: {
                    caller_id: 'client:testuser',
                    phone_number_sid: 'PNsid123',
                    host: 'testhost.com'
                },
                callSid: 'CAcallsid123'
            }
        });

        await emitEvent(mockWs, 'message', startMessage);

        expect(mockLogger.info).toHaveBeenCalledWith('Twilio media stream started.');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ callerId: 'testuser', phoneNumberSid: 'PNsid123', callSid: 'CAcallsid123' }), 'Call started');
        expect(mockBusinessService.getCustomerInfo).toHaveBeenCalledWith('testuser');
        expect(mockBusinessService.getWelcomeMessage).toHaveBeenCalledWith({ name: 'Mock Customer' }, 'en', 'PNsid123');
        expect(mockTwilioService.getTwilioMessage).toHaveBeenCalledWith('Mock Welcome', 'stream123', 'en');
        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ event: 'media', payload: 'mockBase64' }));
        expect(handler.conversationLog).toContainEqual({ role: 'assistant', content: 'Mock Welcome' });
    });

    test('handleWsMessage - media event should send audio to transcriber', async () => {
        // Remove redundant await handler.initialize() - already done by constructor/beforeEach
        // await handler.initialize(); 
        const mediaPayload = Buffer.from('audio chunk').toString('base64');
        const mediaMessage = JSON.stringify({
            event: 'media',
            media: {
                payload: mediaPayload
            }
        });

        await emitEvent(mockWs, 'message', mediaMessage);

        expect(mockLogger.trace).toHaveBeenCalledWith('Received media payload.');
        // Assertion now targets the correct instance
        expect(mockTranscriberInstance.sendAudio).toHaveBeenCalledWith(Buffer.from(mediaPayload, 'base64'));
    });

    test('handleTranscriberFinal should process transcript, call services, and send AI response', async () => {
        // Simulate start event first to set call details
        const startMessage = JSON.stringify({ event: 'start', streamSid: 'stream123', start: { customParameters: { caller_id: 'user', phone_number_sid: 'PNsid' }, callSid: 'CAcall' } });
        await emitEvent(mockWs, 'message', startMessage);
        
        const finalTranscript = { text: 'Book appointment' };
        // Reset mock for specific business response in this test
        mockBusinessService.handleIntent.mockResolvedValue({ shouldTransfer: false, response: 'OK, appointment booked.' })

        // Make llmService require action for this test
        mockLlmService.detectIntentAndHandle.mockResolvedValue('BookAppointment'); 

        // Emit event on the correct mock instance
        await emitEvent(mockTranscriberInstance, 'transcript.final', finalTranscript);

        expect(mockLanguageService.detectLanguage).toHaveBeenCalledWith(finalTranscript.text);
        expect(mockLlmService.detectIntent).toHaveBeenCalledWith(finalTranscript.text);
        // Assuming intentHandlingResult leads to businessService.handleIntent being called
        expect(mockBusinessService.handleIntent).toHaveBeenCalledWith('MockIntent', finalTranscript.text, 'user', { name: 'Mock Customer' }, 'en', 'PNsid');
        expect(mockTwilioService.getTwilioMessage).toHaveBeenCalledWith('OK, appointment booked.', 'stream123', 'en');
        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ event: 'media', payload: 'mockBase64' }));
        expect(handler.conversationLog).toContainEqual({ role: 'user', content: 'Book appointment' });
        expect(handler.conversationLog).toContainEqual({ role: 'AI', content: 'OK, appointment booked.' });
    });

    test('handleTranscriberFinal should initiate transfer if business logic dictates', async () => {
        const startMessage = JSON.stringify({ event: 'start', streamSid: 'stream123', start: { customParameters: { caller_id: 'user', phone_number_sid: 'PNsid', host: 'host.com' }, callSid: 'CAcall' } });
        await emitEvent(mockWs, 'message', startMessage);
        
        // Clear mock calls after the welcome message is sent
        mockWs.send.mockClear(); 
        
        const finalTranscript = { text: 'Speak to human' };
        // Simulate business logic requiring transfer
        mockBusinessService.handleIntent.mockResolvedValue({ shouldTransfer: true, response: null });
        // Simulate LLM detecting an intent that requires action
        mockLlmService.detectIntentAndHandle.mockResolvedValue('TransferIntent'); 

        // Emit event on the correct mock instance
        await emitEvent(mockTranscriberInstance, 'transcript.final', finalTranscript);

        expect(mockLogger.info).toHaveBeenCalledWith("Initiating call transfer...");
        expect(mockBusinessService.getTransferNumber).toHaveBeenCalledWith('PNsid');
        expect(mockTwilioService.forwardCall).toHaveBeenCalledWith('CAcall', 'host.com', '+1112223333');
        // Now assert that send was not called *after* handling the final transcript
        expect(mockWs.send).not.toHaveBeenCalled(); 
    });

    test('handleWsClose should close transcriber and save conversation', async () => {
        // Add something to the log
        handler.conversationLog.push({ role: 'user', content: 'test' });
        handler.streamSid = 'stream123'; // Set streamSid

        await emitEvent(mockWs, 'close');

        // Assertion now targets the correct instance
        expect(mockTranscriberInstance.close).toHaveBeenCalledTimes(1);
        expect(mockConversationService.saveConversation).toHaveBeenCalledWith(handler.conversationLog, 'stream123');
        expect(mockLogger.info).toHaveBeenCalledWith('WebSocket disconnected.');
    });

    // Add more tests: error handling (transcriber error, ws error, save error), language translation path, etc.

}); 