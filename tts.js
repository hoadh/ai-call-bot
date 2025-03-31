import textToSpeech from "@google-cloud/text-to-speech";
import fs from "fs/promises";

const client = new textToSpeech.TextToSpeechClient();

export async function synthesizeSpeech(text) {
    const request = {
        input: { text: text },
        voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 },
    };

    const [response] = await client.synthesizeSpeech(request);
    return response.audioContent; // Returns Buffer
}
