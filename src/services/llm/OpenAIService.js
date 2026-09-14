import { BaseLLMService } from './BaseLLMService.js';
import OpenAI from 'openai';
import { intentFunctions, appointmentTimeFunctions } from './intentFunctions.js';
import { ExternalServiceError } from '../error/AppError.js';
import config from '../../config/index.js'; // Import config

export class OpenAIService extends BaseLLMService {
    constructor(apiKey, languageService) {
        super(languageService);
        if (!apiKey) {
            throw new Error("OpenAI API key is required for OpenAIService.");
        }
        this.openai = new OpenAI({ apiKey });
    }

    async detectIntent(userMessage) {
        try {
            const response = await this.openai.chat.completions.create({
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
            console.error('OpenAI Error in detectIntent:', error);
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
            console.error('OpenAI Error in detectIntentAndHandle:', error);
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

            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: messages,
                temperature: 0.7,
                max_tokens: 150
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI Error in getResponse:', error);
            throw new ExternalServiceError('OpenAI', `Error getting response: ${error.message}`);
        }
    }

    async extractAppointmentTime(userMessage, timeZone) {
        // Give the model "now" in the salon's zone so relative dates resolve correctly
        const now = new Date().toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'long' });
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: `The current date and time is ${now} (time zone: ${timeZone}). ` +
                            `Resolve relative expressions such as "tomorrow" or "next Friday" against it. ` +
                            `Only extract a time the customer actually mentioned; never guess one. ` +
                            `If the customer gave a date but no clock time, omit appointment_time.`
                    },
                    { role: "user", content: userMessage }
                ],
                functions: appointmentTimeFunctions,
                function_call: { name: "extract_appointment_time" },
            });

            const functionResponse = response.choices[0].message.function_call;
            const { appointment_time: appointmentTime } = functionResponse ? JSON.parse(functionResponse.arguments) : {};
            // A date without a clock time ("next Friday") must not become a midnight booking
            const hasClockTime = /T\d{2}:\d{2}/.test(appointmentTime || '');
            return hasClockTime && !Number.isNaN(Date.parse(appointmentTime)) ? appointmentTime : null;
        } catch (error) {
            console.error('OpenAI Error in extractAppointmentTime:', error);
            throw new ExternalServiceError('OpenAI', `Error extracting appointment time: ${error.message}`);
        }
    }

    async isGoodbye(text) {
        try {
            const response = await this.openai.chat.completions.create({
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
            console.error('OpenAI Error in isGoodbye:', error);
            throw new ExternalServiceError('OpenAI', `Error checking goodbye: ${error.message}`);
        }
    }
} 