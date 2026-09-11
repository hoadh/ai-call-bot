import 'dotenv/config'; // Load .env file
import Joi from 'joi';
import logger from './logger.js';

// Define the schema for environment variables
const envSchema = Joi.object().keys({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),

    // Twilio
    TWILIO_ACCOUNT_SID: Joi.string().required(),
    TWILIO_AUTH_TOKEN: Joi.string().required(),
    TEST_PHONE_NUMBER_SID: Joi.string().default('TEST123456789'), // Default for testing/dev

    // Google Cloud
    // Path to the credentials file. Ensure this file is NOT committed to git.
    GOOGLE_APPLICATION_CREDENTIALS: Joi.string().required(),

    // OpenAI
    OPENAI_API_KEY: Joi.string().required(),

    // Service Selection (Optional - based on your factory implementations)
    LLM_SERVICE_TYPE: Joi.string().valid('openai', 'another_llm').default('openai'), 
    BUSINESS_TYPE: Joi.string().valid('nail_salon', 'another_business').default('nail_salon'),

    // Add other necessary environment variables here

}).unknown(); // Allow other environment variables not defined in the schema

// Validate environment variables
const { value: envVars, error } = envSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
    logger.fatal({ err: error }, `Environment variable validation error: ${error.message}`);
    throw new Error(`Config validation error: ${error.message}`);
}

// Export the validated and processed configuration
const config = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    logLevel: envVars.LOG_LEVEL,
    twilio: {
        accountSid: envVars.TWILIO_ACCOUNT_SID,
        authToken: envVars.TWILIO_AUTH_TOKEN,
        testPhoneNumberSid: envVars.TEST_PHONE_NUMBER_SID,
    },
    google: {
        credentialsPath: envVars.GOOGLE_APPLICATION_CREDENTIALS,
    },
    openai: {
        apiKey: envVars.OPENAI_API_KEY,
    },
    services: {
        llmType: envVars.LLM_SERVICE_TYPE,
        businessType: envVars.BUSINESS_TYPE,
    },
    // Add other config groups as needed
};

logger.info('Configuration loaded and validated.');

export default config; 