import pkg from '@google-cloud/translate';
const { TranslationServiceClient } = pkg;
import dotenv from "dotenv";

dotenv.config();

const translate = new TranslationServiceClient({
    keyFilename: process.env.GOOGLE_TRANSLATE_KEY_PATH,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

export class LanguageService {
    constructor() {
        this.defaultLanguage = 'en';
        this.supportedLanguages = ['en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de'];
        this.projectLocation = process.env.GOOGLE_CLOUD_PROJECT_LOCATION || 'global';
    }

    async detectLanguage(text) {
        try {
            const [result] = await translate.detectLanguage({
                content: text,
                mimeType: 'text/plain',
                parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/${this.projectLocation}`
            });

            const detectedLanguage = result.languages[0].languageCode;
            return this.supportedLanguages.includes(detectedLanguage) ? detectedLanguage : this.defaultLanguage;
        } catch (error) {
            console.error('Error detecting language:', error);
            return this.defaultLanguage;
        }
    }

    async translate(text, targetLanguage) {
        if (!text || targetLanguage === this.defaultLanguage) {
            return text;
        }

        try {
            const [translation] = await translate.translateText({
                contents: [text],
                mimeType: 'text/plain',
                sourceLanguageCode: this.defaultLanguage,
                targetLanguageCode: targetLanguage,
                parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/${this.projectLocation}`
            });

            return translation.translations[0].translatedText;
        } catch (error) {
            console.error('Error translating text:', error);
            return text;
        }
    }

    isSupportedLanguage(languageCode) {
        return this.supportedLanguages.includes(languageCode);
    }
} 