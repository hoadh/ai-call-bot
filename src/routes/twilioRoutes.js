import express from 'express';
import logger from '../config/logger.js';
import config from '../config/index.js';
import twilio from 'twilio'; // Import the main twilio library

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

// Basic health check/info endpoint
router.get('/', (_, res) => res.type('text').send('Twilio media stream transcriber is running'));

// Handles incoming call webhook from Twilio
router.post('/', async (req, res) => {
    const { From: callerNumber, CallSid: callSid, To: twilioNumber } = req.body;
    const host = req.headers.host;
    const routeLogger = logger.child({ callSid, callerNumber, twilioNumber });

    routeLogger.info(`Incoming call POST request received`);
    routeLogger.debug({ body: req.body }, 'Request body');

    // Use config value for default/test SID
    const phoneNumberSid = twilioNumber?.trim() || config.twilio.testPhoneNumberSid; 
    routeLogger.info({ phoneNumberSid }, `Connecting call via WebSocket`);

    // Generate TwiML using the helper library
    const response = new VoiceResponse();
    const connect = response.connect();
    const stream = connect.stream({ url: `wss://${host}` });
    stream.parameter({ name: "caller_id", value: callerNumber });
    stream.parameter({ name: "phone_number_sid", value: phoneNumberSid });
    stream.parameter({ name: "call_sid", value: callSid });
    stream.parameter({ name: "host", value: host });

    res.type('xml');
    res.send(response.toString());
});

// Handles the webhook called by Twilio REST API during call forwarding
router.post("/forward", (req, res) => {
    const { transferTo } = req.query;
    const { CallSid: callSid } = req.body;
    const routeLogger = logger.child({ callSid, transferTo });

    // Basic validation for transferTo (is it non-empty?)
    // More complex validation (E.164 format, SIP URI format) could be added.
    routeLogger.info(`Call forward webhook triggered`);

    if (!transferTo || typeof transferTo !== 'string' || transferTo.trim().length === 0) {
        routeLogger.warn('Transfer destination number (transferTo) missing or invalid in query parameters.');
        const response = new VoiceResponse();
        response.say("Sorry, we could not transfer your call. The destination number was missing or invalid.");
        response.hangup();
        res.type('xml');
        return res.status(400).send(response.toString());
    }

    // Generate TwiML using the helper library
    const response = new VoiceResponse();
    response.dial(transferTo);
    
    res.set("Content-Type", "text/xml");
    res.send(response.toString());
});

export default router; 