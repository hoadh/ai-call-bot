import textToSpeech from "@google-cloud/text-to-speech";
import config from "../../config/index.js"; // Import config

// Language to voice mapping (consider making this configurable)
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

export class TTSService {
    constructor(logger) {
        this.logger = logger || console; // Fallback to console if logger not provided
        // Credential path is validated in config/index.js
        // The google-cloud library automatically uses GOOGLE_APPLICATION_CREDENTIALS env var
        // No direct config access needed here for credentials, unless explicitly overriding
        try {
            this.client = new textToSpeech.TextToSpeechClient();
            this.logger.info("Google Text-to-Speech client initialized.");
        } catch (error) {
            this.logger.error({ err: error }, "Failed to initialize Google Text-to-Speech client");
            throw error; // Rethrow to prevent service from being used in a bad state
        }
    }

    async synthesizeSpeech(text, language = 'en') {
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
                sampleRateHertz: 24000, // Note: This is the output rate of TTS, conversion happens later
                pitch: 0,
                speakingRate: 1.0
            },
        };

        try {
            this.logger.debug({ language, textLength: text.length }, "Synthesizing speech");
            const [response] = await this.client.synthesizeSpeech(request);
            if (!response.audioContent) {
                this.logger.error({ language, text }, "Received empty audio content from TTS API.");
                throw new Error("Received empty audio content from TTS API.");
            }
            this.logger.debug({ language, audioSize: response.audioContent.length }, "Speech synthesized successfully");
            return response.audioContent; // Returns Buffer
        } catch (error) {
            this.logger.error({ err: error, language, text }, `Error in text-to-speech`);
            throw new Error(`TTS synthesis failed: ${error.message}`);
        }
    }
} 