import { TwilioService } from '../../../services/twilio/TwilioService.js';
import { TTSService } from '../../../services/audio/TTSService.js';
// Import the actual function to mock it
import { convertToMulaw as actualConvertToMulaw } from '../../../services/audio/AudioConversionService.js'; 
import twilio from 'twilio';
import config from '../../../config/index.js';
import logger from '../../../config/logger.js';

// Mock dependencies
jest.mock('../../../config/logger.js', () => ({
    // ... standard logger mock ...
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
}));
jest.mock('../../../services/audio/TTSService.js');
jest.mock('../../../services/audio/AudioConversionService.js', () => ({
    convertToMulaw: jest.fn()
}));

// Mock the Twilio client
let mockTwilioCallUpdate = jest.fn(); // Initialize before mock factory
jest.mock('twilio', () => {
    // mockTwilioCallUpdate = jest.fn(); <-- Moved outside
    const mockTwilioClient = {
        calls: jest.fn(() => ({ update: mockTwilioCallUpdate }))
    };
    // The default export of the twilio module is the client factory function
    return jest.fn(() => mockTwilioClient);
});


describe('TwilioService', () => {
    let twilioService;
    let mockLogger;
    let mockTtsServiceInstance;
    let mockConvertToMulaw; // Reference to the mocked function

    beforeEach(() => {
        jest.clearAllMocks();

        mockLogger = { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
        mockTtsServiceInstance = new TTSService(); // Create instance from mocked constructor
        mockConvertToMulaw = actualConvertToMulaw; // Assign the jest.fn() created in the mock

        // Instantiate the service with mocks
        twilioService = new TwilioService(mockLogger, mockTtsServiceInstance, mockConvertToMulaw);
    });

    test('constructor should initialize Twilio client with config values and log', () => {
        expect(twilio).toHaveBeenCalledTimes(1);
        expect(twilio).toHaveBeenCalledWith(config.twilio.accountSid, config.twilio.authToken);
        expect(mockLogger.info).toHaveBeenCalledWith('Twilio client initialized.');
    });
    
    test('constructor should throw if TTSService dependency is missing', () => {
        expect(() => new TwilioService(mockLogger, null, mockConvertToMulaw))
            .toThrow('TTSService dependency is required.');
    });

    test('constructor should throw if audio conversion function is missing', () => {
        expect(() => new TwilioService(mockLogger, mockTtsServiceInstance, null))
            .toThrow('Audio conversion function dependency is required.');
    });

    describe('getTwilioMessage', () => {
        test('should call TTS, convert, and return JSON message', async () => {
            const text = 'Hello';
            const streamSid = 'stream123';
            const language = 'en';
            const ttsBuffer = Buffer.from('tts audio');
            const mulawBuffer = Buffer.from('mulaw audio');
            const expectedPayload = mulawBuffer.toString('base64');

            mockTtsServiceInstance.synthesizeSpeech.mockResolvedValue(ttsBuffer);
            mockConvertToMulaw.mockResolvedValue(mulawBuffer);

            const result = await twilioService.getTwilioMessage(text, streamSid, language);

            expect(mockTtsServiceInstance.synthesizeSpeech).toHaveBeenCalledWith(text, language);
            expect(mockConvertToMulaw).toHaveBeenCalledWith(ttsBuffer);
            expect(mockLogger.debug).toHaveBeenCalledWith({ streamSid, language, textLength: text.length }, "Generating Twilio media message");
            expect(result).toBe(JSON.stringify({
                event: 'media',
                streamSid: streamSid,
                media: {
                    payload: expectedPayload,
                },
            }));
            expect(mockLogger.debug).toHaveBeenCalledWith({ streamSid, messageSize: result.length }, "Generated Twilio media message successfully");
        });

        test('should throw and log if synthesizeSpeech fails', async () => {
            const error = new Error('TTS Failed');
            mockTtsServiceInstance.synthesizeSpeech.mockRejectedValue(error);

            await expect(twilioService.getTwilioMessage('text', 'sid', 'en')).rejects.toThrow(error);
            expect(mockLogger.error).toHaveBeenCalledWith({ err: error, streamSid: 'sid', language: 'en', text: 'text' }, expect.any(String));
        });
        
        test('should throw and log if convertToMulaw fails', async () => {
            const error = new Error('Conversion Failed');
            mockTtsServiceInstance.synthesizeSpeech.mockResolvedValue(Buffer.from('ok'));
            mockConvertToMulaw.mockRejectedValue(error);

            await expect(twilioService.getTwilioMessage('text', 'sid', 'en')).rejects.toThrow(error);
            expect(mockLogger.error).toHaveBeenCalledWith({ err: error, streamSid: 'sid', language: 'en', text: 'text' }, expect.any(String));
        });
    });

    describe('forwardCall', () => {
        const callSid = 'call123';
        const host = 'example.com';
        const transferTo = '+1234567890';
        const expectedUrl = `https://${host}/forward?transferTo=${encodeURIComponent(transferTo)}`;

        test('should throw if callSid is missing', async () => {
            await expect(twilioService.forwardCall(null, host, transferTo)).rejects.toThrow('Invalid input');
        });
        
        test('should throw if host is missing', async () => {
            await expect(twilioService.forwardCall(callSid, null, transferTo)).rejects.toThrow('Invalid input');
        });
        
        test('should throw if transferTo is missing', async () => {
            await expect(twilioService.forwardCall(callSid, host, null)).rejects.toThrow('Invalid input');
        });

        test('should throw if host is invalid for URL', async () => {
            await expect(twilioService.forwardCall(callSid, 'invalid host', transferTo)).rejects.toThrow('Invalid host format');
        });

        test('should call twilio client update with correct URL', async () => {
            mockTwilioCallUpdate.mockResolvedValue({}); // Simulate successful API call
            
            await twilioService.forwardCall(callSid, host, transferTo);

            expect(mockLogger.info).toHaveBeenCalledWith({ callSid, transferTo, forwardUrl: expectedUrl }, `Forwarding call`);
            expect(twilio().calls).toHaveBeenCalledWith(callSid);
            expect(mockTwilioCallUpdate).toHaveBeenCalledTimes(1);
            expect(mockTwilioCallUpdate).toHaveBeenCalledWith({ url: expectedUrl, method: 'POST' });
            expect(mockLogger.info).toHaveBeenCalledWith({ callSid }, `Call update initiated for forwarding.`);
        });

        test('should throw and log if twilio client update fails', async () => {
            const apiError = new Error('Twilio API Error');
            mockTwilioCallUpdate.mockRejectedValue(apiError);

            await expect(twilioService.forwardCall(callSid, host, transferTo)).rejects.toThrow(`Twilio API error during call forward: ${apiError.message}`);
            expect(mockLogger.error).toHaveBeenCalledWith({ err: apiError, callSid, forwardUrl: expectedUrl }, `Failed to forward call`);
        });
    });
}); 