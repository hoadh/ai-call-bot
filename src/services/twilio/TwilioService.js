import twilio from 'twilio';
import config from '../../config/index.js'; // Import config

export class TwilioService {
    constructor(logger, ttsService, audioConversionFunction) {
        this.logger = logger || console;
        // Credentials are now validated in config/index.js
        // Remove direct process.env access and redundant checks here
        // if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        //     throw new Error("Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are missing in environment variables.");
        // }
        this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken); // Use config values
        
        // Store injected dependencies
        if (!ttsService) throw new Error("TTSService dependency is required.");
        if (!audioConversionFunction) throw new Error("Audio conversion function dependency is required.");
        this.ttsService = ttsService;
        this.convertToMulaw = audioConversionFunction; // Store the conversion function

        this.logger.info("Twilio client initialized.");
    }

    async getTwilioMessage(text, streamSid, language = 'en') {
        this.logger.debug({ streamSid, language, textLength: text.length }, "Generating Twilio media message");
        try {
            const ttsAudio = await this.ttsService.synthesizeSpeech(text, language);
            const mulawAudio = await this.convertToMulaw(ttsAudio); // Use the injected function
            const base64Audio = mulawAudio.toString('base64');

            const message = JSON.stringify({
                event: 'media',
                streamSid: streamSid,
                media: {
                    payload: base64Audio,
                },
            });
            this.logger.debug({ streamSid, messageSize: message.length }, "Generated Twilio media message successfully");
            return message;
        } catch (error) {
            this.logger.error({ err: error, streamSid, language, text }, `Error generating Twilio message`);
            throw error;
        }
    }
    
    async forwardCall(callSid, host, transferTo) {
        // Basic input validation
        if (!callSid || !host || !transferTo) {
            const errorMsg = "Invalid input for forwardCall: callSid, host, and transferTo are required.";
            this.logger.error({ callSid, host, transferTo }, errorMsg);
            throw new Error(errorMsg);
        }

        // Construct URL robustly
        let forwardUrl;
        try {
            const url = new URL(`https://${host}/forward`);
            url.searchParams.set('transferTo', transferTo);
            forwardUrl = url.toString();
        } catch (error) {
             this.logger.error({ err: error, host }, "Invalid host provided for forwardCall URL construction.");
             throw new Error(`Invalid host format: ${host}`);
        }
        
        // (Removed TODO about URL pointing back - this is the intended mechanism)
        this.logger.info({ callSid, transferTo, forwardUrl }, `Forwarding call`);

        try {
            await this.twilioClient.calls(callSid).update({ url: forwardUrl, method: 'POST' });
            this.logger.info({ callSid }, `Call update initiated for forwarding.`);
        } catch (error) {
            // (Removed TODO about specific error handling - logging is sufficient for now)
            this.logger.error({ err: error, callSid, forwardUrl }, `Failed to forward call`);
            throw new Error(`Twilio API error during call forward: ${error.message}`);
        }
    }
}