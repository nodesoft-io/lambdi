import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Molder } from './models';
import { hasMetadata } from './models/builder';

/**
 * @see https://owasp.org/www-project-secure-headers/ best practices
 */
export const SECURITY_HEADERS = {
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none';",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains', // HSTS 1y
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN'
};

export class BadRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BadRequestError';
    }
}

export interface APIGatewayProxyResponse<Response> {
    statusCode: number;
    headers?: {
        [header: string]: boolean | number | string;
    };
    multiValueHeaders?: {
        [header: string]: Array<boolean | number | string>;
    };
    body: Response;
    isBase64Encoded?: boolean;
}
export class CorsBuilder {
    private readonly allowedOrigins: string[];

    constructor(allowedOrigins?: string) {
        if (typeof allowedOrigins === 'string' || (allowedOrigins as any) instanceof String) {
            this.allowedOrigins = allowedOrigins?.split(',');
        } else {
            this.allowedOrigins = [];
        }
    }

    /**
     * Return an object that contains an Access-Control-Allow-Origin header
     * if the request origin matches a pattern for an allowed origin.
     * Otherwise, return an empty object.
     * @param {String} origin the origin to test against the allowed list
     * @return {Object} an object containing allowed header and its value
     */
    createOriginHeader(event: { headers: Record<string, string> }) {
        let cors: Record<string, string> = {};
        const origin = this.getOriginFromEvent(event);
        if (this.allowedOrigins.includes('*')) {
            cors = { 'Access-Control-Allow-Origin': origin };
        } else {
            // look for origin in list of allowed origins
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const allowedPatterns = this.allowedOrigins.map(this.compileURLWildcards);
            const isAllowed = allowedPatterns.some((pattern) => pattern.exec(origin));
            if (isAllowed) {
                cors = { 'Access-Control-Allow-Origin': origin };
            }
        }
        return cors;
    }

    /**
     * Extract the Origin header from a Lambda event
     * @param event Lambda event
     */
    private getOriginFromEvent(event: { headers: Record<string, string> }): string {
        const headers = event.headers || {};
        return headers.Origin || headers.origin;
    }

    /**
     * Compiles a URL containing wildcards into a regular expression.
     *
     * Builds a regular expression that matches exactly the input URL, but allows
     * any number of URL characters in place of each wildcard (*) character.
     * http://*.example.com matches http://abc.xyz.example.com but not http://example.com
     * http://*.example.com does not match http://example.org/.example.com
     * @param {String} url the url to compile
     * @return {RegExp} compiled regular expression
     */
    compileURLWildcards(url: string): RegExp {
        // unreserved characters as per https://tools.ietf.org/html/rfc3986#section-2.3
        const urlUnreservedPattern = '[A-Za-z0-9-._~]';
        const wildcardPattern = urlUnreservedPattern + '*';

        const parts = url.split('*');
        const escapeRegex = (str: string): string => str.replace(/([.?*+^$(){}|[\-\]\\])/g, '\\$1');
        const escaped = parts.map(escapeRegex);
        return new RegExp('^' + escaped.join(wildcardPattern) + '$');
    }
}

function instantiateParams(type: new () => {}, data: any) {
    try {
        return Molder.instantiate(type, data);
    } catch (err) {
        throw new BadRequestError(`${type.name}: ${err.message}`);
    }
}

/**
 * Return an object that contains an Access-Control-Allow-Origin header
 * if the request origin matches a pattern for an allowed origin.
 * Otherwise, return an empty object.
 * @param {String} origin the origin to test against the allowed list
 * @return {Object} an object containing allowed header and its value
 */

export function extractArguments(event: APIGatewayProxyEvent, context: Context, token: Function) {
    const decorators = Reflect.getOwnMetadata('lambdi:args', token.prototype, 'onHandler');
    const types = Reflect.getOwnMetadata('design:paramtypes', token.prototype, 'onHandler');
    return []
        .concat(types)
        .filter(Boolean)
        .map((type: any, i: number) => {
            switch ((Object.entries(decorators || []).find(([_, v]) => v === i) || []).shift()) {
                case 'lambdi:event':
                    if (hasMetadata(type)) {
                        return instantiateParams(type, event);
                    } else {
                        return event;
                    }
                case 'lambdi:context':
                    return context;
                case 'lambdi:queryparams':
                    return instantiateParams(type, { ...event.queryStringParameters });
                case 'lambdi:multiqueryparams':
                    return instantiateParams(type, { ...event.multiValueQueryStringParameters });
                case 'lambdi:pathparams':
                    return instantiateParams(type, { ...event.pathParameters });
                case 'lambdi:headers':
                    return instantiateParams(type, { ...event.headers });
                case 'lambdi:payload':
                    return instantiateParams(type, JSON.parse(event.body));
                default:
                    return undefined;
            }
        });
}

function bodyIsNotJSON(
    response: APIGatewayProxyResponse<any>
): response is APIGatewayProxyResponse<string> {
    return (
        typeof response.body === 'string' &&
        response.headers &&
        response.headers['Content-Type'] &&
        response.headers['Content-Type'] !== 'application/json'
    );
}

/**
 * Instantiate, Validate and stringify the response
 *
 * @param response
 * @param responseModel
 */
export function instantiateAndValidateResponse<Response extends new () => Response>(
    response: APIGatewayProxyResponse<Response> | Promise<APIGatewayProxyResponse<Response>>,
    responseModels: Response[]
): Promise<APIGatewayProxyResult> {
    return Promise.resolve()
        .then(() => response)
        .then((resp) => ({
            ...resp,
            body:
                resp && bodyIsNotJSON(resp)
                    ? resp.body
                    : JSON.stringify(
                          responseModels[resp?.statusCode]
                              ? Molder.instantiate(responseModels[resp?.statusCode], resp?.body)
                              : resp?.body
                      )
        }));
}

/**
 * https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html#user-pool-access-token-payload
 */
export interface CognitoAccessTokenJWT {
    sub: string;
    'cognito:groups': string[];
    token_use: string;
    scope: string;
    auth_time: number;
    iss: string;
    exp: number;
    iat: number;
    version: number;
    jti: string;
    client_id: string;
    username: string;
}

/** Check if one of the allowed groups defined on the lambda is present in the access token */
export function isInAllowedGroups(event: APIGatewayProxyEvent, allowedGroups: string[]): boolean {
    const jwt = (event.headers.Authorization || event.headers.authorization)?.replace(
        'Bearer ',
        ''
    );
    let payload: CognitoAccessTokenJWT;

    try {
        payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    } catch (err) {
        return false;
    }

    return payload['cognito:groups']?.some((e) => allowedGroups.includes(e));
}
