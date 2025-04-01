import { NailSalonService } from './NailSalonService.js';

export class BusinessServiceFactory {
    static createService(type = 'nail_salon') {
        switch (type.toLowerCase()) {
            case 'nail_salon':
                return new NailSalonService();
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