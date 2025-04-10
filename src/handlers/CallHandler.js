import { RealtimeTranscriber } from 'assemblyai';
import { wsErrorHandler } from '../middleware/errorHandler.js';
import { ExternalServiceError } from '../services/error/AppError.js';
import config from '../config/index.js'; // Import config

// TODO: Import necessary services (LLM, Business, Language, Conversation, Audio, Twilio, Logger)

export class CallHandler {
    constructor(ws, { logger, llmService, businessService, languageService, conversationService, twilioService }) {
        this.ws = ws;
        this.logger = logger || console; // Store logger
        this.llmService = llmService;
        this.businessService = businessService;
        this.languageService = languageService;
        this.conversationService = conversationService;
        this.twilioService = twilioService;

        // Call state
        this.streamSid = null;
        this.phoneNumber = null;
        this.phoneNumberSid = null;
        this.conversationLog = [];
        this.customerInfo = null;
        this.currentLanguage = 'en';
        this.callSid = null;
        this.host = null;

        this.transcriber = null;
        this.transcriberConnectionPromise = null;

        this.logger.info('CallHandler initialized.');
        this.initialize();
    }

    async initialize() {
        this.logger.debug('Initializing RealtimeTranscriber...');
        this.transcriber = new RealtimeTranscriber({
            apiKey: config.assemblyAi.apiKey, // Use config value
            encoding: 'pcm_mulaw',
            sampleRate: 8000
        });

        try {
            this.transcriberConnectionPromise = this.transcriber.connect();

            this.transcriber.on('open', this.handleTranscriberOpen.bind(this));
            this.transcriber.on('transcript.partial', this.handleTranscriberPartial.bind(this));
            this.transcriber.on('transcript.final', this.handleTranscriberFinal.bind(this));
            this.transcriber.on('error', this.handleTranscriberError.bind(this));
            this.transcriber.on('close', this.handleTranscriberClose.bind(this));

            this.ws.on('message', this.handleWsMessage.bind(this));
            this.ws.on('close', this.handleWsClose.bind(this));

            await this.transcriberConnectionPromise;
            this.logger.info('Transcriber connection established.');
        } catch (error) {
            this.logger.error({ err: error }, 'Transcriber connection failed.');
            wsErrorHandler(error, this.ws); // Use existing WS error handler
        }
    }
    
    handleTranscriberOpen() {
        this.logger.info('Transcriber connection open.');
    }

    handleTranscriberPartial(partialTranscript) {
        if (!partialTranscript.text) return;
        // Log partial transcripts at trace level if desired, or debug
        this.logger.trace({ transcript: partialTranscript.text }, "Partial transcript received"); 
    }

    async handleTranscriberFinal(finalTranscript) {
        this.logger.debug({ transcript: finalTranscript.text }, 'Final transcript received.');
        try {
            const userMessage = finalTranscript.text;

            // Add message details to logger context for subsequent logs in this method
            const messageLogger = this.logger.child({ userMessage: userMessage });

            messageLogger.info(`User: ${userMessage}`);
            this.conversationLog.push({ role: 'user', content: userMessage });

            // Detect language
            this.currentLanguage = await this.languageService.detectLanguage(userMessage);
            messageLogger.info({ language: this.currentLanguage }, "Detected Language");

            const intent = await this.llmService.detectIntent(userMessage);
            messageLogger.info({ intent: intent }, "Detected Intent");

            const history = this.conversationLog.map((message) => (message.role === 'user') ? `User: ${message.content}` : `AI: ${message.content}`).join('\\n');
            let guideline = await this.businessService.getSystemPrompt(this.currentLanguage, this.phoneNumberSid);
            
            const isGoodbyeResponse = await this.llmService.isGoodbye(userMessage);
            if (isGoodbyeResponse) {
                guideline = await this.businessService.getGoodbyePrompt(this.currentLanguage, this.phoneNumberSid);
            }

            const intentHandlingResult = await this.llmService.detectIntentAndHandle(userMessage, this.phoneNumber);
            messageLogger.info({ result: intentHandlingResult }, "Intent Handling Result");

            let aiResponse;
            if (intentHandlingResult !== "No action required.") {
                const businessResult = await this.businessService.handleIntent(
                    intent,
                    userMessage,
                    this.phoneNumber,
                    this.customerInfo,
                    this.currentLanguage,
                    this.phoneNumberSid
                );
                messageLogger.debug({ businessResult }, "Business intent handling result");

                if (businessResult.shouldTransfer) {
                    messageLogger.info("Initiating call transfer...");
                    const transferNumber = this.businessService.getTransferNumber(this.phoneNumberSid);
                    await this.twilioService.forwardCall(this.callSid, this.host, transferNumber);
                    messageLogger.info("Call transfer initiated.");
                    return; 
                }
                aiResponse = businessResult.response;
            }

            if (!aiResponse) {
                messageLogger.debug("Generating generic LLM response.");
                aiResponse = await this.llmService.getResponse(`${guideline}\\n\\n${history}\\nUser: ${userMessage}\\nAI:`);
                if (this.currentLanguage !== 'en') {
                    aiResponse = await this.languageService.translate(aiResponse, this.currentLanguage);
                }
            }

            messageLogger.info(`AI: ${aiResponse}`);
            this.conversationLog.push({ role: 'AI', content: aiResponse });

            const mediaMessage = await this.twilioService.getTwilioMessage(aiResponse, this.streamSid, this.currentLanguage);
            this.ws.send(mediaMessage, (error) => {
                if (error) {
                    messageLogger.error({ err: error }, "WebSocket send error");
                    // Rethrow or handle as appropriate
                    throw new ExternalServiceError('WebSocket', `Error sending message: ${error.message}`);
                } else if (isGoodbyeResponse) {
                    messageLogger.info('Final message sent. Closing connection soon.');
                    const delay = Math.ceil(2000);
                    setTimeout(() => this.ws.close(), delay);
                }
            });
        } catch (error) {
            this.logger.error({ err: error }, 'Error processing final transcript.');
            wsErrorHandler(error, this.ws);
        }
    }

