import { InjectionToken } from 'injection-js';

/**
 * Class type
 */
export interface Type<T> extends Function {
    new(...args: any[]): T;
}

export type FromInjectionToken<T> = T extends InjectionToken<infer V> ? V : never;


/**
 * Provider interface
 */
export interface Provider {
    provide: any;
    useClass?: any;
    useValue?: any;
    useExisting?: any;
    useFactory?: any;
    deps?: any[];
}
