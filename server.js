import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import 'dotenv/config';
import { RealtimeService } from 'assemblyai';
import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const server = createServer(app);
app.get('/', (_, res) => res.type('text').send('Twilio media stream transcriber'));
// Tell Twilio to say something and then establish a media stream with the WebSocket server
app.post('/', async (req, res) => {
    res.type('xml').send(
        `<Response>
        <Say>
          Speak to see your audio transcribed in the console.
        </Say>
        <Connect>
          <Stream url='wss://${req.headers.host}' />
        </Connect>
      </Response>`
    );
});

// the WebSocket server for the Twilio media stream to connect to.
const wss = new WebSocketServer({ server });
wss.on('connection', async (ws) => {
    console.log('Twilio media stream WebSocket connected')
    const transcriber = new RealtimeService({
        apiKey: process.env.ASSEMBLYAI_API_KEY,
        // Twilio media stream sends audio in mulaw format
        encoding: 'pcm_mulaw',
        // Twilio media stream sends audio at 8000 sample rate
        sampleRate: 8000
    })
    const transcriberConnectionPromise = transcriber.connect();
    transcriber.on('transcript.partial', (partialTranscript) => {
        // Don't print anything when there's silence
        if (!partialTranscript.text) return;
        // console.clear();
        console.log(partialTranscript.text + "\n");
    });
    transcriber.on('transcript.final', async (finalTranscript) => {
        console.clear();
        console.log(finalTranscript.text);
        const response = await getResponse(finalTranscript.text);
        console.log(`AI: ${response}`);
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
    })
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

console.log('Listening on port 8000');
server.listen(8000);
