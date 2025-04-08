export class MockOpenAIService {
    constructor(languageService) {
        this.languageService = languageService;
        this.detectIntent = jest.fn().mockImplementation((text) => {
            return Promise.resolve({
                intent: 'Book_Appointment',
                confidence: 0.95
            });
        });

        this.generateResponse = jest.fn().mockImplementation((intent, context) => {
            return Promise.resolve('Mock response from OpenAI');
        });

        this.handleAppointment = jest.fn().mockImplementation((action, phoneNumber, time) => {
            return Promise.resolve({
                success: true,
                message: 'Appointment handled successfully'
            });
        });
    }
} 