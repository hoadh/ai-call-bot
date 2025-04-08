export class WebSocketService {
    constructor(llmService) {
        this.llmService = llmService;
    }

    handleConnection(ws) {
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                await this.handleMessage(ws, data);
            } catch (error) {
                console.error('Error handling message:', error);
                ws.send(JSON.stringify({ error: 'Failed to process message' }));
            }
        });
    }

    async handleMessage(ws, message) {
        try {
            const intent = await this.llmService.detectIntent(message.content);
            const response = await this.llmService.generateResponse(intent, message);
            ws.send(JSON.stringify(response));
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({ error: 'Failed to process message' }));
        }
    }

    async handleTranscript(ws, transcript) {
        try {
            const intent = await this.llmService.detectIntent(transcript.text);
            const response = await this.llmService.generateResponse(intent, transcript);
            ws.send(JSON.stringify(response));
        } catch (error) {
            console.error('Error processing transcript:', error);
            ws.send(JSON.stringify({ error: 'Failed to process transcript' }));
        }
    }
} 