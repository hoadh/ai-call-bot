import { AppError } from './AppError.js';

export class ErrorReportingService {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 1000; // Maximum number of errors to keep in memory
    }

    report(error, context = {}) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            error: error instanceof AppError ? {
                name: error.name,
                message: error.message,
                statusCode: error.statusCode,
                errorCode: error.errorCode,
                stack: error.stack,
                ...error
            } : {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context
        };

        // Log to console
        console.error('Error Report:', errorInfo);

        // Add to error log
        this.errorLog.push(errorInfo);
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift(); // Remove oldest error
        }

        // TODO: Implement external error reporting (e.g., Sentry, DataDog)
        // this.reportToExternalService(errorInfo);

        return errorInfo;
    }

    getRecentErrors(limit = 10) {
        return this.errorLog.slice(-limit);
    }

    clearErrorLog() {
        this.errorLog = [];
    }

    // Helper method to create and report errors
    createAndReportError(errorClass, ...args) {
        const error = new errorClass(...args);
        this.report(error);
        return error;
    }
} 