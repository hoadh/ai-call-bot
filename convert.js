import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";

export function convertToMulaw(audioBuffer) {
    return new Promise((resolve, reject) => {
        let chunks = [];
        const stream = new Readable();
        stream.push(audioBuffer);
        stream.push(null);

        ffmpeg(stream)
            .inputFormat("s16le")  // Google TTS returns LINEAR16
            .inputOptions(["-ar 24000"])  // 🔹 Explicitly set input sample rate
            .audioCodec("pcm_mulaw")  // Convert to μ-law
            .audioChannels(1)  // Mono output
            .audioFrequency(8000)  // Twilio requires 8000Hz
            .format("mulaw")  // Force μ-law output
            .on("error", (err) => reject(`FFmpeg Error: ${err.message}`))
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe()
            .on("data", (chunk) => chunks.push(chunk));
    });
}
