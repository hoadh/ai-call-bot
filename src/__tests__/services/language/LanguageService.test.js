import { LanguageService } from '../../../services/language/LanguageService.js';

// Mock the Google Translate package
jest.mock('@google-cloud/translate', () => {
    const mockDetectLanguage = jest.fn();
    const mockTranslateText = jest.fn();
    
    return {
        TranslationServiceClient: jest.fn().mockImplementation(() => ({
            detectLanguage: mockDetectLanguage,
            translateText: mockTranslateText
        }))
    };
});

describe('LanguageService', () => {
    let languageService;
    let mockClient;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Set environment variables
        process.env.GOOGLE_TRANSLATE_KEY_PATH = '/path/to/key.json';
        process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project-id';
        process.env.GOOGLE_CLOUD_PROJECT_LOCATION = 'test-location';
        
        // Get the mock implementation
        const { TranslationServiceClient } = require('@google-cloud/translate');
        mockClient = new TranslationServiceClient();
        
        // Create instance
        languageService = new LanguageService();
        
        // Replace the translate client in the service with our mock
        languageService.translateClient = mockClient;
        
        // Mock console methods
        global.console.error = jest.fn();
    });
    
    describe('constructor', () => {
        it('should initialize with default values', () => {
            expect(languageService.defaultLanguage).toBe('en');
            expect(languageService.supportedLanguages).toEqual(['en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de']);
            expect(languageService.projectLocation).toBe('test-location');
        });
        
        it('should use "global" as default location if not provided', () => {
            delete process.env.GOOGLE_CLOUD_PROJECT_LOCATION;
            const service = new LanguageService();
            expect(service.projectLocation).toBe('global');
        });
    });
    
    describe('detectLanguage', () => {
        it('should detect language successfully', async () => {
            // Setup mock response
            const mockDetectResponse = [
                {
                    languages: [
                        { languageCode: 'vi', confidence: 0.9 }
                    ]
                }
            ];
            
            mockClient.detectLanguage.mockResolvedValueOnce(mockDetectResponse);
            
            const result = await languageService.detectLanguage('Xin chào');
            
            expect(result).toBe('vi');
            expect(mockClient.detectLanguage).toHaveBeenCalledWith({
                content: 'Xin chào',
                mimeType: 'text/plain',
                parent: 'projects/test-project-id/locations/test-location'
            });
        });
        
        it('should return default language if detected language is not supported', async () => {
            // Setup mock response with unsupported language
            const mockDetectResponse = [
                {
                    languages: [
                        { languageCode: 'ru', confidence: 0.9 }
                    ]
                }
            ];
            
            mockClient.detectLanguage.mockResolvedValueOnce(mockDetectResponse);
            
            const result = await languageService.detectLanguage('Привет');
            
            expect(result).toBe('en');
        });
        
        it('should return default language on error', async () => {
            // Setup mock error
            mockClient.detectLanguage.mockRejectedValueOnce(new Error('API error'));
            
            const result = await languageService.detectLanguage('Hello');
            
            expect(result).toBe('en');
            expect(console.error).toHaveBeenCalledWith('Error detecting language:', expect.any(Error));
        });
    });
    
    describe('translate', () => {
        it('should return original text if target language is default language', async () => {
            const text = 'Hello world';
            const result = await languageService.translate(text, 'en');
            
            expect(result).toBe(text);
            expect(mockClient.translateText).not.toHaveBeenCalled();
        });
        
        it('should return original text if text is empty', async () => {
            const result = await languageService.translate('', 'vi');
            
            expect(result).toBe('');
            expect(mockClient.translateText).not.toHaveBeenCalled();
        });
        
        it('should translate text successfully', async () => {
            // Setup mock response
            const mockTranslateResponse = [
                {
                    translations: [
                        { translatedText: 'Xin chào thế giới' }
                    ]
                }
            ];
            
            mockClient.translateText.mockResolvedValueOnce(mockTranslateResponse);
            
            const result = await languageService.translate('Hello world', 'vi');
            
            expect(result).toBe('Xin chào thế giới');
            expect(mockClient.translateText).toHaveBeenCalledWith({
                contents: ['Hello world'],
                mimeType: 'text/plain',
                sourceLanguageCode: 'en',
                targetLanguageCode: 'vi',
                parent: 'projects/test-project-id/locations/test-location'
            });
        });
        
        it('should return original text on error', async () => {
            // Setup mock error
            mockClient.translateText.mockRejectedValueOnce(new Error('API error'));
            
            const text = 'Hello world';
            const result = await languageService.translate(text, 'vi');
            
            expect(result).toBe(text);
            expect(console.error).toHaveBeenCalledWith('Error translating text:', expect.any(Error));
        });
    });
    
    describe('isSupportedLanguage', () => {
        it('should return true for supported languages', () => {
            expect(languageService.isSupportedLanguage('en')).toBe(true);
            expect(languageService.isSupportedLanguage('vi')).toBe(true);
            expect(languageService.isSupportedLanguage('ja')).toBe(true);
        });
        
        it('should return false for unsupported languages', () => {
            expect(languageService.isSupportedLanguage('ru')).toBe(false);
            expect(languageService.isSupportedLanguage('ar')).toBe(false);
            expect(languageService.isSupportedLanguage('')).toBe(false);
        });
    });
});
