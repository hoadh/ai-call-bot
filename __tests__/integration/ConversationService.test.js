import { ConversationService } from '../../services/conversation/ConversationService.js';
import { promises as fs } from 'fs';
import path from 'path';
import { ServiceError } from '../../services/error/AppError.js';

describe('ConversationService Integration', () => {
    let conversationService;
    const testDir = './test-conversations';

    beforeEach(async () => {
        conversationService = new ConversationService(testDir);
        // Clean up test directory before each test
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore error if directory doesn't exist
        }
    });

    afterEach(async () => {
        // Clean up test directory after each test
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore error if directory doesn't exist
        }
    });

    it('should create conversations directory if it does not exist', async () => {
        await conversationService.ensureConversationsDirectory();
        const stats = await fs.stat(testDir);
        expect(stats.isDirectory()).toBe(true);
    });

    it('should save a conversation to a file', async () => {
        const conversationLog = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
        ];
        const streamSid = 'test-stream-123';

        const filePath = await conversationService.saveConversation(conversationLog, streamSid);
        
        const savedContent = await fs.readFile(filePath, 'utf8');
        const parsedContent = JSON.parse(savedContent);
        
        expect(parsedContent).toEqual(conversationLog);
        expect(filePath).toContain(streamSid);
    });

    it('should retrieve a saved conversation', async () => {
        const conversationLog = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
        ];
        const streamSid = 'test-stream-123';

        await conversationService.saveConversation(conversationLog, streamSid);
        const retrievedConversation = await conversationService.getConversation(streamSid);

        expect(retrievedConversation).toEqual(conversationLog);
    });

    it('should return null when conversation not found', async () => {
        const retrievedConversation = await conversationService.getConversation('non-existent-stream');
        expect(retrievedConversation).toBeNull();
    });

    it('should list all conversation files', async () => {
        const conversationLog = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' }
        ];

        await conversationService.saveConversation(conversationLog, 'stream1');
        await conversationService.saveConversation(conversationLog, 'stream2');

        const files = await conversationService.listConversations();
        expect(files.length).toBe(2);
        expect(files.every(file => file.endsWith('.json'))).toBe(true);
    });

    it('should handle file system errors appropriately', async () => {
        // Create a read-only directory to simulate permission issues
        await fs.mkdir(testDir, { recursive: true });
        await fs.chmod(testDir, 0o444);

        await expect(conversationService.saveConversation([], 'test'))
            .rejects
            .toThrow(ServiceError);
    });
}); 