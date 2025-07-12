# Quick Reference Guide - Transcriber Media Streams

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start server
node server.js
```

## 📋 API Endpoints

| Method | Endpoint | Purpose | Parameters |
|--------|----------|---------|------------|
| `GET` | `/` | Health check | None |
| `POST` | `/` | Handle incoming calls | `From`, `CallSid` |
| `POST` | `/forward` | Forward to human agent | None |

## 🔧 Core Functions

### AI Response Generation
```javascript
// Generate AI response
const response = await getResponse("User: Hello\nAI:");
```

### Text-to-Speech
```javascript
// Convert text to speech
import { synthesizeSpeech } from './tts.js';
const audio = await synthesizeSpeech("Hello, world!");
```

### Audio Conversion
```javascript
// Convert to Twilio format
import { convertToMulaw } from './convert.js';
const mulawAudio = await convertToMulaw(audioBuffer);
```

### Conversation Management
```javascript
// Check if user wants to end
const isEnding = await isGoodbye("Goodbye, thanks");
```

## 🌐 WebSocket Events

| Event | Trigger | Data |
|-------|---------|------|
| `connected` | WebSocket connected | Connection metadata |
| `start` | Media streaming starts | `streamSid`, `customParameters` |
| `media` | Audio data received | `media.payload` (base64) |
| `stop` | Media streaming ends | None |

## 🔑 Environment Variables

```bash
# Required
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
ASSEMBLYAI_API_KEY=your_key
OPENAI_API_KEY=your_key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# Optional
PORT=8000
```

## 📊 Data Structures

### Conversation Log Entry
```javascript
{
  role: 'user' | 'assistant' | 'AI',
  content: 'message text'
}
```

### Twilio Media Message
```javascript
{
  event: 'media',
  streamSid: 'ST1234567890',
  media: { payload: 'base64AudioData' }
}
```

## 🎯 Common Use Cases

### 1. Handle Incoming Call
```javascript
app.post('/', async (req, res) => {
  const { From, CallSid } = req.body;
  // Generate TwiML response
  res.type('xml').send(twimlResponse);
});
```

### 2. Process Real-time Audio
```javascript
ws.on('message', async (message) => {
  const msg = JSON.parse(message);
  if (msg.event === 'media') {
    const audio = Buffer.from(msg.media.payload, 'base64');
    transcriber.sendAudio(audio);
  }
});
```

### 3. Generate AI Response
```javascript
transcriber.on('transcript.final', async (finalTranscript) => {
  const aiResponse = await getResponse(prompt);
  const audio = await getTwilioMessage(aiResponse, streamSid);
  ws.send(audio);
});
```

### 4. Forward Call
```javascript
if (userMessage.toLowerCase().includes("human")) {
  await client.calls(callSid).update({
    url: `https://${host}/forward`
  });
}
```

## 🔧 Configuration

### AssemblyAI Transcriber
```javascript
const transcriber = new RealtimeTranscriber({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
  encoding: 'pcm_mulaw',
  sampleRate: 8000
});
```

### Google TTS
```javascript
const request = {
  input: { text: text },
  voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
  audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 }
};
```

### FFmpeg Conversion
```javascript
ffmpeg(stream)
  .inputFormat("s16le")
  .inputOptions(["-ar 24000"])
  .audioCodec("pcm_mulaw")
  .audioChannels(1)
  .audioFrequency(8000)
  .format("mulaw")
```

## 🚨 Error Handling

### Common Errors
```javascript
// API Key Issues
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OpenAI API key not found');
}

// FFmpeg Errors
ffmpeg.on("error", (err) => {
  console.error(`FFmpeg Error: ${err.message}`);
});

// WebSocket Errors
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### Retry Logic
```javascript
async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## 📝 Logging

### Console Output
```javascript
console.log(`📞 Incoming call from: ${callerNumber}`);
console.log(`🎙️ Generating speech for: ${text}`);
console.log(`💾 Conversation saved to: ${filename}`);
```

### Error Logging
```javascript
console.error('❌ Error in TTS:', error);
console.error('❌ Error sending message:', error);
```

## 🔍 Debugging

### Enable Debug Mode
```bash
DEBUG=* node server.js
```

### Health Check
```bash
curl http://localhost:8000/
# Should return: "Twilio media stream transcriber"
```

### Check Dependencies
```bash
# Check FFmpeg
ffmpeg -version

# Check Node.js
node --version

# Check npm packages
npm list
```

## 📁 File Structure

```
transcriber-media-streams/
├── server.js          # Main server file
├── tts.js            # Text-to-speech module
├── convert.js        # Audio conversion module
├── package.json      # Dependencies
├── .env              # Environment variables
├── conversations/    # Saved conversation logs
└── README.md         # Basic setup instructions
```

## 🔄 Workflow

1. **Call Initiation**: User dials Twilio number
2. **WebSocket Connection**: Server establishes media stream
3. **Audio Processing**: Real-time transcription with AssemblyAI
4. **AI Response**: OpenAI generates contextual responses
5. **Speech Synthesis**: Google TTS converts text to speech
6. **Audio Conversion**: FFmpeg converts to Twilio format
7. **Response Delivery**: Audio sent back to user
8. **Logging**: Conversation saved to file

## 🎯 Key Features

- ✅ Real-time voice transcription
- ✅ AI-powered conversation
- ✅ Text-to-speech synthesis
- ✅ Call forwarding to humans
- ✅ Conversation logging
- ✅ Automatic goodbye detection
- ✅ WebSocket-based architecture
- ✅ Multi-format audio support

## 🔗 External Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Twilio** | Voice calls & media streams | Account SID, Auth Token |
| **AssemblyAI** | Real-time transcription | API Key |
| **OpenAI** | AI conversation generation | API Key |
| **Google Cloud** | Text-to-speech synthesis | Service Account Key |
| **FFmpeg** | Audio format conversion | System installation |

## 📞 Call Flow Example

```
User calls → Twilio → Server → WebSocket → AssemblyAI → OpenAI → Google TTS → FFmpeg → Twilio → User hears response
```

## 🛠️ Development Tips

1. **Test with ngrok**: Use ngrok for local development with Twilio
2. **Monitor logs**: Watch console output for debugging
3. **Check API limits**: Monitor usage across all services
4. **Audio quality**: Ensure proper sample rates and encoding
5. **Error handling**: Implement graceful degradation
6. **Security**: Never commit API keys to version control

---

*This quick reference provides essential information for developers working with the Transcriber Media Streams project. For detailed documentation, see `API_DOCUMENTATION.md` and `JSDOC_DOCUMENTATION.md`.*