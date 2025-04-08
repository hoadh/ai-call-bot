export class MockLanguageService {
    constructor() {
        this.detectLanguage = jest.fn().mockImplementation((text) => {
            return Promise.resolve({
                language: 'en',
                confidence: 0.95
            });
        });

        this.translate = jest.fn().mockImplementation((text, targetLang) => {
            return Promise.resolve(`Translated: ${text}`);
        });

        this.getSupportedLanguages = jest.fn().mockImplementation(() => {
            return Promise.resolve(['en', 'es', 'fr']);
        });
    }
} 