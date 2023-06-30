import {
    DeleteMessageBatchCommand,
    DeleteMessageBatchRequestEntry,
    SQSClient
} from '@aws-sdk/client-sqs';
import { SQSEvent, SQSRecord } from 'aws-lambda';

/**
 * Get the queue url based on the record
 *
 * @param sqs
 * @param eventSourceARN
 */
function getQueueUrl(sqs: SQSClient, eventSourceARN: string): string {
    const [, , , , accountId, queueName] = eventSourceARN.split(':');
    return `${sqs.config.endpoint}${accountId}/${queueName}`;
}

/**
 * Get only the rejected reasons from the results
 *
 * @param results
 */
function getRejectedErrors<T>(results: PromiseSettledResult<T>[]): Error[] {
    return results
        .filter((r) => r.status === 'rejected')
        .map((r: PromiseRejectedResult) => r.reason);
}

/**
 * Get only the successful records from the result
 *
 * @param records
 * @param results
 */
function getFulfilledRecords<T>(
    records: SQSRecord[],
    results: PromiseSettledResult<T>[]
): SQSRecord[] {
    return records.filter((_, index) => results[index].status === 'fulfilled');
}

/**
 * Get the concat error from all the rejected records
 *
 * @param errors
 */
function getErrorMessage(errors: Error[]): string {
    return errors.map((e) => e.message).join('\n');
}

/**
 * Delete all records successfully executed inside the queue
 *
 * @param sqs
 * @param records
 */
async function deleteSQSMessages(sqs: SQSClient, records: SQSRecord[]) {
    if (!(records && records.length)) {
        return Promise.resolve();
    }
    return sqs
        .send(
            new DeleteMessageBatchCommand({
                Entries: []
                    .concat(records)
                    .filter(Boolean)
                    .map((record: SQSRecord, k) => ({
                        Id: `${k}`,
                        ReceiptHandle: record.receiptHandle
                    })) as DeleteMessageBatchRequestEntry[],
                QueueUrl: getQueueUrl(sqs, records[0].eventSourceARN)
            })
        )
        .catch();
}

/**
 * Execute the promises and delete the successful records in the queue
 *
 * @param event
 * @param promises
 * @param sqs
 */
export async function applySQSPartialBatchFailure<R>(
    event: SQSEvent,
    promises: Promise<R>[],
    sqs: SQSClient
): Promise<R[]> {
    return Promise.allSettled(promises).then((results) => {
        const errors = getRejectedErrors(results);
        if (!errors.length) {
            return results.map((result) => result.status === 'fulfilled' && result.value);
        }
        return deleteSQSMessages(sqs, getFulfilledRecords(event.Records, results)).then(() => {
            // one error or all the same stack, we return only one error to preserve the real stack
            if (errors.map((e) => e.stack).every((val, i, arr) => val === arr[0])) {
                // only one error, we throw the original error itself
                return Promise.reject(errors[0]);
            } else {
                // many differents errors, we console.error each stack trace
                errors.forEach((e) => console.error(e));
                // return a new error with all messages, but his stacktrace will start from there
                return Promise.reject(new Error(getErrorMessage(errors)));
            }
        });
    });
}
