## Start Server

```
cp .env.example .env
export GOOGLE_APPLICATION_CREDENTIALS="google-cloud-key.json"
node server.js
```


## Tests

```
cp cp .env.example .env.test
export GOOGLE_APPLICATION_CREDENTIALS="google-cloud-key.json"
npm test
```

## Structure

This project is organized into the following key components:

- **`server.js`**: The main entry point of the application. It sets up the Express server, WebSocket server for Twilio media streams, handles incoming calls, manages the real-time transcription process using AssemblyAI, and orchestrates interactions between different services.
- **`services/`**: Contains various modules responsible for specific functionalities:
    - **`llm/`**: Handles interactions with Large Language Models (e.g., OpenAI) for tasks like intent detection and response generation. Includes a factory (`LLMServiceFactory.js`) for creating different LLM service instances.
    - **`business/`**: Implements the core business logic specific to the application domain (e.g., `NailSalonService.js`). Uses a factory pattern (`BusinessServiceFactory.js`) and a base class (`BaseBusinessService.js`). Relies on configuration loaded by `ConfigService.js`.
    - **`language/`**: Provides language detection and translation capabilities using Google Cloud Translate (`LanguageService.js`).
    - **`conversation/`**: Manages saving and potentially retrieving conversation logs (`ConversationService.js`).
    - **`config/`**: Loads and provides access to business-specific configurations (like prompts, services, hours) based on the phone number SID (`ConfigService.js`).
    - **`customer/`**: Manages customer data interactions, likely with an internal backend (`CustomerService.js`).
    - **`error/`**: Defines custom error classes (`AppError.js`) for consistent error handling.
    - **`appointmentService.js`**: Interacts with an internal backend API to handle appointment booking, rescheduling, and cancellation.
- **`middleware/`**: Contains Express middleware, such as error handlers (`errorHandler.js`).
- **`__tests__/`**: Holds integration and unit tests for various services and components.
- **`tts.js`**: Handles Text-to-Speech conversion, likely using a cloud service.
- **`convert.js`**: Provides audio format conversion utilities (e.g., converting audio to μ-law for Twilio).
- **`.env` / `.env.example`**: Files for managing environment variables (API keys, service URLs, configurations).
- **`package.json`**: Defines project dependencies and npm scripts.
- **`README.md`**: This file, providing documentation for the project.
- **`conversations/`**: Default directory where conversation logs are stored by `ConversationService.js`.
