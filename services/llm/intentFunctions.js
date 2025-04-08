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

export const intentHandlingFunctions = [
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