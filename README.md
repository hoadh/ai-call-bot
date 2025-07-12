# Transcriber Media Streams

A real-time voice transcription and AI conversation system that enables interactive voice conversations with an AI assistant over phone calls using Twilio media streams, AssemblyAI for transcription, OpenAI for AI responses, and Google Cloud Text-to-Speech for voice synthesis.

## 🚀 Features

- **Real-time Voice Transcription**: Live speech-to-text using AssemblyAI
- **AI-Powered Conversations**: Contextual responses using OpenAI GPT-3.5-turbo
- **Text-to-Speech Synthesis**: Natural voice responses using Google Cloud TTS
- **Call Forwarding**: Seamless handoff to human agents
- **Conversation Logging**: Automatic saving of all conversations
- **Automatic Goodbye Detection**: Smart conversation ending
- **WebSocket Architecture**: Real-time bidirectional communication
- **Multi-format Audio Support**: Automatic audio conversion for Twilio compatibility

## 📋 Prerequisites

- Node.js 18+
- FFmpeg installed on system
- Google Cloud account with Text-to-Speech API enabled
- Twilio account with voice capabilities
- AssemblyAI account
- OpenAI account

## 🛠️ Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd transcriber-media-streams
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your API keys and credentials
```

4. **Configure Google Cloud credentials**:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/google-tts-key.json"
```

5. **Create conversations directory**:
```bash
mkdir conversations
```

6. **Start the server**:
```bash
node server.js
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# AssemblyAI Configuration
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Google Cloud Configuration
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/google-tts-key.json

# Server Configuration (Optional)
PORT=8000
```

### FFmpeg Installation

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS**:
```bash
brew install ffmpeg
```

**Windows**:
Download from https://ffmpeg.org/download.html

## 📖 Documentation

This project includes comprehensive documentation:

- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference with examples
- **[JSDoc Documentation](JSDOC_DOCUMENTATION.md)** - Technical function specifications
- **[Quick Reference Guide](QUICK_REFERENCE.md)** - Developer cheat sheet

## 🔄 How It Works

1. **Call Initiation**: User dials your Twilio phone number
2. **WebSocket Connection**: Server establishes real-time media stream
3. **Real-time Transcription**: AssemblyAI converts speech to text
4. **AI Processing**: OpenAI generates contextual responses
5. **Speech Synthesis**: Google TTS converts AI responses to speech
6. **Audio Conversion**: FFmpeg converts audio to Twilio-compatible format
7. **Response Delivery**: Audio sent back to user via media stream
8. **Conversation Logging**: All interactions saved to JSON files

## 🎯 Usage Examples

### Basic Call Flow
```javascript
// Handle incoming call
app.post('/', async (req, res) => {
  const { From, CallSid } = req.body;
  // Generate TwiML response for media stream
});

// Process real-time audio
ws.on('message', async (message) => {
  const msg = JSON.parse(message);
  if (msg.event === 'media') {
    transcriber.sendAudio(Buffer.from(msg.media.payload, 'base64'));
  }
});
```

### AI Response Generation
```javascript
// Generate contextual AI response
const response = await getResponse("User: Hello, how are you?\nAI:");
```

### Call Forwarding
```javascript
// Forward to human agent when user says "human"
if (userMessage.toLowerCase().includes("human")) {
  await client.calls(callSid).update({
    url: `https://${host}/forward`
  });
}
```

## 📊 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/` | Health check |
| `POST` | `/` | Handle incoming calls |
| `POST` | `/forward` | Forward to human agent |

## 🔗 External Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| **Twilio** | Voice calls & media streams | [Twilio Docs](https://www.twilio.com/docs) |
| **AssemblyAI** | Real-time transcription | [AssemblyAI Docs](https://www.assemblyai.com/docs) |
| **OpenAI** | AI conversation generation | [OpenAI Docs](https://platform.openai.com/docs) |
| **Google Cloud** | Text-to-speech synthesis | [Google Cloud Docs](https://cloud.google.com/text-to-speech/docs) |

## 🚨 Error Handling

The system includes comprehensive error handling:

- **API Key Validation**: Checks for required environment variables
- **FFmpeg Error Recovery**: Graceful handling of audio conversion failures
- **WebSocket Reconnection**: Automatic reconnection for dropped connections
- **Fallback Responses**: Default responses when AI generation fails

## 📝 Logging

All system events are logged with descriptive messages:

```javascript
console.log(`📞 Incoming call from: ${callerNumber}`);
console.log(`🎙️ Generating speech for: ${text}`);
console.log(`💾 Conversation saved to: ${filename}`);
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
ffmpeg -version
node --version
npm list
```

## 📁 Project Structure

```
transcriber-media-streams/
├── server.js                    # Main server file
├── tts.js                      # Text-to-speech module
├── convert.js                  # Audio conversion module
├── package.json                # Dependencies
├── .env                        # Environment variables
├── conversations/              # Saved conversation logs
├── API_DOCUMENTATION.md        # Complete API reference
├── JSDOC_DOCUMENTATION.md      # Technical specifications
├── QUICK_REFERENCE.md          # Developer cheat sheet
└── README.md                   # This file
```

## 🛡️ Security Considerations

- **API Key Protection**: All credentials stored in environment variables
- **Input Validation**: Sanitization of user inputs
- **Secure Communication**: HTTPS/WSS for all external communications
- **Data Privacy**: Local storage of conversation logs only

## 🚀 Performance Optimization

- **Streaming Audio Processing**: Efficient memory usage
- **Concurrent Call Handling**: Multiple simultaneous conversations
- **Automatic Resource Cleanup**: Memory management for completed calls
- **Optimized Audio Conversion**: Minimal latency audio processing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For issues, feature requests, or questions:

1. Check the [troubleshooting section](API_DOCUMENTATION.md#troubleshooting)
2. Review the [quick reference guide](QUICK_REFERENCE.md)
3. Consult the [detailed API documentation](API_DOCUMENTATION.md)
4. Check error logs in the console
5. Verify all dependencies are correctly installed

## 🔄 Changelog

### v1.0.0
- Initial release with basic transcription and AI conversation capabilities
- Real-time voice transcription with AssemblyAI
- AI-powered responses with OpenAI
- Text-to-speech synthesis with Google Cloud
- Call forwarding functionality
- Conversation logging and persistence

---

*For detailed technical documentation, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md), [JSDOC_DOCUMENTATION.md](JSDOC_DOCUMENTATION.md), and [QUICK_REFERENCE.md](QUICK_REFERENCE.md).*