    handleTranscriberError(error) {
        this.logger.error({ err: error }, 'Transcriber error.');
        wsErrorHandler(new ExternalServiceError('Transcription', error.message), this.ws);
    }

    handleTranscriberClose() {
        this.logger.info('Transcriber connection closed.');
    }

    async handleWsMessage(message) {
        let msg;
        try {
            msg = JSON.parse(message);
            this.logger.debug({ event: msg?.event }, 'Received WebSocket message');

            switch (msg.event) {
                case 'connected':
                    this.logger.info('Twilio media stream signaling connected.');
                    break;
                case 'start':
                    this.logger.info('Twilio media stream started.');
                    this.streamSid = msg.streamSid;
                    const { customParameters } = msg.start;
                    const callerId = customParameters.caller_id.replace('+', '').replace('client:', '');
                    this.phoneNumberSid = customParameters.phone_number_sid;
                    this.callSid = msg.start.callSid; // Use callSid from start event
                    this.host = customParameters.host;
                    this.logger.info({ callerId, phoneNumberSid: this.phoneNumberSid, callSid: this.callSid, streamSid: this.streamSid }, 'Call started');
                    this.phoneNumber = callerId;
                    
                    this.customerInfo = await this.businessService.getCustomerInfo(callerId);
                    const welcomeMessage = await this.businessService.getWelcomeMessage(this.customerInfo, this.currentLanguage, this.phoneNumberSid);
                    this.logger.info(`AI Welcome: ${welcomeMessage}`);
                    this.conversationLog.push({ role: 'assistant', content: welcomeMessage });
                    
                    const twilioMessage = await this.twilioService.getTwilioMessage(welcomeMessage, this.streamSid, this.currentLanguage);
                    this.ws.send(twilioMessage);
                    break;
                case 'media':
                    this.logger.trace('Received media payload.'); // Avoid logging actual payload unless debugging
                    if (!this.transcriberConnectionPromise) {
                         this.logger.warn('Received media before transcriber connection promise exists.');
                         return;
                    }
                    await this.transcriberConnectionPromise;
                    this.transcriber.sendAudio(Buffer.from(msg.media.payload, 'base64'));
                    break;
                case 'stop':
                    this.logger.info('Twilio media stream stopped.');
                    break;
                default:
                    this.logger.warn({ event: msg?.event }, 'Received unknown WebSocket event type');
                    break;
            }
        } catch (error) {
            this.logger.error({ err: error, rawMessage: message }, 'Error processing WebSocket message.');
            wsErrorHandler(error, this.ws); // Delegate actual WS error response
        }
    }

    async handleWsClose() {
        this.logger.info('WebSocket disconnected.');
        if (this.transcriber) {
            await this.transcriber.close(); // Ensure transcriber is closed
            this.logger.debug('Transcriber closed due to WebSocket disconnection.');
        }

        try {
            if (this.conversationLog.length > 0) {
                 this.logger.info({ streamSid: this.streamSid, logLength: this.conversationLog.length }, 'Saving conversation log.');
                 await this.conversationService.saveConversation(this.conversationLog, this.streamSid);
                 this.logger.info({ streamSid: this.streamSid }, 'Conversation log saved.');
            }
        } catch (error) {
            this.logger.error({ err: error, streamSid: this.streamSid }, `Failed to save conversation log.`);
        }
    }
}

// TODO: Remove these global placeholders once TwilioService is created
global.getTwilioMessage = async () => { console.warn("Using placeholder getTwilioMessage"); return ""; };
global.forwardCall = async () => { console.warn("Using placeholder forwardCall"); }; 