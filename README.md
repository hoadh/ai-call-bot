## Start Server

1.  **Copy Environment Variables:**
    ```bash
    cp .env.example .env 
    # Edit .env and fill in your API keys and configurations
    ```

2.  **Set Google Credentials Path:**
    Ensure the `GOOGLE_APPLICATION_CREDENTIALS` environment variable points to your key file. You can set this in your shell environment or add it to the `.env` file.
    ```bash
    # Example for current shell session:
    export GOOGLE_APPLICATION_CREDENTIALS="./google-cloud-key.json" 
    # Or add to .env:
    # GOOGLE_APPLICATION_CREDENTIALS="./google-cloud-key.json"
    ```
    *(Remember: Make sure your key file, e.g., `google-cloud-key.json`, is in your `.gitignore`!)*

3.  **Run the Server:**
    *   **Development (with auto-restart):**
        ```bash
        npm run dev
        ```
        *(Requires `nodemon` installed: `npm install --save-dev nodemon`)*
    *   **Production:**
        ```bash
        npm start
        ```

## Tests

```bash
# Ensure test environment variables are set (e.g., in .env.test)
# cp .env.example .env.test 
export GOOGLE_APPLICATION_CREDENTIALS="./google-cloud-key.json"
npm test
```

## Development Guidelines

This section provides guidance for developers looking to extend the application or add new features.

### Project Structure Overview

Familiarize yourself with the project structure outlined in the **Structure** section above. Key directories include:
*   `src/config`: Application configuration and logger.
*   `src/handlers`: WebSocket connection logic (`CallHandler`).
*   `src/middleware`: Express middleware (e.g., error handling).
*   `src/routes`: HTTP route definitions.
*   `src/services`: Core business logic, external API clients, utilities.
*   `src/__tests__`: Unit and integration tests.

### Running in Development Mode

Use the `dev` script for development. It utilizes `nodemon` to automatically restart the server upon file changes:

```bash
npm run dev
```

### Configuration

*   **Environment Variables:** Define new environment variables in `.env` for local development and document them in `.env.example`.
*   **Validation:** Add validation rules for new variables to the Joi schema in `src/config/index.js`.
*   **Access:** Access configuration values throughout the application by importing the `config` object from `src/config/index.js`. Avoid using `process.env` directly outside of the configuration files.

### Adding New Services

1.  **Location:** Place new service logic within the `src/services/` directory. Create subdirectories for logical grouping (e.g., `src/services/new-external-api/`).
2.  **Dependencies:** Inject necessary dependencies (like `config`, `logger`, or other services) into your service's constructor.
3.  **Initialization:** Update `src/server.js` (`initializeServices` function) to instantiate your new service and inject its dependencies.
4.  **Injection:** Pass the new service instance to the components that need it (e.g., `CallHandler`, other services) during initialization in `src/server.js`.

### Adding HTTP Routes

1.  **Create Router:** Add new route handlers to existing router files (e.g., `src/routes/twilioRoutes.js`) or create a new router file in `src/routes/` for a distinct functional area.
2.  **Define Routes:** Use `express.Router()` to define your routes (`router.get`, `router.post`, etc.).
3.  **Mount Router:** If you created a new router file, import it and mount it in `src/server.js` using `app.use('/path-prefix', newRouter);`.
4.  **Dependencies:** If your route handlers need access to services, consider creating a controller pattern or injecting dependencies into the router module during setup (though direct service injection into route files is less common).

### Modifying WebSocket Handling

*   The primary WebSocket logic resides in `src/handlers/CallHandler.js`. Modifications to call flow, transcription event handling, or service interactions during a call likely belong here.
*   Ensure dependencies needed by `CallHandler` are injected via its constructor in `src/server.js`.

### Logging

*   A `pino` logger is configured (`src/config/logger.js`) and injected into services and handlers.
*   Use the injected `logger` instance (e.g., `this.logger.info(...)`, `this.logger.error({ err: error }, ...)`). Avoid `console.log`.
*   Utilize child loggers (`logger.child({ key: value })`) to add contextual information.

### Testing

*   **Requirement:** Add tests for any new features or significant changes.
*   **Unit Tests:** Place unit tests for services, handlers, etc., in `src/__tests__/` mirroring the source directory structure (e.g., `src/__tests__/services/new-service.test.js`). Mock dependencies using `jest.mock()`.
*   **Integration Tests:** Add tests to `src/__tests__/integration/` to verify interactions between components or endpoints.
*   **Run Tests:** Use `npm test` or `npm run test:watch`.

### Error Handling

*   Use custom error classes defined in `src/services/error/AppError.js` where appropriate.
*   Utilize the centralized Express error handler in `src/middleware/errorHandler.js`.
*   Log errors using the injected `logger`.

### Code Style

*   Follow existing code patterns and conventions regarding naming, structure, and comments.
*   Consider adding a linter (like ESLint) and code formatter (like Prettier) to enforce consistency if not already present.

## Structure

This project is organized into the following key components:

- **`src/`**: Contains all application source code.
    - **`server.js`**: The main entry point. Sets up Express, WebSocket server, initializes services, and handles composition root tasks.
    - **`config/`**: Manages configuration loading (`index.js` using Joi/dotenv) and logger setup (`logger.js` using Pino).
    - **`handlers/`**: Contains WebSocket connection handlers.
        - **`CallHandler.js`**: Manages the lifecycle and logic for a single WebSocket connection (Twilio media stream), including transcription and service orchestration.
    - **`routes/`**: Defines HTTP endpoints using Express Router.
        - **`twilioRoutes.js`**: Handles incoming webhooks from Twilio (e.g., for new calls, forwarding).
    - **`services/`**: Contains modules responsible for specific functionalities:
        - **`audio/`**: Handles Text-to-Speech (`TTSService.js`) and audio format conversion (`AudioConversionService.js`).
        - **`twilio/`**: Encapsulates interactions with the Twilio API (sending messages, forwarding calls) (`TwilioService.js`).
        - **`llm/`**: Handles interactions with Large Language Models (e.g., OpenAI) (`OpenAIService.js`, `LLMServiceFactory.js`).
        - **`business/`**: Implements core application domain logic (`NailSalonService.js`, `BusinessServiceFactory.js`, `BaseBusinessService.js`).
        - **`language/`**: Provides language detection/translation (`LanguageService.js`).
        - **`conversation/`**: Manages saving/retrieving conversation logs (`ConversationService.js`).
        - **`customer/`**: Manages customer data interactions (`CustomerService.js`).
        - **`error/`**: Defines custom error classes (`AppError.js`) and potentially error reporting.
        - **`di/`**: May contain dependency injection container logic (though currently simplified in factories).
        - **`appointmentService.js`**: Interacts with backend for appointments.
    - **`middleware/`**: Contains Express middleware (`errorHandler.js`).
    - **`__tests__/`**: Holds integration and unit tests, mirroring the `src/` structure.
- **`.env` / `.env.example` / `.env.test`**: Files for managing environment variables.
- **`google-cloud-key.json`**: Service account key for Google Cloud services (ensure this is in `.gitignore`!).
- **`package.json`**: Defines project dependencies and npm scripts.
- **`README.md`**: This file.
- **`conversations/`**: Default directory where conversation logs are stored.
