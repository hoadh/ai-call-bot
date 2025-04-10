import { convertToMulaw } from '../../../services/audio/AudioConversionService.js';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import logger from '../../../config/logger.js';

// Mock the logger
jest.mock('../../../config/logger.js', () => ({
    // ... (standard logger mock) ...
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
    })),
}));

// Mock fluent-ffmpeg
let mockFfmpegInstance;
jest.mock('fluent-ffmpeg', () => {
    return jest.fn(() => {
        // Create a fresh mock instance for each call to ffmpeg()
        mockFfmpegInstance = {
            inputFormat: jest.fn().mockReturnThis(),
            inputOptions: jest.fn().mockReturnThis(),
            audioCodec: jest.fn().mockReturnThis(),
            audioChannels: jest.fn().mockReturnThis(),
            audioFrequency: jest.fn().mockReturnThis(),
            format: jest.fn().mockReturnThis(),
            on: jest.fn().mockReturnThis(), // For 'error' and 'end' on the command itself
            pipe: jest.fn(() => { // pipe() returns a stream
                // Create a mock stream object for the pipe return value
                const mockPipeStream = {
                    on: jest.fn(), // Mock .on() for the stream
                    // Add other stream methods if needed
                };

                // Find the error/end handlers attached to the *command*
                const errorHandlers = mockFfmpegInstance.on.mock.calls.filter(call => call[0] === 'error').map(call => call[1]);
                const endHandlers = mockFfmpegInstance.on.mock.calls.filter(call => call[0] === 'end').map(call => call[1]);
                
                // Simulate async data chunk and end *on the pipe stream*
                setImmediate(() => {
                    try {
                        // Find the 'data' handler attached to the *pipe stream*
                        const dataHandlers = mockPipeStream.on.mock.calls.filter(call => call[0] === 'data').map(call => call[1]);
                        dataHandlers.forEach(handler => handler(Buffer.from('mock_mulaw_chunk')));
                        
                        // Call end handlers attached to the *command*
                        endHandlers.forEach(handler => handler()); 
                    } catch(e) {
                        errorHandlers.forEach(handler => handler(e));
                    }
                });
                
                return mockPipeStream; // Return the mock stream
            }),
        };
        return mockFfmpegInstance;
    });
});

describe('AudioConversionService', () => {
    let mockChildLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup child logger mock for assertions
        mockChildLogger = {
            debug: jest.fn(),
            error: jest.fn(),
        };
        logger.child.mockReturnValue(mockChildLogger);
    });

    test('convertToMulaw should reject if input is not a buffer', async () => {
        const invalidInput = 'not a buffer';
        await expect(convertToMulaw(invalidInput)).rejects.toThrow(TypeError);
        expect(mockChildLogger.error).toHaveBeenCalledWith({ inputType: 'string' }, expect.any(String));
    });

    test('convertToMulaw should call ffmpeg with correct options', async () => {
        const inputBuffer = Buffer.from('test');
        await convertToMulaw(inputBuffer);

        expect(ffmpeg).toHaveBeenCalledTimes(1);
        expect(ffmpeg).toHaveBeenCalledWith(expect.any(Readable)); // Check if called with a stream
        expect(mockFfmpegInstance.inputFormat).toHaveBeenCalledWith('s16le');
        expect(mockFfmpegInstance.inputOptions).toHaveBeenCalledWith(["-ar 24000"]);
        expect(mockFfmpegInstance.audioCodec).toHaveBeenCalledWith('pcm_mulaw');
        expect(mockFfmpegInstance.audioChannels).toHaveBeenCalledWith(1);
        expect(mockFfmpegInstance.audioFrequency).toHaveBeenCalledWith(8000);
        expect(mockFfmpegInstance.format).toHaveBeenCalledWith('mulaw');
        expect(mockFfmpegInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(mockFfmpegInstance.on).toHaveBeenCalledWith('end', expect.any(Function));
        expect(mockFfmpegInstance.pipe).toHaveBeenCalledTimes(1);
    });

    test('convertToMulaw should resolve with converted buffer on success', async () => {
        const inputBuffer = Buffer.from('linear16 data');
        const result = await convertToMulaw(inputBuffer);

        expect(result).toBeInstanceOf(Buffer);
        expect(result.toString()).toContain('mock_mulaw_chunk'); // This should now pass
        expect(mockChildLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ inputBufferSize: inputBuffer.length }), "FFmpeg conversion finished.");
    });

    test('convertToMulaw should reject and log on ffmpeg error', async () => {
        const inputBuffer = Buffer.from('error data');
        const ffmpegError = new Error('ffmpeg failed');
        
        // Redefine the mock for the error case
        ffmpeg.mockImplementationOnce(() => ({
            inputFormat: jest.fn().mockReturnThis(),
            inputOptions: jest.fn().mockReturnThis(),
            audioCodec: jest.fn().mockReturnThis(),
            audioChannels: jest.fn().mockReturnThis(),
            audioFrequency: jest.fn().mockReturnThis(),
            format: jest.fn().mockReturnThis(),
            // Simulate error handler being called on the command
            on: jest.fn((event, callback) => {
                if (event === 'error') {
                    setImmediate(() => callback(ffmpegError));
                }
                return mockFfmpegInstance; 
            }),
            // pipe() still needs to return something chainable in the error case
            pipe: jest.fn(() => ({ on: jest.fn() })), 
        }));

        await expect(convertToMulaw(inputBuffer)).rejects.toThrow(`FFmpeg Error: ${ffmpegError.message}`);
        expect(mockChildLogger.error).toHaveBeenCalledWith({ err: ffmpegError, inputBufferSize: inputBuffer.length }, "FFmpeg conversion error");
    });
}); 