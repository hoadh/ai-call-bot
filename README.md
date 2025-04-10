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

```
cp cp .env.example .env.test
export GOOGLE_APPLICATION_CREDENTIALS="google-cloud-key.json"
npm test
```

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
