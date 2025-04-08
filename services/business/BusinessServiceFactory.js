import { NailSalonService } from './NailSalonService.js';
import { Container } from '../di/Container.js';
import { LanguageService } from '../language/LanguageService.js';
import { CustomerService } from '../customer/CustomerService.js';
import { AppointmentService } from '../appointmentService.js';

export class BusinessServiceFactory {
    static container = new Container();

    static initialize() {
        // Register services
        this.container.register('languageService', LanguageService);
        this.container.register('customerService', CustomerService);
        this.container.register('appointmentService', AppointmentService);
        this.container.register('nailSalonService', NailSalonService, [
            'languageService',
            'customerService',
            'appointmentService'
        ]);
    }

    static createService(type = 'nail_salon') {
        switch (type.toLowerCase()) {
            case 'nail_salon':
                return this.container.get('nailSalonService');
            // Add more cases here for other businesses
            // case 'restaurant':
            //     return new RestaurantService();
            // case 'retail':
            //     return new RetailService();
            default:
                throw new Error(`Unsupported business type: ${type}`);
        }
    }
} 