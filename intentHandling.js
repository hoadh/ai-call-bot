import axios from "axios";
import { OpenAI } from 'openai';
import dotenv from "dotenv";
import { getCustomerInfo } from './crmAPI.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


const functions = [
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

export async function detectIntentAndHandle(userMessage, phoneNumber) {
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [{ role: "user", content: userMessage }],
        functions: functions,
        function_call: "auto"
    });

    if (phoneNumber) {
        messages.push({ role: "user", content: `The phone number of the customer is ${phoneNumber}.` });
    }
    console.log("AI Response:", JSON.stringify(response.choices[0].message));
    const functionCall = response.choices[0].message.function_call;
    if (functionCall) {
        const args = JSON.parse(functionCall.arguments);
        return handleAppointment(args.action, args.phone_number, args.appointment_time);
    }

    return "No action required.";
}

export async function handleAppointment(action, phoneNumber, appointmentTime) {
    let apiUrl = `${process.env.INTERNAL_BACKEND_API_URL}/booking`;
    let requestData = { customer: null };
    if (phoneNumber) {
        const customerInfo = await getCustomerInfo(phoneNumber);
        if (customerInfo) {
            requestData.customer = customerInfo._id;
        } else {
            return "Customer not found.";
        }
    }
    if (action === "Book_Appointment" || action === "Reschedule") {
        if (!appointmentTime) {
            return "Appointment time is required.";
        }
    }
    console.log(`Action: ${action}, Phone Number: ${phoneNumber}, Appointment Time: ${appointmentTime}`);
    if (action === "Book_Appointment" || action === "Reschedule_Appointment") {
        requestData.bookingDate = appointmentTime.split("T")[0];
        requestData.startTime = appointmentTime;
    }

    if (action === "Book_Appointment") {
        requestData.appointment_time = appointmentTime;
        return axios.post(apiUrl, requestData);
    }
    if (action === "Reschedule_Appointment") {
        requestData.new_time = appointmentTime;
        return axios.put(apiUrl, requestData);
    }
    if (action === "Cancel_Appointment") {
        return axios.delete(apiUrl, { data: requestData });
    }

    return "Invalid action.";
}
