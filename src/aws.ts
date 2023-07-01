import { Provider } from './interfaces';

import { Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SNSClient } from '@aws-sdk/client-sns';
import { SSMClient } from '@aws-sdk/client-ssm';
import { SFNClient } from '@aws-sdk/client-sfn';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export { Context };

/**
 * Provide a list of AWS Services for the Lambda DI
 *
 * @param options
 */
export const AWSProviders = () =>
    [
        {
            provide: DynamoDBClient,
            useFactory: () => DynamoDBDocumentClient.from(new DynamoDBClient({})),
            deps: []
        },
        {
            provide: S3Client,
            useFactory: () => new S3Client({}),
            deps: []
        },
        {
            provide: SQSClient,
            useFactory: () => new SQSClient({}),
            deps: []
        },
        {
            provide: SNSClient,
            useFactory: () => new SNSClient({}),
            deps: []
        },
        {
            provide: SSMClient,
            useFactory: () => new SSMClient({}),
            deps: []
        },
        {
            provide: SFNClient,
            useFactory: () => new SFNClient({}),
            deps: []
        },
        {
            provide: EventBridgeClient,
            useFactory: () => new EventBridgeClient({}),
            deps: []
        }
    ] as Provider[];
