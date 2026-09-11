# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AI phone receptionist for a nail salon: Twilio Media Streams (WebSocket audio) → Google Speech-to-Text → OpenAI (intent + reply) → Google Text-to-Speech → back to the caller. Node.js ESM (`"type": "module"`), Express + `ws`, no TypeScript, no linter.

## Commands

```bash
npm run dev            # nodemon src/server.js (ignores ./conversations/)
npm start              # node src/server.js
npm test               # jest (coverage is ON by default — see jest.config.js)
npx jest --coverage=false                                  # faster full run
npx jest src/__tests__/handlers/CallHandler.test.js        # single file
npx jest -t "should switch transcriber language"           # single test by name
npm run test:watch
```

Prerequisites not installed by npm: the `ffmpeg` binary (used by `fluent-ffmpeg` to convert TTS audio to µ-law) and a Google service-account key pointed to by `GOOGLE_APPLICATION_CREDENTIALS`. Twilio must reach the server over a public host (e.g. ngrok) because the TwiML uses `wss://${req.headers.host}`.

Env: copy `.env.example` → `.env`. Tests load `.env.test` via `src/__tests__/setup.js`, which also stubs the required keys, so `.env.test` may be empty. Required vars are validated by the Joi schema in `src/config/index.js` and the process exits on failure. Note that some services still read `process.env` directly and are *not* in the schema: `INTERNAL_BACKEND_API_URL`, `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT_LOCATION`, `GOOGLE_TRANSLATE_KEY_PATH`.

## Call flow (spans several files — read this before touching call logic)

1. **Twilio webhook** `POST /` (`src/routes/twilioRoutes.js`) returns TwiML `<Connect><Stream url="wss://host">` with custom parameters `caller_id`, `phone_number_sid`, `call_sid`, `host`. `phone_number_sid` (the Twilio number that was called) is the key that selects the business config for the whole call.
2. **WebSocket connection** → `src/server.js` instantiates one `CallHandler` per connection, injecting the shared services and a child logger with a `connectionId`.
3. **`CallHandler`** (`src/handlers/CallHandler.js`) owns the per-call state (`streamSid`, `phoneNumberSid`, `conversationLog`, `currentLanguage`):
   - opens a Google `streamingRecognize` stream and pipes Twilio `media` payloads (base64 µ-law 8 kHz) into it via a `PassThrough`;
   - on `start` fetches customer info and sends the welcome message;
   - on each **final** transcript: `LanguageService.detectLanguage` → maybe `switchLanguage()` (re-opens the STT stream; only after ≥2 user messages in a different language) → `llmService.detectIntent` (OpenAI function calling, enum in `src/services/llm/intentFunctions.js`) → `businessService.handleIntent` → if `shouldTransfer`, `TwilioService.forwardCall`; otherwise the business response or a generic `llmService.getResponse(guideline + history)` → translated if `currentLanguage !== 'en'` → `TwilioService.getTwilioMessage` → `ws.send`;
   - goodbye detection (`llmService.isGoodbye`) swaps the system prompt and closes the socket 2 s after the reply is sent;
   - on `close` saves `conversationLog` through `ConversationService` (JSON files in `./conversations/`).
4. **Outbound audio**: `TwilioService.getTwilioMessage` → `TTSService.synthesizeSpeech` (LINEAR16 24 kHz) → `convertToMulaw` (ffmpeg → µ-law 8 kHz) → base64 → `{ event: 'media' }` frame.
5. **Transfer to a human**: `TwilioService.forwardCall` uses the Twilio REST API to redirect the live call to `POST /forward?transferTo=…` on this server, which answers with TwiML `<Dial>`.

## Language-code contract

App-wide language codes are short ISO codes (`'en'`, `'vi'`, `'ja'`, …) — `LanguageService`, `TTSService`, `BusinessService`/`ConfigService` and `CallHandler.currentLanguage` all use them. Provider-specific codes are mapped at the edge only: `STT_LANGUAGE_MAP` in `CallHandler.js` (→ BCP-47 for Google STT) and `LANGUAGE_VOICE_MAP` in `TTSService.js` (→ voice per language). Keep both maps in sync with `LanguageService.supportedLanguages` when adding a language. Never store a BCP-47 code in `currentLanguage`.

## Service wiring

- `src/server.js` is the composition root. Services are constructed there and passed to `CallHandler` by constructor injection; nothing imports a service singleton except `ConfigService` (module-level singleton with a 5-minute per-`phoneNumberSid` cache of `GET {INTERNAL_BACKEND_API_URL}/businesses/{sid}`).
- `LLMServiceFactory.createService(config.services.llmType)` — plain `switch`; must be `initialize(languageService)`d first. `OpenAIService` is the only implementation; it extends `BaseLLMService`.
- `BusinessServiceFactory.createService(config.services.businessType)` — resolves through the tiny DI `Container` in `src/services/di/Container.js` (register name → class + dependency names; instances are singletons). To add a business type: extend `BaseBusinessService`, register it in `BusinessServiceFactory.initialize()`, add a `case`, and add the value to the `BUSINESS_TYPE` Joi enum.
- Business data (prompts, pricing, hours, transfer number, welcome text) is *not* in code — it comes from the internal backend per `phoneNumberSid` via `ConfigService`; `CustomerService` and `AppointmentService` hit the same backend (`/customers/phone/{n}`, `/booking`).
- Errors: throw `AppError` subclasses from `src/services/error/AppError.js` (`ExternalServiceError` for third-party failures); `wsErrorHandler` for WebSocket paths, `errorHandler` middleware for HTTP.
- Logging is `pino` via the injected `logger` (`this.logger.info({ ctx }, 'msg')`, `logger.child(...)` for context). A few older services still use `console.*`; prefer the injected logger in new code.

## Testing notes

- Jest runs through `babel-jest` (ESM → CJS), so `jest.mock()` / `jest.requireActual()` work normally despite `"type": "module"`.
- `CallHandler` tests mock `@google-cloud/speech` with a real `PassThrough` as the recognize stream (so `pipe()` works) and spy on `on`/`end`/`destroy`; emit events through the spied `on` mock calls. Follow the same pattern for any new stream-based mocks.
- `coveragePathIgnorePatterns` excludes `middleware/`, `services/error`, `services/di`, `services/config` and `server.js` from coverage on purpose.

## Repo notes

- `.gitignore` contains `*.json` (to keep Google key files out). `package.json`/`package-lock.json` are already tracked; any *new* JSON file needs `git add -f`.
- Branches: `main` is the original flat prototype (`server.js`, `tts.js`); `develop` (from `not-test-google-stt`) is the current structured codebase described here. Develop on `develop`.
- `plans/` and `docs/` hold planning documents and reports; do not put markdown elsewhere.
