import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import logger from "../../config/logger.js"; // Import logger directly for now

/**
 * Converts a LINEAR16 audio buffer (expected at 24000Hz from Google TTS)
 * to PCM µ-law format at 8000Hz for Twilio.
 * @param {Buffer} audioBuffer - The input audio buffer (LINEAR16, 24000Hz).
 * @returns {Promise<Buffer>} A promise that resolves with the converted µ-law audio buffer.
 */
export function convertToMulaw(audioBuffer) {
    const log = logger.child({ service: 'AudioConversion' }); // Create a child logger for this function
    
    // Input validation
    if (!Buffer.isBuffer(audioBuffer)) {
        const errorMsg = "Invalid input: audioBuffer must be a Buffer.";
        log.error({ inputType: typeof audioBuffer }, errorMsg);
        return Promise.reject(new TypeError(errorMsg));
    }
    
    return new Promise((resolve, reject) => {
        let chunks = [];
        const stream = new Readable();
        stream.push(audioBuffer);
        stream.push(null); // Signal end of stream

        // Note: Ensure ffmpeg is installed and accessible in the system PATH.
        // Configuration of the ffmpeg path might be necessary in some environments.
        ffmpeg(stream)
            .inputFormat("s16le")        // Input is signed 16-bit little-endian PCM (LINEAR16)
            .inputOptions(["-ar 24000"]) // Explicitly set input sample rate from TTS
            .audioCodec("pcm_mulaw")     // Convert to µ-law codec
            .audioChannels(1)             // Mono output
            .audioFrequency(8000)         // Twilio requires 8000Hz
            .format("mulaw")             // Output format
            .on("error", (err) => {
                log.error({ err, inputBufferSize: audioBuffer?.length }, "FFmpeg conversion error");
                reject(new Error(`FFmpeg Error: ${err.message}`));
            })
            .on("end", () => {
                const outputBufferSize = Buffer.concat(chunks).length;
                log.debug({ inputBufferSize: audioBuffer?.length, outputBufferSize }, "FFmpeg conversion finished.");
                resolve(Buffer.concat(chunks));
            })
            .pipe() // Pipe output to the stream handler below
            .on("data", (chunk) => {
                chunks.push(chunk);
            });
    });
} 