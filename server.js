import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import 'dotenv/config';
import { RealtimeTranscriber } from 'assemblyai';
import { synthesizeSpeech } from "./tts.js";
import { convertToMulaw } from "./convert.js";

import twilio from 'twilio';
import pkg from 'twilio';
const { twiml: Twiml } = pkg;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Initialize OpenAI client
import { OpenAI } from 'openai';
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEYl
});

const app = express();
app.use(express.urlencoded({ extended: true }));
const server = createServer(app);
app.get('/', (_, res) => res.type('text').send('Twilio media stream transcriber'));
// Tell Twilio to say something and then establish a media stream with the WebSocket server
app.post('/', async (req, res) => {
    const callerNumber = req.body.From;
    const callSid = req.body.CallSid;
    const host = req.headers.host;
    console.log(`📞 Incoming call from: ${callerNumber}`);
    res.type('xml').send(
        `<Response>
        <Connect>
          <Stream url='wss://${req.headers.host}'>
            <Parameter name="caller_id" value="${callerNumber}"/>
            <Parameter name="call_sid" value="${callSid}"/>
            <Parameter name="host" value="${host}"/>
          </Stream>
        </Connect>
      </Response>`
    );
});


// Forward endpoint
app.post('/forward', (req, res) => {
    const response = new Twiml.VoiceResponse();
  
    // Replace with the phone number you want to forward the call to
    response.dial('+84778980113');
  
    res.type('text/xml');
    res.send(response.toString());
});
  

// the WebSocket server for the Twilio media stream to connect to.
const wss = new WebSocketServer({ server });
wss.on('connection', async (ws) => {
    let streamSid = null;
    let callSid = null;
    let host = null;
    let conversationLog = []; // Initialize conversation log for the call
    console.log('Twilio media stream WebSocket connected');
    const transcriber = new RealtimeTranscriber({
        apiKey: process.env.ASSEMBLYAI_API_KEY,
        // Twilio media stream sends audio in mulaw format
        encoding: 'pcm_mulaw',
        // Twilio media stream sends audio at 8000 sample rate
        sampleRate: 8000
    })
    const transcriberConnectionPromise = transcriber.connect();
    transcriber.on('transcript.partial', (partialTranscript) => {
        if (!partialTranscript.text) return;
        console.log(partialTranscript.text + "\n");
    });
    transcriber.on('transcript.final', async (finalTranscript) => {
        console.clear();
        const userMessage = finalTranscript.text;

        // Log user input
        console.log(`User: ${userMessage}`);
        conversationLog.push({ role: 'user', content: userMessage });

        // Get history of conversation
        const history = conversationLog.map((message) => (message.role === 'user') ? `User: ${message.content}` : `AI: ${message.content}`).join('\n');
        let guideline = "You are a helpful AI assistant. Keep your responses concise and natural.";
        
        // Use OpenAI to detect if the user wants to say goodbye
        const isGoodbyeResponse = await isGoodbye(userMessage);
        if (isGoodbyeResponse) {
            guideline = "You are a helpful AI assistant. Keep your responses concise and natural. The user wants to end the conversation.";
        }

        // Forward the call to the next available agent
        if (userMessage.toLowerCase().includes("human")) {
            console.log(`Forwarding call to: ${host}/forward`);
            const forwardResponse = await client.calls(callSid).update({
                url: `https://${host}/forward`
            });
            console.log(`Forwarded call to: ${JSON.stringify(forwardResponse)}`);
            return;
        }

        const aiResponse = await getResponse(`${guideline}\n\n${history}\nUser: ${userMessage}\nAI:`);
        console.log(`AI: ${aiResponse}`);
        conversationLog.push({ role: 'AI', content: aiResponse });

        const mediaMessage = await getTwilioMessage(aiResponse, streamSid);
        ws.send(mediaMessage, (error) => {
            if (error) {
                console.error('❌ Error sending final message:', error);
            } else if (isGoodbyeResponse) {
                console.log('Final message sent. Closing connection...');
                const delay = Math.ceil(2000); // Convert duration to milliseconds
                setTimeout(() => ws.close(), delay); // Delay based on audio duration
            }
        });
    });

    transcriber.on('open', () => console.log('Connected to real-time service'));
    transcriber.on('error', console.error);
    transcriber.on('close', () => console.log('Disconnected from real-time service'));
    // Message from Twilio media stream
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
                const callerId = customParameters.caller_id;
                callSid = customParameters.call_sid;
                host = customParameters.host;
                console.log(`📞 Caller ID: ${callerId}`);
                console.log(`📞 Call SID: ${callSid}`);
                console.log(`📞 Host: ${host}`);
                const welcomeMessage = `Hello ${callerId}, welcome to the AI assistant.`;
                conversationLog.push({ role: 'assistant', content: welcomeMessage });
                ws.send(await getTwilioMessage(welcomeMessage, streamSid));
                break;
            case 'media':
                // Make sure the transcriber is connected before sending audio
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

        // Save conversation log to a file
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

async function getResponse(prompt) {
    // Get AI response from OpenAI
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "system",
                content: "You are a helpful AI assistant. Keep your responses concise and natural."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        max_tokens: 150
    });

    const aiResponse = completion.choices[0].message.content;
    return aiResponse;
}

async function getAudioToTwilio(text) {
    // console.log("🎙️ Generating speech for:", text);
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

async function isGoodbye(text) {
    const prompt = `Determine if the user wants to end the conversation. Respond with "yes" or "no".\n\nUser: ${text}\nDoes the user want to end the conversation?`;
    const intentResponse = await getResponse(prompt);
    console.log(`Intent response: ${intentResponse}`);
    return intentResponse.trim().toLowerCase() === 'yes'
        || intentResponse.trim().toLowerCase() === 'yes.'
        || intentResponse.trim().toLowerCase().startsWith('yes');
}


console.log('Listening on port 8000');
server.listen(8000);
