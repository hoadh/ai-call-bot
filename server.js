import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import 'dotenv/config';
import { RealtimeTranscriber } from 'assemblyai';
import { synthesizeSpeech } from "./tts.js";
import { convertToMulaw } from "./convert.js";
import { LLMServiceFactory } from './services/llm/LLMServiceFactory.js';
import { BusinessServiceFactory } from './services/business/BusinessServiceFactory.js';
import { LanguageService } from './services/language/LanguageService.js';
import configService from './services/config/ConfigService.js';
import { getCustomerInfo } from './crmAPI.js';

const app = express();
app.use(express.urlencoded({ extended: true }));
const server = createServer(app);

// Initialize services
async function initializeServices() {
    try {
        await configService.initialize();
        console.log('✅ Configuration loaded successfully');
    } catch (error) {
        console.error('❌ Error initializing configuration:', error);
        process.exit(1);
    }
}

const llmService = LLMServiceFactory.createService(process.env.LLM_SERVICE_TYPE || 'openai');
const businessService = BusinessServiceFactory.createService(process.env.BUSINESS_TYPE || 'nail_salon');
const languageService = new LanguageService();

app.get('/', (_, res) => res.type('text').send('Twilio media stream transcriber'));

app.post('/', async (req, res) => {
    const callerNumber = req.body.From;
    const phoneNumberSid = req.body.To; // Get the Twilio Phone Number SID
    console.log(`📞 Incoming call from: ${callerNumber} to: ${phoneNumberSid}`);
    res.type('xml').send(
        `<Response>
        <Connect>
          <Stream url='wss://${req.headers.host}'>
            <Parameter name="caller_id" value="${callerNumber}"/>
            <Parameter name="phone_number_sid" value="${phoneNumberSid}"/>
          </Stream>
        </Connect>
      </Response>`
    );
});

app.post("/twilio-redirect", (req, res) => {
    console.log("📞 Call transfer triggered");
    res.set("Content-Type", "text/xml");
    res.send(`
        <Response>
            <Dial>+84778980113</Dial>
        </Response>
    `);
});

