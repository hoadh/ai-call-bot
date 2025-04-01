import { OpenAI } from 'openai';
import dotenv from "dotenv";
import { BaseLLMService } from './BaseLLMService.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Intent detection functions
const intentFunctions = [
    {
        name: "detect_nail_salon_intent",
        description: "Identify the intent of a customer message in a nail salon",
        parameters: {
            type: "object",
            properties: {
                intent: {
                    type: "string",
                    enum: [
                        "Book_Appointment", "Reschedule_Appointment", "Cancel_Appointment",
                        "Confirm_Appointment", "Check_Availability", "Walk_in_Inquiry",
                        "Ask_About_Services", "Ask_About_Pricing", "Package_Deals_Inquiry",
                        "Custom_Design_Request", "Nail_Design_Request", "Nail_Shape_Preferences",
                        "Allergy_or_Sensitivity_Concern", "Specific_Nail_Technician_Request",
                        "Ask_About_Discounts", "Loyalty_Program_Inquiry", "Gift_Card_Purchase",
                        "Ask_for_Address", "Ask_for_Directions", "Ask_for_Business_Hours",
                        "File_a_Complaint", "Leave_a_Review", "Report_a_Billing_Issue",
                        "Ask_About_Cancellation_Policy", "Ask_About_Payment_Methods",
                        "Ask_About_Hygiene_and_Safety", "Speak_to_a_Human", "Emergency_Request"
                    ],
                    description: "The detected intent of the customer's message."
                }
            },
            required: ["intent"]
        }
    }
];

// Intent handling functions
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
    async detectIntent(userMessage) {
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
    }

    async detectIntentAndHandle(userMessage, phoneNumber) {
        const messages = [{ role: "user", content: userMessage }];
        if (phoneNumber) {
            messages.push({ role: "user", content: `The phone number of the customer is ${phoneNumber}.` });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: messages,
            functions: intentHandlingFunctions,
            function_call: "auto"
        });

        console.log("AI Response:", JSON.stringify(response.choices[0].message));
        const functionCall = response.choices[0].message.function_call;
        if (functionCall) {
            return JSON.parse(functionCall.arguments);
        }

        return "No action required.";
    }

    async getResponse(prompt, systemMessage = "You are a helpful Customer Service. Keep your responses concise and natural.") {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "system",
                    content: systemMessage
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 150
        });

        return completion.choices[0].message.content;
    }

    async isGoodbye(text) {
        const prompt = `Determine if the user wants to end the conversation. Respond with "yes" or "no" or "not sure".\n\nUser: ${text}\nDoes the user want to end the conversation?`;
        const intentResponse = await this.getResponse(prompt);
        console.log(`Goodbye response: ${intentResponse}`);
        return intentResponse.trim().toLowerCase() === 'yes'
            || intentResponse.trim().toLowerCase() === 'yes.'
            || intentResponse.trim().toLowerCase().startsWith('yes');
    }
} 