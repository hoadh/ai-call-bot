export const intentFunctions = [
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

// Used to pull a concrete date/time out of a booking request. Relative
// phrases ("tomorrow at 3") are resolved by the LLM against the current
// time supplied in the system message.
export const appointmentTimeFunctions = [
    {
        name: "extract_appointment_time",
        description: "Extract the appointment date and time the customer asked for",
        parameters: {
            type: "object",
            properties: {
                appointment_time: {
                    type: "string",
                    format: "date-time",
                    description: "The requested appointment date AND clock time in ISO 8601 format with timezone offset. Omit unless the customer mentioned both a date (possibly relative) and a time of day."
                }
            },
            required: []
        }
    }
];
