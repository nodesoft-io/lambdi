import pino from 'pino';
import { Context } from './aws';

export abstract class Logger {
    constructor() {}
    abstract child(name: string): Logger;
    abstract info(msg: any, data?: any): void;
    abstract error(msg: any, data?: any): void;
    abstract warn(msg: any, data?: any): void;
    abstract debug(msg: any, data?: any): void;
    abstract trace(msg: any, data?: any): void;
    abstract metric(
        metric_type: string,
        identifiers?: Record<string, string>,
        metrics?: Record<string, string | number | boolean | bigint | null | undefined>
    ): void
}

export type Level = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent' | 'metric';

export class PinoLogger extends Logger {
    constructor(protected provider: pino.Logger & { metric?: pino.LogFn }) {
        super();
    }

    public static build(
        domainName: string,
        process: string,
        context?: Context,
        level: Level = 'info'
    ): PinoLogger {
        return new PinoLogger(
            pino({
                level,
                timestamp: () => `,"time":"${Math.floor(Date.now() / 1000)}"`,
                base: {
                    pid: undefined,
                    hostname: undefined
                },
                customLevels: {
                    /** Used to log data in flat top-level form for kibana business dashboards */
                    metric: 35
                }
            }).child({
                domain: domainName,
                request_id: context?.awsRequestId,
                process
            })
        );
    }

    /**
     * Pino stringifies (using child) the context and duplicates keys.
     * To prevent duplicating request_id from different requests in the pino context
     * we can't use `child` but replace the request_id value in the internal string directly
     */
    setContext(context: Context): Logger {
        // @ts-expect-error ts2538 symbol as key
        if (this.provider[pino.symbols.chindingsSym]?.includes?.('request_id')) {
            // @ts-expect-error ts2538 symbol as key
            this.provider[pino.symbols.chindingsSym] = this.provider[pino.symbols.chindingsSym]?.replace?.(
                /(.*"request_id":")[^"]*(".*)/,
                `$1${context.awsRequestId || ''}$2`
            );
        } else {
            this.provider = this.provider.child({ request_id: context?.awsRequestId });
        }

        return this;
    }

    /** Returns a new Logger */
    child(name: string): Logger {
        return new PinoLogger(this.provider.child({ operation: name }));
    }

    info(msg: any, data?: any): void {
        this.provider.info(this.handleArgs(msg, data));
    }
    error(msg: any, data?: any): void {
        this.provider.error(this.handleArgs(msg, data));
    }
    debug(msg: any, data?: any): void {
        this.provider.debug(this.handleArgs(msg, data));
    }
    warn(msg: any, data?: any): void {
        this.provider.warn(this.handleArgs(msg, data));
    }
    trace(msg: any, data?: any): void {
        this.provider.trace(this.handleArgs(msg, data));
    }
    /**
     * Used to log data in flat top-level form for kibana business dashboards.
     *
     * Values should be primitives only, no object or array
     *
     * @param identifiers have to be `toString()`ed (for number and boolean)
     */
    metric(
        metric_type: string,
        identifiers?: Record<string, string>,
        metrics?: Record<string, string | number | boolean | bigint | null | undefined>
    ): void {
        this.provider.metric({
            metric_type,
            identifiers,
            metrics
        })
    }

    private handleArgs(msg: any, data?: any): any {
        if (typeof msg === 'string' && !data) {
            return msg;
        }
        if (typeof msg === 'string' && !!data) {
            return {
                msg,
                data
            };
        }
        if (msg instanceof Error) {
            return {
                msg: msg.message,
                data,
                error: msg.stack
            };
        }
        if (!!msg && typeof msg === 'object' && !data) {
            return {
                msg: msg.msg || 'Only data log',
                data: msg
            };
        }
        if (!!msg && typeof msg === 'object' && !!data && typeof data === 'object') {
            return {
                msg: msg.msg || data.msg || 'Only data log',
                data: { data0: msg, data1: data }
            };
        }
    }
}
