import { WebSocketService } from '../../services/websocket/WebSocketService.js';
import { MockLanguageService } from '../mocks/LanguageService.mock.js';
import { MockOpenAIService } from '../mocks/OpenAIService.mock.js';

describe('WebSocketService Integration', () => {
    let webSocketService;
    let mockLanguageService;
    let mockLLMService;
    let originalConsoleError;

    beforeEach(() => {
        // Store original console.error
        originalConsoleError = console.error;
        // Mock console.error
        console.error = jest.fn();
        
        mockLanguageService = new MockLanguageService();
        mockLLMService = new MockOpenAIService(mockLanguageService);
        webSocketService = new WebSocketService(mockLLMService);
    });

    afterEach(() => {
        // Restore original console.error
        console.error = originalConsoleError;
    });

    test('should handle connection', () => {
        const mockWs = {
            send: jest.fn(),
            on: jest.fn()
        };

        webSocketService.handleConnection(mockWs);
        expect(mockWs.on).toHaveBeenCalled();
    });

    test('should handle message and generate response', async () => {
        const mockWs = {
            send: jest.fn()
        };

        const message = {
            type: 'text',
            content: 'I want to book an appointment'
        };

        await webSocketService.handleMessage(mockWs, message);
        expect(mockLLMService.detectIntent).toHaveBeenCalledWith(message.content);
        expect(mockWs.send).toHaveBeenCalled();
    });

    test('should handle transcript', async () => {
        const mockWs = {
            send: jest.fn()
        };

        const transcript = {
            text: 'Hello, I need a manicure',
            language: 'en'
        };

        await webSocketService.handleTranscript(mockWs, transcript);
        expect(mockLLMService.detectIntent).toHaveBeenCalledWith(transcript.text);
        expect(mockWs.send).toHaveBeenCalled();
    });

    test('should handle errors gracefully', async () => {
        const mockWs = {
            send: jest.fn()
        };

        // Force an error in the LLM service
        mockLLMService.detectIntent.mockImplementationOnce(() => {
            throw new Error('Test error');
        });

        const message = {
            type: 'text',
            content: 'Error test message'
        };

        await webSocketService.handleMessage(mockWs, message);
        expect(console.error).toHaveBeenCalledWith('Error processing message:', expect.any(Error));
        expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ error: 'Failed to process message' }));
    });
}); 