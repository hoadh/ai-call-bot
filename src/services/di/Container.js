export class Container {
    constructor() {
        this.services = new Map();
        this.instances = new Map();
    }

    register(serviceName, serviceClass, dependencies = []) {
        this.services.set(serviceName, {
            class: serviceClass,
            dependencies: dependencies
        });
    }

    // Register an object built outside the container (e.g. the LLM service)
    registerInstance(serviceName, instance) {
        this.services.set(serviceName, { instance });
    }

    get(serviceName) {
        // Return existing instance if available
        if (this.instances.has(serviceName)) {
            return this.instances.get(serviceName);
        }

        // Get service info
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) {
            throw new Error(`Service ${serviceName} not found`);
        }
        if ('instance' in serviceInfo) {
            return serviceInfo.instance;
        }

        // Resolve dependencies
        const resolvedDependencies = serviceInfo.dependencies.map(dep => this.get(dep));

        // Create new instance with dependencies
        const instance = new serviceInfo.class(...resolvedDependencies);
        this.instances.set(serviceName, instance);
        return instance;
    }

    has(serviceName) {
        return this.services.has(serviceName);
    }

    // Clear all instances (useful for testing)
    clear() {
        this.instances.clear();
    }
} 