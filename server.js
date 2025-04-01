import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import 'dotenv/config';
import { RealtimeTranscriber } from 'assemblyai';
import { synthesizeSpeech } from "./tts.js";
import { convertToMulaw } from "./convert.js";
import { OpenAIService } from './services/openai.js';
import { AppointmentService } from './services/appointmentService.js';
import { getCustomerInfo } from './crmAPI.js';

const app = express();
app.use(express.urlencoded({ extended: true }));
const server = createServer(app);

app.get('/', (_, res) => res.type('text').send('Twilio media stream transcriber'));

app.post('/', async (req, res) => {
    const callerNumber = req.body.From;
    console.log(`📞 Incoming call from: ${callerNumber}`);
    res.type('xml').send(
        `<Response>
        <Connect>
          <Stream url='wss://${req.headers.host}'>
            <Parameter name="caller_id" value="${callerNumber}"/>
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
    let conversationLog = [];
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

        const intent = await OpenAIService.detectIntent(userMessage);
        console.log("Detected Intent:", intent);

        console.log(`User: ${userMessage}`);
        conversationLog.push({ role: 'user', content: userMessage });

        const history = conversationLog.map((message) => (message.role === 'user') ? `User: ${message.content}` : `AI: ${message.content}`).join('\n');
        let guideline = "You are a AI Customer Service. Keep your responses concise and natural.";
        
        const isGoodbyeResponse = await OpenAIService.isGoodbye(userMessage);
        if (isGoodbyeResponse) {
            guideline = "You are a helpful AI Customer Service. Keep your responses concise and natural. The user wants to end the conversation.";
        }

        try {
            const intentHandlingResult = await OpenAIService.detectIntentAndHandle(userMessage, phoneNumber);
            console.log("Intent Handling Result:", intentHandlingResult);

            let aiResponse;
            if (intentHandlingResult !== "No action required.") {
                const appointmentResult = await AppointmentService.handleAppointment(
                    intentHandlingResult.action,
                    intentHandlingResult.phone_number,
                    intentHandlingResult.appointment_time
                );

                if (appointmentResult.error) {
                    aiResponse = `I apologize, but I encountered an error: ${appointmentResult.error}`;
                } else {
                    aiResponse = appointmentResult.message;
                }
            } else {
                aiResponse = await OpenAIService.getResponse(`${guideline}\n\n${history}\nUser: ${userMessage}\nAI:`);
            }

            console.log(`AI: ${aiResponse}`);
            conversationLog.push({ role: 'AI', content: aiResponse });

            const mediaMessage = await getTwilioMessage(aiResponse, streamSid);
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
            const aiResponse = await OpenAIService.getResponse(`${guideline}\n\n${history}\nUser: ${userMessage}\nAI:`);
            console.log(`AI: ${aiResponse}`);
            conversationLog.push({ role: 'AI', content: aiResponse });
            const mediaMessage = await getTwilioMessage(aiResponse, streamSid);
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
                console.log(`📞 Caller ID: ${callerId}`);
                phoneNumber = callerId;
                
                const customerInfo = await getCustomerInfo(callerId);
                let guideline = `You are a helpful AI Customer Service. Keep your responses concise and natural.`;
                if (customerInfo) {
                    guideline = `You are a AI Customer Service. The phone number is ${callerId}. You should call this customer is ${customerInfo.title} ${customerInfo.nickname}.
                    Say the welcome message to this customer.`;
                } else {
                    console.log(`No customer info found for ${callerId}`);
                    guideline = `You are a helpful AI Customer Service. Keep your responses concise and natural.
                    The caller maybe is new customer. You should ask for their name.`;
                }
                
                const welcomeMessage = await OpenAIService.getResponse(guideline);
                console.log(`AI: ${welcomeMessage}`);
                conversationLog.push({ role: 'assistant', content: welcomeMessage });
                ws.send(await getTwilioMessage(welcomeMessage, streamSid));
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

async function getAudioToTwilio(text) {
    try {
        const ttsAudio = await synthesizeSpeech(text);
        const mulawAudio = await convertToMulaw(ttsAudio);
        return mulawAudio;
    } catch (error) {
        console.error("❌ Error in TTS:", error);
    }
}

async function getTwilioMessage(text, streamSid) {
    const audio = await getAudioToTwilio(text);
    const base64Audio = Buffer.from(audio).toString('base64')
    const mediaMessage = JSON.stringify({
        event: "media",
        streamSid: streamSid,
        media: { payload: base64Audio },
    });
    return mediaMessage;
}

console.log('Listening on port 8000');
server.listen(8000);
