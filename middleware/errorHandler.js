import { AppError } from '../services/error/AppError.js';
import { ErrorReportingService } from '../services/error/ErrorReportingService.js';

const errorReportingService = new ErrorReportingService();

export const errorHandler = (err, req, res, next) => {
    // Report the error
    const errorInfo = errorReportingService.report(err, {
        path: req.path,
        method: req.method,
        params: req.params,
        query: req.query,
        body: req.body,
        headers: req.headers
    });

    // Determine status code
    const statusCode = err instanceof AppError ? err.statusCode : 500;

    // Prepare error response
    const response = {
        error: {
            code: err instanceof AppError ? err.errorCode : 'INTERNAL_ERROR',
            message: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    };

    // Send response
    res.status(statusCode).json(response);
};

// WebSocket error handler
export const wsErrorHandler = (error, ws) => {
    const errorInfo = errorReportingService.report(error, {
        event: 'websocket_error'
    });

    // Send error to client
    ws.send(JSON.stringify({
        event: 'error',
        error: {
            code: error instanceof AppError ? error.errorCode : 'INTERNAL_ERROR',
            message: error.message
        }
    }));
}; 