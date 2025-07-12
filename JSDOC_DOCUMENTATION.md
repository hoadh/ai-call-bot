# JSDoc Documentation - Transcriber Media Streams

## Module: server.js

### WebSocket Server Configuration

```javascript
/**
 * WebSocket server for handling Twilio media streams
 * @type {WebSocketServer}
 */
const wss = new WebSocketServer({ server });
```

### Express Application

```javascript
/**
 * Express application for handling HTTP requests
 * @type {Express}
 */
const app = express();
```

---

## Functions

### getResponse(prompt)

```javascript
/**
 * Generates AI responses using OpenAI's GPT-3.5-turbo model
 * 
 * @async
 * @function getResponse
 * @param {string} prompt - The conversation context and user input
 * @returns {Promise<string>} AI-generated response
 * 
 * @example
 * const response = await getResponse("User: Hello, how are you?\nAI:");
 * console.log(response); // "Hello! I'm doing well, thank you for asking."
 * 
 * @throws {Error} When OpenAI API request fails
 * @throws {Error} When API key is invalid or missing
 */
async function getResponse(prompt) {
    // Implementation details...
}
```

### getAudioToTwilio(text)

```javascript
/**
 * Converts text to speech and formats it for Twilio media streams
 * 
 * @async
 * @function getAudioToTwilio
 * @param {string} text - Text to convert to speech
 * @returns {Promise<Buffer>} Audio buffer in μ-law format ready for Twilio
 * 
 * @example
 * const audioBuffer = await getAudioToTwilio("Hello, welcome to our service!");
 * // Returns Buffer containing μ-law encoded audio
 * 
 * @throws {Error} When TTS synthesis fails
 * @throws {Error} When audio conversion fails
 */
async function getAudioToTwilio(text) {
    // Implementation details...
}
```

### getTwilioMessage(text, streamSid)

```javascript
/**
 * Creates a Twilio media message with synthesized speech
 * 
 * @async
 * @function getTwilioMessage
 * @param {string} text - Text to convert to speech
 * @param {string} streamSid - Stream identifier for the message
 * @returns {Promise<string>} JSON stringified media message for Twilio
 * 
 * @example
 * const mediaMessage = await getTwilioMessage("Thank you for calling!", "ST1234567890");
 * // Returns: {"event":"media","streamSid":"ST1234567890","media":{"payload":"base64AudioData"}}
 * 
 * @throws {Error} When audio generation fails
 * @throws {Error} When streamSid is invalid
 */
async function getTwilioMessage(text, streamSid) {
    // Implementation details...
}
```

### isGoodbye(text)

```javascript
/**
 * Determines if the user wants to end the conversation
 * 
 * @async
 * @function isGoodbye
 * @param {string} text - User's transcribed speech
 * @returns {Promise<boolean>} True if user wants to end conversation
 * 
 * @example
 * const wantsToEnd = await isGoodbye("Goodbye, thank you for your help");
 * console.log(wantsToEnd); // true
 * 
 * @throws {Error} When OpenAI API request fails
 */
async function isGoodbye(text) {
    // Implementation details...
}
```

---

## Module: tts.js

### synthesizeSpeech(text)

```javascript
/**
 * Converts text to speech using Google Cloud Text-to-Speech API
 * 
 * @async
 * @function synthesizeSpeech
 * @param {string} text - Text to synthesize
 * @returns {Promise<Buffer>} Audio buffer in LINEAR16 format
 * 
 * @example
 * import { synthesizeSpeech } from './tts.js';
 * 
 * const audioBuffer = await synthesizeSpeech("Hello, world!");
 * // Returns Buffer containing synthesized speech in LINEAR16 format
 * 
 * @throws {Error} When Google Cloud TTS API request fails
 * @throws {Error} When API credentials are invalid
 * @throws {Error} When text is empty or invalid
 * 
 * @description
 * This function uses Google Cloud Text-to-Speech API with the following configuration:
 * - Language: English (US)
 * - Voice: Neutral gender
 * - Audio Encoding: LINEAR16
 * - Sample Rate: 24000 Hz
 * - Channels: Stereo
 */
export async function synthesizeSpeech(text) {
    // Implementation details...
}
```

---

## Module: convert.js

### convertToMulaw(audioBuffer)

