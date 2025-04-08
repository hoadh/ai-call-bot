export class Container {
    constructor() {
        this.services = new Map();
        this.instances = new Map();
    }

    register(name, service, dependencies = []) {
        this.services.set(name, { service, dependencies });
    }

    get(name) {
        // Return existing instance if available
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }

        // Create new instance if not exists
        const serviceInfo = this.services.get(name);
        if (!serviceInfo) {
            throw new Error(`Service ${name} not registered`);
        }

        // Resolve dependencies
        const dependencies = serviceInfo.dependencies.map(dep => this.get(dep));
        
        // Create instance with dependencies
        const instance = new serviceInfo.service(...dependencies);
        this.instances.set(name, instance);
        
        return instance;
    }

    // Clear all instances (useful for testing)
    clear() {
        this.instances.clear();
    }
} 