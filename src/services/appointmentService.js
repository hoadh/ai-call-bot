import axios from "axios";

const CONFIRMATIONS = {
    Book_Appointment: 'Your appointment has been booked',
    Reschedule_Appointment: 'Your appointment has been rescheduled',
    Cancel_Appointment: 'Your appointment has been cancelled',
};

const TRANSFER_MESSAGE = "Sorry, I couldn't complete that myself. Let me transfer you to our staff.";

// Spoken form for TTS, e.g. "Friday, September 12, 2026 at 3:00 PM"
const formatSpokenTime = (isoTime, timeZone) =>
    new Date(isoTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone });

export class AppointmentService {
    constructor(customerService, llmService) {
        this.customerService = customerService;
        this.llmService = llmService;
    }

    // Turns a caller's spoken request into a backend booking call.
    // Returns { message, needsTransfer } for the business service to speak.
    async handleAppointmentRequest(intent, userMessage, phoneNumber, settings = {}) {
        const timeZone = settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const needsTime = intent !== 'Cancel_Appointment';
        // Any failure (LLM, unknown customer, backend) hands the caller to a person
        const transfer = { message: TRANSFER_MESSAGE, needsTransfer: true };

        let appointmentTime = null;
        if (needsTime) {
            try {
                appointmentTime = await this.llmService.extractAppointmentTime(userMessage, timeZone);
            } catch (error) {
                console.error('Error extracting appointment time:', error);
                return transfer;
            }
            if (!appointmentTime) {
                return { message: 'What date and time would you like for your appointment?', needsTransfer: false };
            }
        }

        const result = await this.handleAppointment(intent, phoneNumber, appointmentTime);
        if (result.error) {
            return transfer;
        }

        const when = appointmentTime ? ` for ${formatSpokenTime(appointmentTime, timeZone)}` : '';
        return { message: `${CONFIRMATIONS[intent]}${when}.`, needsTransfer: false };
    }

    async handleAppointment(action, phoneNumber, appointmentTime) {
        let apiUrl = `${process.env.INTERNAL_BACKEND_API_URL}/booking`;
        let requestData = { customer: null };

        if (phoneNumber) {
            const customerInfo = await this.customerService.getCustomerInfo(phoneNumber);
            if (customerInfo) {
                requestData.customer = customerInfo._id;
            } else {
                return { error: "Customer not found." };
            }
        }

        if (action === "Book_Appointment" || action === "Reschedule_Appointment") {
            if (!appointmentTime) {
                return { error: "Appointment time is required." };
            }
        }

        console.log(`Action: ${action}, Phone Number: ${phoneNumber}, Appointment Time: ${appointmentTime}`);

        try {
            switch (action) {
                case "Book_Appointment":
                    requestData.bookingDate = appointmentTime.split("T")[0];
                    requestData.startTime = appointmentTime;
                    requestData.appointment_time = appointmentTime;
                    const bookResponse = await axios.post(apiUrl, requestData);
                    return {
                        success: true,
                        message: "Appointment booked successfully",
                        data: bookResponse.data
                    };

                case "Reschedule_Appointment":
                    requestData.bookingDate = appointmentTime.split("T")[0];
                    requestData.startTime = appointmentTime;
                    requestData.new_time = appointmentTime;
                    const rescheduleResponse = await axios.put(apiUrl, requestData);
                    return {
                        success: true,
                        message: "Appointment rescheduled successfully",
                        data: rescheduleResponse.data
                    };

                case "Cancel_Appointment":
                    const cancelResponse = await axios.delete(apiUrl, { data: requestData });
                    return {
                        success: true,
                        message: "Appointment cancelled successfully",
                        data: cancelResponse.data
                    };

                default:
                    return { error: "Invalid action." };
            }
        } catch (error) {
            console.error('Error handling appointment:', error);
            return {
                error: error.response?.data?.message || "An error occurred while processing your request."
            };
        }
    }
}
