import { CallHandler } from '../../handlers/CallHandler';
import { SpeechClient } from '@google-cloud/speech';
import { wsErrorHandler } from '../../middleware/errorHandler';
import { ExternalServiceError } from '../../services/error/AppError.js';

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

// Mock the factories
jest.mock('../../services/llm/LLMServiceFactory');
jest.mock('../../services/business/BusinessServiceFactory');

// Build a Google streamingRecognize data event
const speechData = (transcript, isFinal = true) => ({
    results: [{ alternatives: [{ transcript }], isFinal }],
});

const startMessage = JSON.stringify({
    event: 'start',
    streamSid: 'stream123',
    start: {
        customParameters: { caller_id: 'user', phone_number_sid: 'PNsid', host: 'host.com' },
        callSid: 'CAcall'
    }
});

describe('CallHandler - Additional Tests', () => {
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

    const createHandler = (ws) => new CallHandler(ws, {
        logger: mockLogger,
        llmService: mockLlmService,
        businessService: mockBusinessService,
        languageService: mockLanguageService,
        conversationService: mockConversationService,
        twilioService: mockTwilioService
    });

    beforeEach(() => {
        jest.clearAllMocks();

        mockWs = {
            send: jest.fn((data, callback) => {
                if (callback) callback();
            }),
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

        handler = createHandler(mockWs);
    });

    test('handleTranscriberData should log trace for interim results', async () => {
        await emitEvent(handler.googleStream, 'data', speechData('partial text', false));

        expect(mockLogger.trace).toHaveBeenCalledWith({ transcript: 'partial text' }, 'Partial transcript received.');
        expect(mockLanguageService.detectLanguage).not.toHaveBeenCalled();
    });

    test('handleTranscriberData should ignore empty transcripts', async () => {
        await emitEvent(handler.googleStream, 'data', { results: [] });
        await emitEvent(handler.googleStream, 'data', speechData('', true));

        expect(mockLogger.trace).not.toHaveBeenCalled();
        expect(mockLanguageService.detectLanguage).not.toHaveBeenCalled();
    });

    test('should switch transcriber language after two consecutive non-English messages', async () => {
        await emitEvent(mockWs, 'message', startMessage);
        mockLanguageService.detectLanguage.mockResolvedValue('vi');
        const firstStream = handler.googleStream;

        // First message: language noted but no switch yet
        await emitEvent(handler.googleStream, 'data', speechData('Xin chào'));
        expect(handler.currentLanguage).toBe('en');
        expect(handler.speechClient.streamingRecognize).toHaveBeenCalledTimes(1);
        expect(mockLanguageService.translate).not.toHaveBeenCalled();

        // Second message: switch to Vietnamese
        await emitEvent(handler.googleStream, 'data', speechData('Tôi muốn đặt lịch'));

        expect(handler.currentLanguage).toBe('vi');
        expect(firstStream.end).toHaveBeenCalledTimes(1);
        expect(handler.googleStream).not.toBe(firstStream);
        expect(handler.speechClient.streamingRecognize).toHaveBeenCalledTimes(2);
        expect(handler.speechClient.streamingRecognize).toHaveBeenLastCalledWith(
            expect.objectContaining({ config: expect.objectContaining({ languageCode: 'vi-VN' }) })
        );
        expect(mockBusinessService.getSystemPrompt).toHaveBeenLastCalledWith('vi', 'PNsid');
        expect(mockLanguageService.translate).toHaveBeenCalledWith('Mock AI Response', 'vi');
        expect(mockTwilioService.getTwilioMessage).toHaveBeenLastCalledWith('Mock AI Response [translated to vi]', 'stream123', 'vi');
    });

    test('switchLanguage should fall back to en-US for unknown language codes', async () => {
        await handler.switchLanguage('xx');

        expect(handler.speechClient.streamingRecognize).toHaveBeenLastCalledWith(
            expect.objectContaining({ config: expect.objectContaining({ languageCode: 'en-US' }) })
        );
    });

    test('switchLanguage should skip when a switch is already pending', async () => {
        handler.pendingLanguageSwitch = true;

        await handler.switchLanguage('vi');

        expect(mockLogger.debug).toHaveBeenCalledWith('Language switch already in progress, skipping');
        expect(handler.speechClient.streamingRecognize).toHaveBeenCalledTimes(1);
        expect(handler.currentLanguage).toBe('en');
    });

    test('switchLanguage should report errors and reset the pending flag', async () => {
        const streamError = new Error('stream error');
        handler.speechClient.streamingRecognize.mockImplementationOnce(() => { throw streamError; });

        await handler.switchLanguage('vi');

        expect(mockLogger.error).toHaveBeenCalledWith({ err: streamError }, 'Failed to switch language');
        expect(wsErrorHandler).toHaveBeenCalledWith(streamError, mockWs);
        expect(handler.pendingLanguageSwitch).toBe(false);
    });

    test('handleTranscriberFinal should handle goodbye response', async () => {
        await emitEvent(mockWs, 'message', startMessage);
        mockLlmService.isGoodbye.mockResolvedValueOnce(true);

        const originalSetTimeout = global.setTimeout;
        global.setTimeout = jest.fn((callback) => {
            callback(); // Execute immediately
            return 123;
        });

        try {
            await emitEvent(handler.googleStream, 'data', speechData('Goodbye'));

            expect(mockLlmService.isGoodbye).toHaveBeenCalledWith('Goodbye');
            expect(mockBusinessService.getGoodbyePrompt).toHaveBeenCalledWith('en', 'PNsid');
            expect(global.setTimeout).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
            expect(mockWs.close).toHaveBeenCalled();
        } finally {
            global.setTimeout = originalSetTimeout;
        }
    });

    test('handleTranscriberFinal should handle WebSocket send error', async () => {
        await emitEvent(mockWs, 'message', startMessage);

        const sendError = new Error('WebSocket send error');
        mockWs.send = jest.fn((data, callback) => {
            if (callback) callback(sendError);
        });

        await emitEvent(handler.googleStream, 'data', speechData('Hello'));

        expect(wsErrorHandler).toHaveBeenCalledWith(expect.any(ExternalServiceError), mockWs);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.any(Error) }),
            'Error processing final transcript.'
        );
    });

    test('handleTranscriberError should log error and call wsErrorHandler', () => {
        const error = new Error('Transcriber error');

        emitEvent(handler.googleStream, 'error', error);

        expect(mockLogger.error).toHaveBeenCalledWith({ err: error }, 'Google Speech-to-Text error.');
        expect(wsErrorHandler).toHaveBeenCalledWith(
            expect.objectContaining({ service: 'Transcription', message: 'Transcriber error' }),
            mockWs
        );
    });

    test('handleWsMessage should handle connected event', async () => {
        await emitEvent(mockWs, 'message', JSON.stringify({ event: 'connected' }));

        expect(mockLogger.info).toHaveBeenCalledWith('Twilio media stream signaling connected.');
    });

    test('handleWsMessage should handle stop event', async () => {
        await emitEvent(mockWs, 'message', JSON.stringify({ event: 'stop' }));

        expect(mockLogger.info).toHaveBeenCalledWith('Twilio media stream stopped.');
    });

    test('handleWsMessage should handle unknown event', async () => {
        await emitEvent(mockWs, 'message', JSON.stringify({ event: 'unknown' }));

        expect(mockLogger.warn).toHaveBeenCalledWith({ event: 'unknown' }, 'Received unknown WebSocket event type');
    });

    test('handleWsMessage should handle JSON parse error', async () => {
        await emitEvent(mockWs, 'message', 'not valid json');

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: expect.any(Error), rawMessage: 'not valid json' }),
            'Error processing WebSocket message.'
        );
        expect(wsErrorHandler).toHaveBeenCalled();
    });

    test('handleWsClose should handle error when saving conversation', async () => {
        handler.conversationLog.push({ role: 'user', content: 'test' });
        handler.streamSid = 'stream123';
        const saveError = new Error('Save error');
        mockConversationService.saveConversation.mockRejectedValueOnce(saveError);

        await emitEvent(mockWs, 'close');

        expect(handler.googleStream.destroy).toHaveBeenCalled();
        expect(mockConversationService.saveConversation).toHaveBeenCalledWith(handler.conversationLog, 'stream123');
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ err: saveError, streamSid: 'stream123' }),
            'Failed to save conversation log.'
        );
    });

    test('handleWsClose should not save an empty conversation', async () => {
        await emitEvent(mockWs, 'close');

        expect(mockConversationService.saveConversation).not.toHaveBeenCalled();
    });

    test('initialize should handle Google Speech stream creation error', () => {
        const streamError = new Error('Stream creation error');
        SpeechClient.mockImplementationOnce(() => ({
            streamingRecognize: jest.fn(() => { throw streamError; }),
        }));
        const newMockWs = { send: jest.fn(), close: jest.fn(), on: jest.fn(), readyState: 1 };

        createHandler(newMockWs);

        expect(mockLogger.error).toHaveBeenCalledWith({ err: streamError }, 'Failed to initialize Google Speech stream.');
        expect(wsErrorHandler).toHaveBeenCalledWith(streamError, newMockWs);
        expect(newMockWs.on).not.toHaveBeenCalled();
    });
});