const wss = new WebSocketServer({ server });
wss.on('connection', async (ws) => {
    let streamSid = null;
    let phoneNumber = null;
    let phoneNumberSid = null;
    let conversationLog = [];
    let customerInfo = null;
    let currentLanguage = 'en';
    console.log('Twilio media stream WebSocket connected');
    
    const transcriber = new RealtimeTranscriber({
        apiKey: process.env.ASSEMBLYAI_API_KEY,
        encoding: 'pcm_mulaw',
        sampleRate: 8000
    });

    const transcriberConnectionPromise = transcriber.connect();
    
    transcriber.on('transcript.partial', (partialTranscript) => {
        if (!partialTranscript.text) return;
        console.log(partialTranscript.text + "\n");
    });

    transcriber.on('transcript.final', async (finalTranscript) => {
        console.clear();
        const userMessage = finalTranscript.text;

        // Detect language from user message
        currentLanguage = await languageService.detectLanguage(userMessage);
        console.log("Detected Language:", currentLanguage);

        const intent = await llmService.detectIntent(userMessage);
        console.log("Detected Intent:", intent);

        console.log(`User: ${userMessage}`);
        conversationLog.push({ role: 'user', content: userMessage });

        const history = conversationLog.map((message) => (message.role === 'user') ? `User: ${message.content}` : `AI: ${message.content}`).join('\n');
        let guideline = await businessService.getSystemPrompt(currentLanguage, phoneNumberSid);
        
        const isGoodbyeResponse = await llmService.isGoodbye(userMessage);
        if (isGoodbyeResponse) {
            guideline = await businessService.getGoodbyePrompt(currentLanguage, phoneNumberSid);
        }

        try {
            const intentHandlingResult = await llmService.detectIntentAndHandle(userMessage, phoneNumber);
            console.log("Intent Handling Result:", intentHandlingResult);

            let aiResponse;
            if (intentHandlingResult !== "No action required.") {
                const businessResult = await businessService.handleIntent(
                    intent,
                    userMessage,
                    phoneNumber,
                    customerInfo,
                    currentLanguage,
                    phoneNumberSid
                );

                if (businessResult.shouldTransfer) {
                    console.log("🔄 Transferring call to human agent...");
                    ws.send(JSON.stringify({ event: "stop" }));
                    return;
                }

                aiResponse = businessResult.response;
            }

            if (!aiResponse) {
                aiResponse = await llmService.getResponse(`${guideline}\n\n${history}\nUser: ${userMessage}\nAI:`);
                // Translate the AI response if needed
                if (currentLanguage !== 'en') {
                    aiResponse = await languageService.translate(aiResponse, currentLanguage);
                }
            }

            console.log(`AI: ${aiResponse}`);
            conversationLog.push({ role: 'AI', content: aiResponse });

            const mediaMessage = await getTwilioMessage(aiResponse, streamSid, currentLanguage);
            ws.send(mediaMessage, (error) => {
                if (error) {
                    console.error('❌ Error sending final message:', error);
                } else if (isGoodbyeResponse) {
                    console.log('Final message sent. Closing connection...');
                    const delay = Math.ceil(2000);
                    setTimeout(() => ws.close(), delay);
                }
            });
        } catch (error) {
            console.error('Error handling intent:', error);
            const aiResponse = await llmService.getResponse(`${guideline}\n\n${history}\nUser: ${userMessage}\nAI:`);
            // Translate the error response if needed
            if (currentLanguage !== 'en') {
                aiResponse = await languageService.translate(aiResponse, currentLanguage);
            }
            console.log(`AI: ${aiResponse}`);
            conversationLog.push({ role: 'AI', content: aiResponse });
            const mediaMessage = await getTwilioMessage(aiResponse, streamSid, currentLanguage);
            ws.send(mediaMessage);
        }
    });

    transcriber.on('open', () => console.log('Connected to real-time service'));
    transcriber.on('error', console.error);
    transcriber.on('close', () => console.log('Disconnected from real-time service'));

    ws.on('message', async (message) => {
        const msg = JSON.parse(message);
        switch (msg.event) {
            case 'connected':
                console.info('Twilio media stream connected');
                break;
            case 'start':
                console.info('Twilio media stream started');
                streamSid = msg.streamSid;
                const { customParameters } = msg.start;
                const callerId = customParameters.caller_id.replace('+', '').replace('client:', '');
                phoneNumberSid = customParameters.phone_number_sid;
                console.log(`📞 Caller ID: ${callerId}`);
                console.log(`📱 Phone Number SID: ${phoneNumberSid}`);
                phoneNumber = callerId;
                
                customerInfo = await getCustomerInfo(callerId);
                const welcomeMessage = await businessService.getWelcomeMessage(customerInfo, currentLanguage, phoneNumberSid);
                console.log(`AI: ${welcomeMessage}`);
                conversationLog.push({ role: 'assistant', content: welcomeMessage });
                ws.send(await getTwilioMessage(welcomeMessage, streamSid, currentLanguage));
                break;
            case 'media':
                await transcriberConnectionPromise;
                transcriber.sendAudio(Buffer.from(msg.media.payload, 'base64'));
                break;
            case 'stop':
                console.info('Twilio media stream stopped');
                break;
        }
    });

    ws.on('close', async () => {
        console.log('Twilio media stream WebSocket disconnected');
        await transcriber.close();

        const fs = await import('fs/promises');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `conversation-${streamSid || 'unknown'}-${timestamp}.json`;

        try {
            await fs.writeFile(`./conversations/${filename}`, JSON.stringify(conversationLog, null, 2));
            console.log(`💾 Conversation saved to ./conversations/${filename}`);
        } catch (error) {
            console.error('❌ Error saving conversation:', error);
        }
    });

    await transcriberConnectionPromise;
});

async function getAudioToTwilio(text, language = 'en') {
    try {
        const ttsAudio = await synthesizeSpeech(text, language);
        const mulawAudio = await convertToMulaw(ttsAudio);
        return mulawAudio;
    } catch (error) {
        console.error("❌ Error in TTS:", error);
    }
}

async function getTwilioMessage(text, streamSid, language = 'en') {
    const audio = await getAudioToTwilio(text, language);
    const base64Audio = Buffer.from(audio).toString('base64')
    const mediaMessage = JSON.stringify({
        event: "media",
        streamSid: streamSid,
        media: { payload: base64Audio },
    });
    return mediaMessage;
}

// Start the server
async function startServer() {
    await initializeServices();
    server.listen(8000, () => {
        console.log('🚀 Server is listening on port 8000');
        console.log(`📞 Business ID: ${process.env.BUSINESS_ID}`);
        console.log(`🏢 Business Name: ${configService.getBusinessName()}`);
        console.log(`🌍 Supported Languages: ${configService.getSupportedLanguages().join(', ')}`);
    });
}

startServer().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
