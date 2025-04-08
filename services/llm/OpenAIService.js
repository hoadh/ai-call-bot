import { BaseLLMService } from './BaseLLMService.js';
import OpenAI from 'openai';
import { intentFunctions } from './intentFunctions.js';
import { ExternalServiceError } from '../error/AppError.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Intent detection functions
const intentHandlingFunctions = [
    {
        name: "handle_appointment",
        description: "Manage nail salon appointments",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["Book_Appointment", "Reschedule_Appointment", "Cancel_Appointment"],
                    description: "The action to perform on the appointment"
                },
                phone_number: {
                    type: "string",
                    description: "The phone number of the customer"
                },
                appointment_time: {
                    type: "string",
                    format: "date-time",
                    description: "The requested appointment time (ISO 8601 format)"
                }
            },
            required: ["action", "phone_number"]
        }
    }
];

export class OpenAIService extends BaseLLMService {
    constructor(languageService) {
        super(languageService);
    }

    async detectIntent(userMessage) {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [{ role: "user", content: userMessage }],
                functions: intentFunctions,
                function_call: "auto",
            });

            const functionResponse = response.choices[0].message.function_call;
            if (functionResponse) {
                const { intent } = JSON.parse(functionResponse.arguments);
                return intent;
            }
            return "Unknown_Intent";
        } catch (error) {
            throw new ExternalServiceError('OpenAI', `Error detecting intent: ${error.message}`);
        }
    }

    async detectIntentAndHandle(userMessage, phoneNumber) {
        try {
            const intent = await this.detectIntent(userMessage);
            if (intent === "Unknown_Intent") {
                return "No action required.";
            }
            return intent;
        } catch (error) {
            throw new ExternalServiceError('OpenAI', `Error handling intent: ${error.message}`);
        }
    }

    async getResponse(prompt, systemMessage = null) {
        try {
            const messages = [];
            if (systemMessage) {
                messages.push({ role: "system", content: systemMessage });
            }
            messages.push({ role: "user", content: prompt });

            const response = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: messages,
                temperature: 0.7,
                max_tokens: 150
            });

            return response.choices[0].message.content;
        } catch (error) {
            throw new ExternalServiceError('OpenAI', `Error getting response: ${error.message}`);
        }
    }

    async isGoodbye(text) {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    { role: "system", content: "Determine if the text is a goodbye message. Respond with true or false." },
                    { role: "user", content: text }
                ],
                temperature: 0.3,
                max_tokens: 10
            });

            return response.choices[0].message.content.toLowerCase().includes('true');
        } catch (error) {
            throw new ExternalServiceError('OpenAI', `Error checking goodbye: ${error.message}`);
        }
    }
} 