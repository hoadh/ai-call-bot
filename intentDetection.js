import { OpenAI } from 'openai';
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Function to detect intent
// export async function detectIntent(userMessage) {
//     const prompt = `Identify the intent of the following customer message related to a nail salon: 

//     ${userMessage}

//     Choose one of the following intents: 
//     - Book Appointment
//     - Reschedule Appointment
//     - Cancel Appointment
//     - Confirm Appointment
//     - Check Availability
//     - Walk-in Inquiry
//     - Ask About Services
//     - Ask About Pricing
//     - Package Deals Inquiry
//     - Custom Design Request
//     - Nail Design Request
//     - Nail Shape Preferences
//     - Allergy or Sensitivity Concern
//     - Specific Nail Technician Request
//     - Ask About Discounts
//     - Loyalty Program Inquiry
//     - Gift Card Purchase
//     - Ask for Address
//     - Ask for Directions
//     - Ask for Business Hours
//     - File a Complaint
//     - Leave a Review
//     - Report a Billing Issue
//     - Ask About Cancellation Policy
//     - Ask About Payment Methods
//     - Ask About Hygiene & Safety
//     - Speak to a Human
//     - Emergency Request

//     Intent:`;

//     try {
//         const response = await openai.chat.completions.create({
//             model: "gpt-4-turbo",
//             messages: [
//                 {
//                     role: "system",
//                     content: "You are an AI assistant for a nail salon."
//                 },
//                 {
//                     role: "user",
//                     content: prompt
//                 }
//             ],
//             max_tokens: 50,
//             temperature: 0.2,
//         });

//         const intent = response.choices[0].message.content.trim();
//         return intent;
//     } catch (error) {
//         console.error("Error detecting intent:", error);
//         return "Unknown Intent";
//     }
// }


////////////

const functions = [
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

export async function detectIntentByFunction(userMessage) {
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: userMessage }],
        functions: functions,
        function_call: "auto", // OpenAI will decide when to call the function
    });

    const functionResponse = response.choices[0].message.function_call;
    if (functionResponse) {
        const { intent } = JSON.parse(functionResponse.arguments);
        return intent;
    }
    return "Unknown_Intent"; // Fallback if no intent detected
}
