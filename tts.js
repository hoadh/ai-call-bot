import textToSpeech from "@google-cloud/text-to-speech";
import fs from "fs/promises";

const client = new textToSpeech.TextToSpeechClient();

// Language to voice mapping
const LANGUAGE_VOICE_MAP = {
    'en': { languageCode: 'en-US', voiceName: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
    'vi': { languageCode: 'vi-VN', voiceName: 'vi-VN-Neural2-A', ssmlGender: 'FEMALE' },
    'ja': { languageCode: 'ja-JP', voiceName: 'ja-JP-Neural2-B', ssmlGender: 'FEMALE' },
    'ko': { languageCode: 'ko-KR', voiceName: 'ko-KR-Neural2-B', ssmlGender: 'FEMALE' },
    'zh': { languageCode: 'zh-CN', voiceName: 'zh-CN-Neural2-A', ssmlGender: 'FEMALE' },
    'es': { languageCode: 'es-ES', voiceName: 'es-ES-Neural2-F', ssmlGender: 'FEMALE' },
    'fr': { languageCode: 'fr-FR', voiceName: 'fr-FR-Neural2-A', ssmlGender: 'FEMALE' },
    'de': { languageCode: 'de-DE', voiceName: 'de-DE-Neural2-F', ssmlGender: 'FEMALE' }
};

export async function synthesizeSpeech(text, language = 'en') {
    try {
        // Get voice configuration for the language, fallback to English if not supported
        const voiceConfig = LANGUAGE_VOICE_MAP[language] || LANGUAGE_VOICE_MAP['en'];

        const request = {
            input: { text: text },
            voice: {
                languageCode: voiceConfig.languageCode,
                name: voiceConfig.voiceName,
                ssmlGender: voiceConfig.ssmlGender
            },
            audioConfig: { 
                audioEncoding: "LINEAR16", 
                sampleRateHertz: 24000,
                pitch: 0,
                speakingRate: 1.0
            },
        };

        const [response] = await client.synthesizeSpeech(request);
        return response.audioContent; // Returns Buffer
    } catch (error) {
        console.error('Error in text-to-speech:', error);
        // Fallback to English if there's an error
        const fallbackRequest = {
            input: { text: text },
            voice: LANGUAGE_VOICE_MAP['en'],
            audioConfig: { 
                audioEncoding: "LINEAR16", 
                sampleRateHertz: 24000,
                pitch: 0,
                speakingRate: 1.0
            },
        };
        const [fallbackResponse] = await client.synthesizeSpeech(fallbackRequest);
        return fallbackResponse.audioContent;
    }
}
