import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Basic Pino configuration
const loggerOptions = {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
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