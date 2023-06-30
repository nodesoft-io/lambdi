import { DynamoDB, S3, SQS, SNS, SSM, StepFunctions, EventBridge, Athena } from 'aws-sdk';
import { Provider } from './interfaces';

import { Context } from 'aws-lambda';

export { Context };

interface Params {
    service: string;
    options?: any;
}

let aws = require('aws-sdk');

// X-RAY
if (!process.env.DISABLE_XRAY) {
    const AWSXRay = require('aws-xray-sdk-core');
    aws = AWSXRay.captureAWS(require('aws-sdk'));
}

/**
 * LocalStack Mapping Ports
 *
 * @param service
 */
function getServicePort(service: string): string {
    switch (service) {
        case 's3':
            return '4572';
        case 'dynamodb':
            return '4569';
        case 'sqs':
            return '4576';
        case 'sns':
            return '4575';
        case 'ssm':
            return '4583';
        case 'step-functions':
            return '4585';
        case 'event-bridge':
            return '4587';
    }
}

function params(params: Params) {
    return process.env.AWS_SAM_LOCAL &&
        process.env.USE_LOCALSTACK &&
        process.env.USE_LOCALSTACK !== 'false'
        ? {
              ...(params.options || {}),
              endpoint: `http://localstack:${getServicePort(params.service)}`
          }
        : params.options;
}

/**
 * Check if backend services is present, return providers for the DI
 */
export const AWSEkonooServices = () => {
    try {
        const backendCommon = require('@ekonoo/backend-common');
        return (backendCommon && backendCommon.PROVIDERS) || [];
    } catch {
        return [];
    }
};

/**
 * Provide a list of AWS Services for the Lambda DI
 *
 * @param options
 */
export const AWSProviders = () =>
    [
        {
            provide: DynamoDB.DocumentClient,
            useFactory: () =>
                new aws.DynamoDB.DocumentClient(
                    params({
                        service: 'dynamodb',
                        options: { httpOptions: { connectTimeout: 500 } }
                    })
                ),
            deps: []
        },
        {
            provide: S3,
            useFactory: () => new aws.S3(params({ service: 's3' })),
            deps: []
        },
        {
            provide: SQS,
            useFactory: () => new aws.SQS(params({ service: 'sqs' })),
            deps: []
        },
        {
            provide: SNS,
            useFactory: () => new aws.SNS(params({ service: 'sns' })),
            deps: []
        },
        {
            provide: SSM,
            useFactory: () => new aws.SSM(params({ service: 'ssm' })),
            deps: []
        },
        {
            provide: StepFunctions,
            useFactory: () => new aws.StepFunctions(params({ service: 'step-functions' })),
            deps: []
        },
        {
            provide: EventBridge,
            useFactory: () => new aws.EventBridge(params({ service: 'event-bridge' })),
            deps: []
        },
        {
            provide: Athena,
            useFactory: () => new aws.Athena(),
            deps: []
        }
    ] as Provider[];
