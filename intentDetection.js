import { OpenAI } from 'openai';
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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
                },
                attendees: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of people attending the appointment.",
                },
                date: {
                    type: "string",
                    description: "Date of the appointment (e.g., 'yyyy-mm-dd')",
                },
                time: {
                    type: "string",
                    description: "Time of the appointment (e.g., '15:00')",
                },
                topic: {
                    type: "string",
                    description: "The purpose of the appointment (e.g., 'Nail extension')",
                },
            },
            required: ["intent"], // Không bắt buộc date, time nếu khách chưa cung cấp
        }
    }
];

export async function detectIntentByFunction(userMessage) {
    console.log("userMessage", userMessage);
    const today = new Date().toISOString().split("T")[0]; // Lấy ngày hiện tại (YYYY-MM-DD)
    const fullMessage = `Today is ${today}. ${userMessage}`;
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: fullMessage }],
        functions: functions,
        function_call: "auto", // OpenAI will decide when to call the function
    });

    const functionResponse = response.choices[0].message.function_call;
    if (functionResponse) {
        const args = JSON.parse(functionResponse.arguments);
        const { intent, date, time } = args;

        console.log("Args:", args);
        console.log("Intent:", intent);
        console.log("Date:", date);
        console.log("Time:", time);

    return { intent, date, time };
    }
    return "Unknown_Intent"; // Fallback if no intent detected
}

