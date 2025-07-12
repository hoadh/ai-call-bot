# Transcriber Media Streams - API Documentation

## Overview

This project provides a real-time voice transcription and AI conversation system using Twilio media streams, AssemblyAI for transcription, OpenAI for AI responses, and Google Cloud Text-to-Speech for voice synthesis. The system enables interactive voice conversations with an AI assistant over phone calls.

## Table of Contents

1. [Server API Endpoints](#server-api-endpoints)
2. [WebSocket Events](#websocket-events)
3. [Core Functions](#core-functions)
4. [Text-to-Speech Module](#text-to-speech-module)
5. [Audio Conversion Module](#audio-conversion-module)
6. [Environment Variables](#environment-variables)
7. [Installation and Setup](#installation-and-setup)
8. [Usage Examples](#usage-examples)

---

## Server API Endpoints

### POST `/`
**Purpose**: Handles incoming Twilio voice calls and establishes media stream connections.

**Request Body Parameters**:
- `From` (string): The caller's phone number
- `CallSid` (string): Unique identifier for the call
- `host` (string): The server hostname (from headers)

**Response**: XML TwiML response that connects the call to a WebSocket media stream

**Example Request**:
```bash
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+1234567890&CallSid=CA1234567890abcdef"
```

**Example Response**:
```xml
<Response>
  <Connect>
    <Stream url='wss://your-domain.com'>
      <Parameter name="caller_id" value="+1234567890"/>
      <Parameter name="call_sid" value="CA1234567890abcdef"/>
      <Parameter name="host" value="your-domain.com"/>
    </Stream>
  </Connect>
</Response>
```

### POST `/forward`
**Purpose**: Forwards the current call to a human agent.

**Request Body**: None required

**Response**: XML TwiML response that dials the specified phone number

**Example Response**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>+84778980113</Dial>
</Response>
```

### GET `/`
**Purpose**: Health check endpoint.

**Response**: Plain text response confirming the service is running

**Example Response**:
```
Twilio media stream transcriber
```

---

## WebSocket Events

The WebSocket server handles real-time communication with Twilio media streams and manages the conversation flow.

### Connection Events

#### `connected`
**Triggered**: When Twilio media stream establishes connection
**Data**: Connection metadata
**Usage**: Initialize call parameters and send welcome message

#### `start`
**Triggered**: When media streaming begins
**Data**:
- `streamSid` (string): Unique stream identifier
- `customParameters` (object): Call metadata including caller_id, call_sid, host

#### `media`
**Triggered**: When audio data is received from Twilio
**Data**:
- `media.payload` (string): Base64 encoded audio data
**Usage**: Send audio to AssemblyAI for transcription

#### `stop`
**Triggered**: When media streaming ends
**Usage**: Clean up resources and save conversation log

---

## Core Functions

### `getResponse(prompt)`
**Purpose**: Generates AI responses using OpenAI's GPT-3.5-turbo model.

**Parameters**:
- `prompt` (string): The conversation context and user input

**Returns**: Promise<string> - AI-generated response

**Example Usage**:
```javascript
const response = await getResponse("User: Hello, how are you?\nAI:");
console.log(response); // "Hello! I'm doing well, thank you for asking. How can I help you today?"
```

### `getAudioToTwilio(text)`
**Purpose**: Converts text to speech and formats it for Twilio media streams.

**Parameters**:
- `text` (string): Text to convert to speech

**Returns**: Promise<Buffer> - Audio buffer in μ-law format

**Example Usage**:
```javascript
const audioBuffer = await getAudioToTwilio("Hello, welcome to our service!");
// Returns audio buffer ready for Twilio media stream
```

### `getTwilioMessage(text, streamSid)`
**Purpose**: Creates a Twilio media message with synthesized speech.

**Parameters**:
- `text` (string): Text to convert to speech
- `streamSid` (string): Stream identifier for the message

**Returns**: Promise<string> - JSON stringified media message

**Example Usage**:
```javascript
const mediaMessage = await getTwilioMessage("Thank you for calling!", "ST1234567890");
// Returns: {"event":"media","streamSid":"ST1234567890","media":{"payload":"base64AudioData"}}
```

### `isGoodbye(text)`
**Purpose**: Determines if the user wants to end the conversation.

**Parameters**:
- `text` (string): User's transcribed speech

**Returns**: Promise<boolean> - True if user wants to end conversation

**Example Usage**:
```javascript
const wantsToEnd = await isGoodbye("Goodbye, thank you for your help");
console.log(wantsToEnd); // true
```

---

## Text-to-Speech Module (`tts.js`)

### `synthesizeSpeech(text)`
**Purpose**: Converts text to speech using Google Cloud Text-to-Speech API.

**Parameters**:
- `text` (string): Text to synthesize

**Returns**: Promise<Buffer> - Audio buffer in LINEAR16 format

**Configuration**:
- Language: English (US)
- Voice: Neutral gender
- Audio Encoding: LINEAR16
- Sample Rate: 24000 Hz

**Example Usage**:
```javascript
import { synthesizeSpeech } from './tts.js';

const audioBuffer = await synthesizeSpeech("Hello, world!");
// Returns Buffer containing synthesized speech
```

---

## Audio Conversion Module (`convert.js`)

### `convertToMulaw(audioBuffer)`
**Purpose**: Converts LINEAR16 audio to μ-law format required by Twilio media streams.

**Parameters**:
- `audioBuffer` (Buffer): Audio buffer in LINEAR16 format

**Returns**: Promise<Buffer> - Audio buffer in μ-law format

**Conversion Details**:
- Input: LINEAR16, 24000 Hz, stereo
- Output: μ-law, 8000 Hz, mono
- Uses FFmpeg for conversion

**Example Usage**:
```javascript
import { convertToMulaw } from './convert.js';

const linear16Buffer = await synthesizeSpeech("Hello");
const mulawBuffer = await convertToMulaw(linear16Buffer);
// Returns μ-law formatted audio ready for Twilio
```

---

## Environment Variables

The following environment variables must be configured:

### Required Variables

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
```

### Optional Variables

```bash
# Server Configuration
PORT=8000  # Default: 8000
```

---

## Installation and Setup

### Prerequisites
- Node.js 18+ 
- FFmpeg installed on system
- Google Cloud account with Text-to-Speech API enabled
- Twilio account with voice capabilities
- AssemblyAI account
- OpenAI account

### Installation Steps

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd transcriber-media-streams
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your API keys and credentials
```

3. **Configure Google Cloud credentials**:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/google-tts-key.json"
```

4. **Create conversations directory**:
```bash
mkdir conversations
```

5. **Start the server**:
```bash
node server.js
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

---

## Usage Examples

### Basic Call Flow

1. **Incoming Call**: User dials your Twilio number
2. **Call Handling**: Server responds with TwiML to establish media stream
3. **Real-time Transcription**: AssemblyAI transcribes user speech
4. **AI Processing**: OpenAI generates responses based on conversation context
5. **Speech Synthesis**: Google TTS converts AI responses to speech
6. **Audio Conversion**: FFmpeg converts audio to Twilio-compatible format
7. **Response Delivery**: Audio sent back to user via media stream

### Conversation Management

The system maintains conversation logs for each call:

```javascript
// Conversation log structure
const conversationLog = [
  { role: 'assistant', content: 'Hello, welcome to the AI assistant.' },
  { role: 'user', content: 'Hello, how can you help me?' },
  { role: 'AI', content: 'I can help you with various tasks. What do you need?' }
];
```

### Call Forwarding

To forward a call to a human agent, the user can say "human" or similar phrases:

```javascript
// Automatic forwarding logic
if (userMessage.toLowerCase().includes("human")) {
  const forwardResponse = await client.calls(callSid).update({
    url: `https://${host}/forward`
  });
}
```

### Conversation End Detection

The system automatically detects when users want to end conversations:

```javascript
// Goodbye detection
const isGoodbyeResponse = await isGoodbye(userMessage);
if (isGoodbyeResponse) {
  // Send final message and close connection
  setTimeout(() => ws.close(), 2000);
}
```

---

## Error Handling

### Common Error Scenarios

1. **API Key Issues**: Check all environment variables are set correctly
2. **FFmpeg Errors**: Ensure FFmpeg is installed and accessible
3. **WebSocket Disconnections**: Automatic reconnection handling
4. **Audio Conversion Failures**: Graceful fallback with error logging

### Logging

The system provides comprehensive logging:
- Call events and metadata
- Transcription results
- AI response generation
- Audio processing status
- Error conditions

### Conversation Persistence

All conversations are automatically saved to JSON files:
```
conversations/conversation-ST1234567890-2024-01-15T10-30-45-123Z.json
```

---

## Performance Considerations

### Audio Processing
- Real-time transcription with AssemblyAI
- Efficient audio conversion with FFmpeg
- Optimized for Twilio's 8000 Hz μ-law format

### Memory Management
- Streaming audio processing
- Automatic cleanup of completed calls
- Efficient buffer handling

### Scalability
- WebSocket-based architecture
- Stateless API endpoints
- Concurrent call handling

---

## Security Considerations

### API Key Protection
- Store all API keys in environment variables
- Never commit credentials to version control
- Use secure credential management

### Call Security
- Validate Twilio webhook signatures
- Sanitize user inputs
- Implement rate limiting if needed

### Data Privacy
- Conversation logs stored locally
- No persistent storage of sensitive data
- Compliance with privacy regulations

---

## Troubleshooting

### Common Issues

1. **"FFmpeg not found"**: Install FFmpeg and ensure it's in PATH
2. **"Invalid API key"**: Verify all environment variables are set correctly
3. **"WebSocket connection failed"**: Check server is running and accessible
4. **"Audio quality issues"**: Verify audio conversion parameters

### Debug Mode

Enable detailed logging by setting:
```bash
DEBUG=* node server.js
```

### Health Checks

Monitor server health:
```bash
curl http://localhost:8000/
# Should return: "Twilio media stream transcriber"
```

---

## API Versioning

Current version: 1.0.0

### Changelog

- **v1.0.0**: Initial release with basic transcription and AI conversation capabilities

### Future Enhancements

- Multi-language support
- Custom voice models
- Advanced conversation analytics
- Integration with CRM systems
- Enhanced error recovery

---

## Support and Contributing

For issues, feature requests, or contributions:
1. Check the troubleshooting section
2. Review error logs in the console
3. Verify all dependencies are correctly installed
4. Ensure all API keys have proper permissions

---

*This documentation covers all public APIs, functions, and components of the Transcriber Media Streams project. For additional support or questions, refer to the individual service documentation for Twilio, AssemblyAI, OpenAI, and Google Cloud Text-to-Speech.*