```javascript
/**
 * Converts LINEAR16 audio to μ-law format required by Twilio media streams
 * 
 * @async
 * @function convertToMulaw
 * @param {Buffer} audioBuffer - Audio buffer in LINEAR16 format
 * @returns {Promise<Buffer>} Audio buffer in μ-law format
 * 
 * @example
 * import { convertToMulaw } from './convert.js';
 * 
 * const linear16Buffer = await synthesizeSpeech("Hello");
 * const mulawBuffer = await convertToMulaw(linear16Buffer);
 * // Returns μ-law formatted audio ready for Twilio
 * 
 * @throws {Error} When FFmpeg conversion fails
 * @throws {Error} When input buffer is invalid
 * @throws {Error} When FFmpeg is not installed
 * 
 * @description
 * This function performs the following audio conversion:
 * - Input: LINEAR16, 24000 Hz, stereo
 * - Output: μ-law, 8000 Hz, mono
 * - Uses FFmpeg for high-quality conversion
 * - Optimized for Twilio media stream requirements
 */
export function convertToMulaw(audioBuffer) {
    // Implementation details...
}
```

---

## Event Handlers

### WebSocket Connection Handler

```javascript
/**
 * Handles new WebSocket connections from Twilio media streams
 * 
 * @event connection
 * @param {WebSocket} ws - WebSocket connection instance
 * 
 * @description
 * This handler:
 * 1. Initializes AssemblyAI transcriber
 * 2. Sets up event listeners for transcription
 * 3. Handles incoming media streams
 * 4. Manages conversation flow
 * 5. Saves conversation logs on disconnect
 */
wss.on('connection', async (ws) => {
    // Implementation details...
});
```

### Transcription Event Handlers

```javascript
/**
 * Handles partial transcription results from AssemblyAI
 * 
 * @event transcript.partial
 * @param {Object} partialTranscript - Partial transcription data
 * @param {string} partialTranscript.text - Partial transcribed text
 * 
 * @description
 * Logs partial transcription results for real-time feedback
 */
transcriber.on('transcript.partial', (partialTranscript) => {
    // Implementation details...
});

/**
 * Handles final transcription results from AssemblyAI
 * 
 * @event transcript.final
 * @param {Object} finalTranscript - Final transcription data
 * @param {string} finalTranscript.text - Final transcribed text
 * 
 * @description
 * Processes final transcription, generates AI response, and sends audio back
 */
transcriber.on('transcript.final', async (finalTranscript) => {
    // Implementation details...
});
```

### WebSocket Message Handler

```javascript
/**
 * Handles incoming WebSocket messages from Twilio
 * 
 * @event message
 * @param {string} message - JSON stringified message from Twilio
 * 
 * @description
 * Processes different message types:
 * - 'connected': Initial connection established
 * - 'start': Media streaming started
 * - 'media': Audio data received
 * - 'stop': Media streaming stopped
 */
ws.on('message', async (message) => {
    // Implementation details...
});
```

---

## Data Structures

### Conversation Log Entry

```javascript
/**
 * @typedef {Object} ConversationLogEntry
 * @property {string} role - Role of the speaker ('user', 'assistant', 'AI')
 * @property {string} content - The message content
 * 
 * @example
 * const entry = {
 *   role: 'user',
 *   content: 'Hello, how can you help me?'
 * };
 */
```

### Twilio Media Message

```javascript
/**
 * @typedef {Object} TwilioMediaMessage
 * @property {string} event - Event type ('media')
 * @property {string} streamSid - Stream identifier
 * @property {Object} media - Media data
 * @property {string} media.payload - Base64 encoded audio data
 * 
 * @example
 * const mediaMessage = {
 *   event: "media",
 *   streamSid: "ST1234567890",
 *   media: { payload: "base64AudioData" }
 * };
 */
```

### AssemblyAI Transcription Result

```javascript
/**
 * @typedef {Object} TranscriptionResult
 * @property {string} text - Transcribed text
 * @property {boolean} isFinal - Whether this is a final result
 * 
 * @example
 * const result = {
 *   text: "Hello, how are you?",
 *   isFinal: true
 * };
 */
```

---

## Configuration Objects

### AssemblyAI Transcriber Configuration

```javascript
/**
 * @typedef {Object} TranscriberConfig
 * @property {string} apiKey - AssemblyAI API key
 * @property {string} encoding - Audio encoding ('pcm_mulaw')
 * @property {number} sampleRate - Audio sample rate (8000)
 * 
 * @example
 * const config = {
 *   apiKey: process.env.ASSEMBLYAI_API_KEY,
 *   encoding: 'pcm_mulaw',
 *   sampleRate: 8000
 * };
 */
```

### Google TTS Request Configuration

```javascript
/**
 * @typedef {Object} TTSRequest
 * @property {Object} input - Input configuration
 * @property {string} input.text - Text to synthesize
 * @property {Object} voice - Voice configuration
 * @property {string} voice.languageCode - Language code ('en-US')
 * @property {string} voice.ssmlGender - Voice gender ('NEUTRAL')
 * @property {Object} audioConfig - Audio configuration
 * @property {string} audioConfig.audioEncoding - Audio encoding ('LINEAR16')
 * @property {number} audioConfig.sampleRateHertz - Sample rate (24000)
 * 
 * @example
 * const request = {
 *   input: { text: "Hello, world!" },
 *   voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
 *   audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 }
 * };
 */
```

