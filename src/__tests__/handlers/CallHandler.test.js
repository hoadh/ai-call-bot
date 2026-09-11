import { CallHandler } from '../../handlers/CallHandler';
import { SpeechClient } from '@google-cloud/speech';
import { LLMServiceFactory } from '../../services/llm/LLMServiceFactory.js';
import { BusinessServiceFactory } from '../../services/business/BusinessServiceFactory.js';

// --- Mocks ---
// The mocked recognize stream is a real PassThrough so CallHandler can pipe()
// audio into it; on/end/destroy are spied so tests can assert and emit events.
jest.mock('@google-cloud/speech', () => {
    const { PassThrough } = jest.requireActual('stream');
    return {
        SpeechClient: jest.fn().mockImplementation(() => ({
            streamingRecognize: jest.fn(() => {
                const stream = new PassThrough();
                jest.spyOn(stream, 'on');
                jest.spyOn(stream, 'end');
                jest.spyOn(stream, 'destroy');
                return stream;
            }),
        })),
    };
});
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

// Mock the factories to control service instance creation
jest.mock('../../services/llm/LLMServiceFactory');
jest.mock('../../services/business/BusinessServiceFactory');

// Build a Google streamingRecognize data event
const speechData = (transcript, isFinal = true) => ({
    results: [{ alternatives: [{ transcript }], isFinal }],
});

describe('CallHandler', () => {
    let mockWs;
    let mockLogger;
    let mockLlmService;
    let mockBusinessService;
    let mockLanguageService;
    let mockConversationService;
    let mockTwilioService;
    let handler;

    // Helper to simulate events registered via emitter.on(...)
    const emitEvent = (emitter, eventName, ...args) => {
        const handler = emitter.on.mock.calls.find(call => call[0] === eventName)?.[1];
        if (handler) {
            return handler(...args);
        }
        throw new Error(`No handler registered for event ${eventName} on mock`);
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockWs = {
            send: jest.fn(),
            close: jest.fn(),
            on: jest.fn(),
            readyState: 1,
        };

        mockLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            trace: jest.fn(),
            child: jest.fn().mockReturnThis(),
        };

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

        LLMServiceFactory.createService.mockReturnValue(mockLlmService);
        BusinessServiceFactory.createService.mockReturnValue(mockBusinessService);

        handler = new CallHandler(mockWs, {
            logger: mockLogger,
            llmService: mockLlmService,
            businessService: mockBusinessService,
            languageService: mockLanguageService,
            conversationService: mockConversationService,
            twilioService: mockTwilioService
        });
    });

    test('constructor should open a Google Speech stream and register listeners', () => {
        expect(SpeechClient).toHaveBeenCalledTimes(1);
        expect(handler.speechClient.streamingRecognize).toHaveBeenCalledTimes(1);
        expect(handler.speechClient.streamingRecognize).toHaveBeenCalledWith({
            config: {
                encoding: 'MULAW',
                sampleRateHertz: 8000,
                languageCode: 'en-US',
                enableAutomaticPunctuation: true
            },
            interimResults: true,
        });
        expect(handler.googleStream.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(handler.googleStream.on).toHaveBeenCalledWith('data', expect.any(Function));
        expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
        expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
        expect(mockLogger.info).toHaveBeenCalledWith('CallHandler initialized.');
        expect(mockLogger.info).toHaveBeenCalledWith('Google Speech stream initialized.');
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

    test('handleWsMessage - media event should pipe audio into the Google Speech stream', async () => {
        const mediaPayload = Buffer.from('audio chunk').toString('base64');
        const mediaMessage = JSON.stringify({ event: 'media', media: { payload: mediaPayload } });

        const received = new Promise(resolve => handler.googleStream.once('data', resolve));
        await emitEvent(mockWs, 'message', mediaMessage);

        expect(mockLogger.trace).toHaveBeenCalledWith('Received media payload.');
        await expect(received).resolves.toEqual(Buffer.from(mediaPayload, 'base64'));
    });

    test('final transcript should process, call services, and send AI response', async () => {
        const startMessage = JSON.stringify({ event: 'start', streamSid: 'stream123', start: { customParameters: { caller_id: 'user', phone_number_sid: 'PNsid' }, callSid: 'CAcall' } });
        await emitEvent(mockWs, 'message', startMessage);

        mockBusinessService.handleIntent.mockResolvedValue({ shouldTransfer: false, response: 'OK, appointment booked.' });
        mockLlmService.detectIntentAndHandle.mockResolvedValue('BookAppointment');

        await emitEvent(handler.googleStream, 'data', speechData('Book appointment'));

        expect(mockLanguageService.detectLanguage).toHaveBeenCalledWith('Book appointment');
        expect(mockLlmService.detectIntent).toHaveBeenCalledWith('Book appointment');
        expect(mockBusinessService.handleIntent).toHaveBeenCalledWith('MockIntent', 'Book appointment', 'user', { name: 'Mock Customer' }, 'en', 'PNsid');
        expect(mockTwilioService.getTwilioMessage).toHaveBeenCalledWith('OK, appointment booked.', 'stream123', 'en');
        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ event: 'media', payload: 'mockBase64' }), expect.any(Function));
        expect(handler.conversationLog).toContainEqual({ role: 'user', content: 'Book appointment' });
        expect(handler.conversationLog).toContainEqual({ role: 'AI', content: 'OK, appointment booked.' });
    });

    test('final transcript should initiate transfer if business logic dictates', async () => {
        const startMessage = JSON.stringify({ event: 'start', streamSid: 'stream123', start: { customParameters: { caller_id: 'user', phone_number_sid: 'PNsid', host: 'host.com' }, callSid: 'CAcall' } });
        await emitEvent(mockWs, 'message', startMessage);
        mockWs.send.mockClear(); // Ignore the welcome message

        mockBusinessService.handleIntent.mockResolvedValue({ shouldTransfer: true, response: null });
        mockLlmService.detectIntentAndHandle.mockResolvedValue('TransferIntent');

        await emitEvent(handler.googleStream, 'data', speechData('Speak to human'));

        expect(mockLogger.info).toHaveBeenCalledWith('Initiating call transfer...');
        expect(mockBusinessService.getTransferNumber).toHaveBeenCalledWith('PNsid');
        expect(mockTwilioService.forwardCall).toHaveBeenCalledWith('CAcall', 'host.com', '+1112223333');
        expect(mockWs.send).not.toHaveBeenCalled();
    });

    test('handleWsClose should tear down the speech stream and save conversation', async () => {
        handler.conversationLog.push({ role: 'user', content: 'test' });
        handler.streamSid = 'stream123';
        const googleStream = handler.googleStream;

        await emitEvent(mockWs, 'close');

        expect(handler.audioStream.writableEnded).toBe(true);
        expect(googleStream.destroy).toHaveBeenCalledTimes(1);
        expect(mockConversationService.saveConversation).toHaveBeenCalledWith(handler.conversationLog, 'stream123');
        expect(mockLogger.info).toHaveBeenCalledWith('WebSocket disconnected.');
    });
});
