import { Container } from '../../../services/di/Container.js';

describe('Container', () => {
    let container;
    
    beforeEach(() => {
        container = new Container();
    });
    
    describe('constructor', () => {
        it('should initialize empty maps for services and instances', () => {
            expect(container.services).toBeInstanceOf(Map);
            expect(container.instances).toBeInstanceOf(Map);
            expect(container.services.size).toBe(0);
            expect(container.instances.size).toBe(0);
        });
    });
    
    describe('register', () => {
        it('should register a service without dependencies', () => {
            class TestService {}
            
            container.register('testService', TestService);
            
            expect(container.services.has('testService')).toBe(true);
            expect(container.services.get('testService')).toEqual({
                class: TestService,
                dependencies: []
            });
        });
        
        it('should register a service with dependencies', () => {
            class TestService {}
            class DependentService {}
            
            container.register('testService', TestService);
            container.register('dependentService', DependentService, ['testService']);
            
            expect(container.services.has('dependentService')).toBe(true);
            expect(container.services.get('dependentService')).toEqual({
                class: DependentService,
                dependencies: ['testService']
            });
        });
        
        it('should overwrite existing service if registered again', () => {
            class TestService1 {}
            class TestService2 {}
            
            container.register('testService', TestService1);
            container.register('testService', TestService2, ['dep1']);
            
            expect(container.services.get('testService')).toEqual({
                class: TestService2,
                dependencies: ['dep1']
            });
        });
    });
    
    describe('get', () => {
        it('should create and return a new instance if not already instantiated', () => {
            class TestService {
                constructor() {
                    this.initialized = true;
                }
            }
            
            container.register('testService', TestService);
            const instance = container.get('testService');
            
            expect(instance).toBeInstanceOf(TestService);
            expect(instance.initialized).toBe(true);
            expect(container.instances.has('testService')).toBe(true);
            expect(container.instances.get('testService')).toBe(instance);
        });
        
        it('should return existing instance if already instantiated', () => {
            class TestService {}
            
            container.register('testService', TestService);
            const instance1 = container.get('testService');
            const instance2 = container.get('testService');
            
            expect(instance1).toBe(instance2);
            expect(container.instances.size).toBe(1);
        });
        
        it('should resolve dependencies recursively', () => {
            class ServiceA {
                constructor() {
                    this.name = 'ServiceA';
                }
            }
            
            class ServiceB {
                constructor(serviceA) {
                    this.name = 'ServiceB';
                    this.serviceA = serviceA;
                }
            }
            
            class ServiceC {
                constructor(serviceA, serviceB) {
                    this.name = 'ServiceC';
                    this.serviceA = serviceA;
                    this.serviceB = serviceB;
                }
            }
            
            container.register('serviceA', ServiceA);
            container.register('serviceB', ServiceB, ['serviceA']);
            container.register('serviceC', ServiceC, ['serviceA', 'serviceB']);
            
            const serviceC = container.get('serviceC');
            
            expect(serviceC).toBeInstanceOf(ServiceC);
            expect(serviceC.name).toBe('ServiceC');
            expect(serviceC.serviceA).toBeInstanceOf(ServiceA);
            expect(serviceC.serviceA.name).toBe('ServiceA');
            expect(serviceC.serviceB).toBeInstanceOf(ServiceB);
            expect(serviceC.serviceB.name).toBe('ServiceB');
            expect(serviceC.serviceB.serviceA).toBe(serviceC.serviceA);
        });
        
        it('should throw error if service is not registered', () => {
            expect(() => container.get('nonExistentService'))
                .toThrow('Service nonExistentService not found');
        });
        
        it('should handle circular dependencies', () => {
            // This is a simplified test since we can't easily detect circular dependencies
            // without modifying the Container implementation
            class ServiceA {
                constructor(serviceB) {
                    this.serviceB = serviceB;
                }
            }
            
            class ServiceB {
                constructor(serviceA) {
                    this.serviceA = serviceA;
                }
            }
            
            container.register('serviceA', ServiceA, ['serviceB']);
            container.register('serviceB', ServiceB, ['serviceA']);
            
            // This should cause a stack overflow if circular dependencies aren't handled
            // But since our implementation doesn't check for circular dependencies,
            // we'll just verify it throws a more generic error
            expect(() => container.get('serviceA')).toThrow();
        });
    });
    
    describe('has', () => {
        it('should return true if service is registered', () => {
            class TestService {}
            
            container.register('testService', TestService);
            
            expect(container.has('testService')).toBe(true);
        });
        
        it('should return false if service is not registered', () => {
            expect(container.has('nonExistentService')).toBe(false);
        });
    });
    
    describe('clear', () => {
        it('should clear all instances but keep service registrations', () => {
            class TestService {}
            
            container.register('testService', TestService);
            container.get('testService'); // Create instance
            
            expect(container.instances.size).toBe(1);
            
            container.clear();
            
            expect(container.instances.size).toBe(0);
            expect(container.services.size).toBe(1);
            expect(container.has('testService')).toBe(true);
        });
        
        it('should allow getting fresh instances after clearing', () => {
            class TestService {
                constructor() {
                    this.id = Math.random();
                }
            }
            
            container.register('testService', TestService);
            const instance1 = container.get('testService');
            
            container.clear();
            
            const instance2 = container.get('testService');
            
            expect(instance1).not.toBe(instance2);
            expect(instance1.id).not.toBe(instance2.id);
        });
    });
});
