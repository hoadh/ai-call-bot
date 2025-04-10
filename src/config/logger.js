import pino from 'pino';
// Removed config import to break circular dependency
// import config from './index.js'; 

// Read directly from process.env for logger setup
const nodeEnv = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug');
const isProduction = nodeEnv === 'production';

// Basic Pino configuration using direct env vars
const loggerOptions = {
    level: logLevel, 
    // Use pino-pretty for nice console output in development, JSON in production
    ...(isProduction ? {} : {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname', // Optional: Hide pid and hostname
            }
        }
    })
};

const logger = pino(loggerOptions);

export default logger; 