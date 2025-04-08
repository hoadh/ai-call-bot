import { promises as fs } from 'fs';
import path from 'path';
import { ServiceError } from '../error/AppError.js';

export class ConversationService {
    constructor(conversationsDir = './conversations') {
        this.conversationsDir = conversationsDir;
    }

    async ensureConversationsDirectory() {
        try {
            await fs.mkdir(this.conversationsDir, { recursive: true });
        } catch (error) {
            throw new ServiceError('FileSystem', `Failed to create conversations directory: ${error.message}`);
        }
    }

    async saveConversation(conversationLog, streamSid) {
        try {
            await this.ensureConversationsDirectory();
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `conversation-${streamSid || 'unknown'}-${timestamp}.json`;
            const filePath = path.join(this.conversationsDir, filename);

            await fs.writeFile(filePath, JSON.stringify(conversationLog, null, 2));
            console.log(`💾 Conversation saved to ${filePath}`);
            return filePath;
        } catch (error) {
            throw new ServiceError('FileSystem', `Error saving conversation: ${error.message}`);
        }
    }

    async getConversation(streamSid) {
        try {
            await this.ensureConversationsDirectory();
            const files = await fs.readdir(this.conversationsDir);
            const conversationFile = files.find(file => file.includes(streamSid));
            
            if (!conversationFile) {
                return null;
            }

            const filePath = path.join(this.conversationsDir, conversationFile);
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new ServiceError('FileSystem', `Error reading conversation: ${error.message}`);
        }
    }

    async listConversations() {
        try {
            await this.ensureConversationsDirectory();
            const files = await fs.readdir(this.conversationsDir);
            return files.filter(file => file.endsWith('.json'));
        } catch (error) {
            throw new ServiceError('FileSystem', `Error listing conversations: ${error.message}`);
        }
    }
} 