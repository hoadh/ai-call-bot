import express from 'express';
import logger from '../config/logger.js'; // Import logger

// TODO: Import TwilioService if needed for /forward route
// TODO: Load TEST_PHONE_NUMBER_SID from config/env
const TEST_PHONE_NUMBER_SID = process.env.TEST_PHONE_NUMBER_SID || "TEST123456789";

const router = express.Router();

// Basic health check/info endpoint
router.get('/', (_, res) => res.type('text').send('Twilio media stream transcriber is running'));

// Handles incoming call webhook from Twilio
router.post('/', async (req, res) => {
    const { From: callerNumber, CallSid: callSid, To: twilioNumber } = req.body;
    const host = req.headers.host;
    const routeLogger = logger.child({ callSid, callerNumber, twilioNumber });

    routeLogger.info(`Incoming call POST request received`);
    routeLogger.debug({ body: req.body }, 'Request body');

    // Use nullish coalescing to handle both undefined and empty string cases
    // TODO: Fetch TEST_PHONE_NUMBER_SID from centralized config
    const phoneNumberSid = twilioNumber?.trim() || TEST_PHONE_NUMBER_SID; 
    routeLogger.info({ phoneNumberSid }, `Connecting call via WebSocket`);

    // Generate TwiML to connect the call to the WebSocket stream
    // TODO: Use Twilio Node helper library for TwiML generation for robustness
    res.type('xml').send(
        `<Response>
            <Connect>
              <Stream url='wss://${host}'>
                <Parameter name="caller_id" value="${callerNumber}"/>
                <Parameter name="phone_number_sid" value="${phoneNumberSid}"/>
                <Parameter name="call_sid" value="${callSid}"/>
                <Parameter name="host" value="${host}"/>
              </Stream>
            </Connect>
        </Response>`
    );
});

// Handles the webhook called by Twilio REST API during call forwarding
router.post("/forward", (req, res) => {
    const { transferTo } = req.query;
    const { CallSid: callSid } = req.body; // CallSid is usually in the body for subsequent webhooks
    const routeLogger = logger.child({ callSid, transferTo });

    // TODO: Validate transferTo number format/source
    routeLogger.info(`Call forward webhook triggered`);

    if (!transferTo) {
        routeLogger.warn('Transfer destination number (transferTo) missing in query parameters.');
        // TODO: Consider sending back TwiML <Hangup> or <Say> error message?
        return res.status(400).send('Missing transferTo query parameter');
    }

    // Generate TwiML to dial the transfer destination
    // TODO: Use Twilio Node helper library for TwiML generation
    res.set("Content-Type", "text/xml");
    res.send(
        `<Response>
            <Dial>${transferTo}</Dial>
        </Response>`
    );
});

export default router; 