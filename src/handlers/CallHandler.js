import { SpeechClient } from '@google-cloud/speech';
import { PassThrough } from 'stream';
import { wsErrorHandler } from '../middleware/errorHandler.js';
import { ExternalServiceError } from '../services/error/AppError.js';
import config from '../config/index.js'; // Optional if needed

export class CallHandler {
    constructor(ws, { logger, llmService, businessService, languageService, conversationService, twilioService }) {
        this.ws = ws;
        this.logger = logger || console;
        this.llmService = llmService;
        this.businessService = businessService;
        this.languageService = languageService;
        this.conversationService = conversationService;
        this.twilioService = twilioService;

        this.streamSid = null;
        this.phoneNumber = null;
        this.phoneNumberSid = null;
        this.conversationLog = [];
        this.customerInfo = null;
        this.currentLanguage = 'en';
        this.callSid = null;
        this.host = null;

        // Google Speech client and stream
        this.speechClient = new SpeechClient();
        this.audioStream = new PassThrough(); // Audio stream to feed into Google
        this.googleStream = null;

        this.logger.info('CallHandler initialized.');
        this.initialize();
    }

    async initialize() {
        try {
            const request = {
                config: {
                    encoding: 'MULAW',
                    sampleRateHertz: 8000,
                    languageCode: 'en-US',
                    enableAutomaticPunctuation: true
                },
                interimResults: true,
            };

            this.googleStream = this.speechClient
                .streamingRecognize(request)
                .on('error', this.handleTranscriberError.bind(this))
                .on('data', this.handleTranscriberData.bind(this));

            this.audioStream.pipe(this.googleStream);

            this.ws.on('message', this.handleWsMessage.bind(this));
            this.ws.on('close', this.handleWsClose.bind(this));

            this.logger.info('Google Speech stream initialized.');
        } catch (error) {
            this.logger.error({ err: error }, 'Failed to initialize Google Speech stream.');
            wsErrorHandler(error, this.ws);
        }
    }

    handleTranscriberError(error) {
        this.logger.error({ err: error }, 'Google Speech-to-Text error.');
        wsErrorHandler(new ExternalServiceError('Transcription', error.message), this.ws);
    }

    async handleTranscriberData(data) {
        const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || '';
        const isFinal = data.results?.[0]?.isFinal;

        if (!transcript) return;

        if (isFinal) {
            this.logger.debug({ transcript }, 'Final transcript received.');
            await this.handleTranscriberFinal({ text: transcript });
        } else {
            this.logger.trace({ transcript }, 'Partial transcript received.');
        }
    }

    // Keep this method unchanged
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

            let aiResponse = null; // Initialize to null
            let transferInitiated = false; // Flag

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
                    transferInitiated = true; // Set flag
                } else {
                    aiResponse = businessResult.response; // Only assign if not transferring
                }
            }

            // Only generate generic response if no specific response was set AND no transfer happened
            if (aiResponse === null && !transferInitiated) {
                messageLogger.debug("Generating generic LLM response.");
                aiResponse = await this.llmService.getResponse(`${guideline}\\n\\n${history}\\nUser: ${userMessage}\\nAI:`);
                if (this.currentLanguage !== 'en') {
                    aiResponse = await this.languageService.translate(aiResponse, this.currentLanguage);
                }
            }

            // Only send response if a response exists and no transfer happened
            if (aiResponse !== null && !transferInitiated) {
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
                        const delay = Math.ceil(2000); // TODO: Make delay configurable?
                        setTimeout(() => this.ws.close(), delay);
                    }
                });
            } else if (transferInitiated) {
                messageLogger.info("Transfer initiated, no AI response sent.");
            } else {
                // Case where no action was required and no generic response needed (should this happen?)
                messageLogger.info("No AI response generated or sent.");
            }
        } catch (error) {
            this.logger.error({ err: error }, 'Error processing final transcript.');
            wsErrorHandler(error, this.ws);
        }
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
                    this.callSid = msg.start.callSid;
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
                    this.logger.trace('Received media payload.');
                    const audioBuffer = Buffer.from(msg.media.payload, 'base64');
                    this.audioStream.write(audioBuffer); // Pipe to Google
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
            wsErrorHandler(error, this.ws);
        }
    }

    async handleWsClose() {
        this.logger.info('WebSocket disconnected.');

        // End Google stream cleanly
        if (this.audioStream) {
            this.audioStream.end();
            this.logger.debug('Audio stream ended.');
        }

        if (this.googleStream) {
            this.googleStream.destroy(); // Ends the recognition stream
            this.logger.debug('Google speech stream destroyed.');
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
