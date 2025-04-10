import { TTSService } from '../../../services/audio/TTSService.js';
import textToSpeech from '@google-cloud/text-to-speech';
import logger from '../../../config/logger.js';

// Mock the Google Cloud client
jest.mock('@google-cloud/text-to-speech', () => {
    // Define and assign the mock function *inside* the factory
    const mockSynthesizeSpeechFn = jest.fn(); 
    return {
        // Return the constructor mock
        TextToSpeechClient: jest.fn().mockImplementation(() => ({
            // Ensure the instance method points to the mock function
            synthesizeSpeech: mockSynthesizeSpeechFn,
        })),
        // Expose the mock function itself if needed for direct access in tests
        __getMockSynthesizeSpeech: () => mockSynthesizeSpeechFn 
    };
});

// Mock the logger to prevent actual logging during tests
jest.mock('../../../config/logger.js', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
    })),
}));

describe('TTSService', () => {
    let ttsService;
    let mockLogger;
    let mockSynthesizeSpeech; // Variable to hold the mock function in test scope

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
        
        // Get the mock function via the helper
        mockSynthesizeSpeech = textToSpeech.__getMockSynthesizeSpeech();

        // Instantiate the service
        ttsService = new TTSService(mockLogger);
    });

    test('constructor should initialize client and log info', () => {
        // Constructor is called once in beforeEach
        expect(textToSpeech.TextToSpeechClient).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('Google Text-to-Speech client initialized.');
    });

    test('synthesizeSpeech should call Google API with correct parameters for en', async () => {
        const text = 'Hello world';
        const language = 'en';
        const mockAudioContent = Buffer.from('mock audio');
        // Ensure mock resolves with the array structure
        mockSynthesizeSpeech.mockResolvedValue([{ audioContent: mockAudioContent }]);

        const result = await ttsService.synthesizeSpeech(text, language);

        expect(mockLogger.debug).toHaveBeenCalledWith({ language, textLength: text.length }, "Synthesizing speech");
        expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(1);
        expect(mockSynthesizeSpeech).toHaveBeenCalledWith({
            input: { text: text },
            voice: {
                languageCode: 'en-US',
                name: 'en-US-Neural2-F', 
                ssmlGender: 'FEMALE'
            },
            audioConfig: { 
                audioEncoding: "LINEAR16", 
                sampleRateHertz: 24000,
                pitch: 0,
                speakingRate: 1.0
            },
        });
        expect(mockLogger.debug).toHaveBeenCalledWith({ language, audioSize: mockAudioContent.length }, "Speech synthesized successfully");
        expect(result).toBe(mockAudioContent);
    });

    test('synthesizeSpeech should call Google API with correct parameters for vi', async () => {
        const text = 'Xin chào';
        const language = 'vi';
        mockSynthesizeSpeech.mockResolvedValue([{ audioContent: Buffer.from('mock audio vi') }]);

        await ttsService.synthesizeSpeech(text, language);

        expect(mockSynthesizeSpeech).toHaveBeenCalledWith(expect.objectContaining({
            voice: expect.objectContaining({ languageCode: 'vi-VN', name: 'vi-VN-Neural2-A' })
        }));
    });
    
    test('synthesizeSpeech should fallback to en for unsupported language', async () => {
        const text = 'Unsupported';
        const language = 'xx'; // Unsupported language code
        mockSynthesizeSpeech.mockResolvedValue([{ audioContent: Buffer.from('mock audio en fallback') }]);

        await ttsService.synthesizeSpeech(text, language);

        expect(mockSynthesizeSpeech).toHaveBeenCalledWith(expect.objectContaining({
            voice: expect.objectContaining({ languageCode: 'en-US' })
        }));
    });

    test('synthesizeSpeech should throw and log error if API call fails', async () => {
        const text = 'Fail me';
        const language = 'en';
        const apiError = new Error('API Error');
        mockSynthesizeSpeech.mockRejectedValue(apiError);

        await expect(ttsService.synthesizeSpeech(text, language)).rejects.toThrow('TTS synthesis failed: API Error');
        expect(mockLogger.error).toHaveBeenCalledWith({ err: apiError, language, text }, `Error in text-to-speech`);
    });

    test('synthesizeSpeech should throw and log error if API returns no audioContent', async () => {
        const text = 'Empty response';
        const language = 'en';
        // Ensure mock resolves with the array structure, even with null content
        mockSynthesizeSpeech.mockResolvedValue([{ audioContent: null }]); 

        await expect(ttsService.synthesizeSpeech(text, language)).rejects.toThrow('Received empty audio content from TTS API.');
        expect(mockLogger.error).toHaveBeenCalledWith({ language, text }, "Received empty audio content from TTS API.");
    });

    test('constructor should throw if client initialization fails', () => {
        const initError = new Error('Initialization failed');
        // Make the mock constructor throw
        const mockClientConstructor = textToSpeech.TextToSpeechClient;
        mockClientConstructor.mockImplementationOnce(() => {
            throw initError;
        });

        expect(() => new TTSService(mockLogger)).toThrow(initError);
        expect(mockLogger.error).toHaveBeenCalledWith({ err: initError }, "Failed to initialize Google Text-to-Speech client");
    });
}); 