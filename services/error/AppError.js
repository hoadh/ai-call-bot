export class AppError extends Error {
    constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message, field) {
        super(message, 400, 'VALIDATION_ERROR');
        this.field = field;
    }
}

export class AuthenticationError extends AppError {
    constructor(message) {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

export class AuthorizationError extends AppError {
    constructor(message) {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

export class ResourceNotFoundError extends AppError {
    constructor(resource, id) {
        super(`${resource} with id ${id} not found`, 404, 'RESOURCE_NOT_FOUND');
        this.resource = resource;
        this.id = id;
    }
}

export class ServiceError extends AppError {
    constructor(service, message) {
        super(message, 500, 'SERVICE_ERROR');
        this.service = service;
    }
}

export class ConfigurationError extends AppError {
    constructor(message) {
        super(message, 500, 'CONFIGURATION_ERROR');
    }
}

export class ExternalServiceError extends AppError {
    constructor(service, message) {
        super(message, 502, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
    }
} 