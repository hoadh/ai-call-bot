import { detectIntentByFunction } from "./intentDetection.js";

async function test() {
    const userMessage = "Can I book an appointment for tomorrow at 3 PM?";
    const intent = await detectIntentByFunction(userMessage);
    console.log("Detected Intent:", intent);
}

test();