import axios from "axios";
import { getCustomerInfo } from '../crmAPI.js';

export class AppointmentService {
    static async handleAppointment(action, phoneNumber, appointmentTime) {
        let apiUrl = `${process.env.INTERNAL_BACKEND_API_URL}/booking`;
        let requestData = { customer: null };
        
        if (phoneNumber) {
            const customerInfo = await getCustomerInfo(phoneNumber);
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