---

## Error Types

### API Errors

```javascript
/**
 * @typedef {Error} APIError
 * @property {string} message - Error message
 * @property {number} statusCode - HTTP status code
 * @property {string} apiName - Name of the API that failed
 * 
 * @example
 * const error = new Error("Invalid API key");
 * error.statusCode = 401;
 * error.apiName = "OpenAI";
 */
```

### Audio Processing Errors

```javascript
/**
 * @typedef {Error} AudioProcessingError
 * @property {string} message - Error message
 * @property {string} stage - Processing stage that failed
 * @property {string} inputFormat - Input audio format
 * @property {string} outputFormat - Expected output format
 * 
 * @example
 * const error = new Error("FFmpeg conversion failed");
 * error.stage = "conversion";
 * error.inputFormat = "LINEAR16";
 * error.outputFormat = "mulaw";
 */
```

---

## Constants

### Audio Configuration

```javascript
/**
 * @constant {Object} AUDIO_CONFIG
 * @description Default audio configuration for the system
 */
const AUDIO_CONFIG = {
    INPUT_SAMPLE_RATE: 24000,    // Google TTS output sample rate
    OUTPUT_SAMPLE_RATE: 8000,    // Twilio required sample rate
    INPUT_ENCODING: 'LINEAR16',  // Google TTS output encoding
    OUTPUT_ENCODING: 'pcm_mulaw', // Twilio required encoding
    INPUT_CHANNELS: 2,           // Stereo input
    OUTPUT_CHANNELS: 1           // Mono output
};
```

### API Endpoints

```javascript
/**
 * @constant {Object} ENDPOINTS
 * @description API endpoint configurations
 */
const ENDPOINTS = {
    ROOT: '/',
    FORWARD: '/forward',
    WEBSOCKET: 'wss://'
};
```

---

## Utility Functions

### Buffer Utilities

```javascript
/**
 * Converts Buffer to base64 string
 * 
 * @function bufferToBase64
 * @param {Buffer} buffer - Buffer to convert
 * @returns {string} Base64 encoded string
 * 
 * @example
 * const base64 = bufferToBase64(audioBuffer);
 */
function bufferToBase64(buffer) {
    return Buffer.from(buffer).toString('base64');
}

/**
 * Converts base64 string to Buffer
 * 
 * @function base64ToBuffer
 * @param {string} base64 - Base64 encoded string
 * @returns {Buffer} Decoded buffer
 * 
 * @example
 * const buffer = base64ToBuffer(base64String);
 */
function base64ToBuffer(base64) {
    return Buffer.from(base64, 'base64');
}
```

### File Utilities

```javascript
/**
 * Saves conversation log to file
 * 
 * @async
 * @function saveConversationLog
 * @param {Array<ConversationLogEntry>} conversationLog - Conversation entries
 * @param {string} streamSid - Stream identifier for filename
 * @returns {Promise<string>} Filename of saved conversation
 * 
 * @example
 * const filename = await saveConversationLog(conversationLog, "ST1234567890");
 * console.log(`Saved to: ${filename}`);
 */
async function saveConversationLog(conversationLog, streamSid) {
    // Implementation details...
}
```

---

## Performance Considerations

### Memory Management

```javascript
/**
 * Memory usage optimization strategies:
 * 
 * 1. Streaming audio processing to avoid large buffer accumulation
 * 2. Automatic cleanup of completed WebSocket connections
 * 3. Efficient buffer reuse for audio conversion
 * 4. Garbage collection of conversation logs after file save
 * 
 * @example
 * // Clean up resources after call ends
 * ws.on('close', async () => {
 *   await transcriber.close();
 *   conversationLog = null; // Free memory
 * });
 */
```

### Error Recovery

```javascript
/**
 * Error recovery strategies:
 * 
 * 1. Automatic reconnection for WebSocket disconnections
 * 2. Graceful degradation when APIs are unavailable
 * 3. Retry logic for transient failures
 * 4. Fallback responses when AI generation fails
 * 
 * @example
 * // Retry logic for API calls
 * async function retryOperation(operation, maxRetries = 3) {
 *   for (let i = 0; i < maxRetries; i++) {
 *     try {
 *       return await operation();
 *     } catch (error) {
 *       if (i === maxRetries - 1) throw error;
 *       await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
 *     }
 *   }
 * }
 */
```

---

*This JSDoc documentation provides detailed technical specifications for all functions, modules, and data structures in the Transcriber Media Streams project. Use this documentation for development, debugging, and integration purposes.*