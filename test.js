import { detectIntentByFunction } from "./intentDetection.js";
import { handleAppointment } from "./intentHandling.js";

async function test() {
    const userMessage = "Can I book an appointment for tomorrow at 3 PM?";
    const intent = await detectIntentByFunction(userMessage);
    console.log("Detected Intent:", intent);
    const phoneNumber = "1234567890"; // Example phone number
    let appointmentTime = null;
    if (intent.date && intent.time) {
        // Nếu intent.time không có giây, thêm ":00"
        const timeWithSeconds = intent.time.length === 5
            ? intent.time + ":00"
            : intent.time;

        appointmentTime = `${intent.date}T${timeWithSeconds}`;
    }

    const handle = await handleAppointment(intent.intent, phoneNumber, appointmentTime);
}

test();