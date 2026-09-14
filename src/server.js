import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { LLMServiceFactory } from './services/llm/LLMServiceFactory.js';
import { BusinessServiceFactory } from './services/business/BusinessServiceFactory.js';
import { LanguageService } from './services/language/LanguageService.js';
import { errorHandler, wsErrorHandler } from './middleware/errorHandler.js';
import { ServiceError, ExternalServiceError } from './services/error/AppError.js';
import { ConversationService } from './services/conversation/ConversationService.js';
import { CallHandler } from './handlers/CallHandler.js';
import twilioRouter from './routes/twilioRoutes.js';
import { TTSService } from './services/audio/TTSService.js';
import { convertToMulaw } from './services/audio/AudioConversionService.js'; // Keep direct import for now
import { TwilioService } from './services/twilio/TwilioService.js';
import logger from './config/logger.js'; // Import the logger
import config from './config/index.js'; // Import the centralized config

const app = express();
app.use(express.urlencoded({ extended: true }));
const server = createServer(app);

// Initialize services
async function initializeServices() {
    logger.info('Initializing services...');
    try {
        // Create standalone services, injecting logger where needed
        const languageService = new LanguageService(/* logger */); // Assuming LanguageService might use logger
        const conversationService = new ConversationService(/* logger */); // Assuming ConversationService might use logger
        const ttsService = new TTSService(logger.child({ service: 'TTS' }));
        // Pass logger to conversion function if needed, or handle logging within it
        const twilioService = new TwilioService(logger.child({ service: 'Twilio' }), ttsService, convertToMulaw);

        // LLM first: the business layer needs it for appointment-time extraction
        LLMServiceFactory.initialize(languageService);
        const llmService = LLMServiceFactory.createService(config.services.llmType);

        BusinessServiceFactory.initialize(llmService);
        const businessService = BusinessServiceFactory.createService(config.services.businessType);
        
        logger.info("All services initialized successfully.");

        // Return all necessary services including the main logger
        return { 
            logger, // Pass logger itself
            llmService, 
            businessService, 
            languageService, 
            conversationService,
            // No need to return ttsService or convertToMulaw directly anymore
            twilioService
        };
    } catch (error) {
        logger.error({ err: error }, "Fatal Error during Service Initialization");
        // Rethrow original error type if possible, or wrap it
        throw new ServiceError('Initialization', `Failed to initialize services: ${error.message || error}`);
    }
}

// Error handling middleware - TODO: Inject logger into errorHandler if needed
app.use(errorHandler);

// Mount the Twilio router - TODO: Inject logger into router if needed
app.use(twilioRouter);

// Initialize services before starting server/wss
const { 
    logger: appLogger, // Rename to avoid conflict in this scope
    llmService, 
    businessService, 
    languageService, 
    conversationService,
    twilioService 
} = await initializeServices();

const wss = new WebSocketServer({ server });

// Instantiate CallHandler for each new WebSocket connection
wss.on('connection', (ws) => {
    const connectionId = crypto.randomUUID(); // Give each connection a unique ID for logging
    const connectionLogger = appLogger.child({ connectionId });
    connectionLogger.info("New WebSocket connection received. Instantiating CallHandler...");
    try {
        // Pass the connection-specific logger and services
        new CallHandler(ws, { 
            logger: connectionLogger, // Pass the child logger
            llmService, 
            businessService, 
            languageService, 
            conversationService,
            twilioService
        });
    } catch (error) {
        connectionLogger.error({ err: error }, "Failed to instantiate CallHandler");
        if (ws.readyState === ws.OPEN) {
            ws.close(1011, "Failed to initialize call handler");
        }
    }
});

// Removed helper functions getAudioToTwilio, getTwilioMessage, forwardCall

async function startServer() {
    const port = config.port; // Use port from config
    server.listen(port, () => {
        appLogger.info(`Server listening on port ${port}`);
    });
}

startServer().catch(error => {
    appLogger.fatal({ err: error }, "Server failed to start");
    process.exit(1);
});
