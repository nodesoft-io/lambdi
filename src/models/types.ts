export interface InstanceWithError<T> {
    instance: T;
    errors?: string;
}

export interface PayloadWithError<T> {
    payload: T;
    errors?: string;
}
