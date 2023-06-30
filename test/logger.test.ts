import { PinoLogger } from '../src';
import type { Context } from 'src/aws';
import pino from 'pino';

describe('Logger Unit tests', () => {
    beforeAll(() => {
        jest.restoreAllMocks();
    })
    afterAll(() => {
        jest.restoreAllMocks();
    })
    test('setContext', () => {
        const spy = jest.spyOn(process.stdout, 'write')
        spy.mockImplementation(function (/*data*/) { /* process.stderr.write(`debug: ${data}`); */ return true; });

        const logger = new PinoLogger(pino({
            level: 'info',
            timestamp: undefined,
            base: {
                pid: undefined,
                hostname: undefined
            }
        }))

        logger.info('hello')
        expect(spy).toHaveBeenNthCalledWith(1, "{\"level\":30,\"msg\":\"hello\"}\n")

        const reqIds = [
            '123-456',
            '789',
            'abc-def',
            'hij-klm'
        ]

        for (const [index, reqId] of reqIds.entries()) {
            logger.setContext({ awsRequestId: reqId } as Context)
            logger.info(`${index}`)
            expect(spy).toHaveBeenNthCalledWith(index + 2, `{"level":30,"request_id":"${reqId}","msg":"${index}"}\n`)
        }
        spy.mockRestore();
    });


    test('metric', () => {
        const spy = jest.spyOn(process.stdout, 'write')
        spy.mockImplementation(function (/*data*/) { /*process.stderr.write(`debug: ${data}`); */ return true; });
        const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => 1640995200000)

        const logger = PinoLogger.build('dom', 'proc')

        logger.metric('AWESOME_WORKFLOW', { workflow_id: (15)?.toString(), id: 'abc' }, {
            success: true,
            value: 'hello',
            count: 42
        })

        expect(spy).toHaveBeenNthCalledWith(
            1,
            "{\"level\":35,\"time\":\"1640995200\",\"domain\":\"dom\",\"process\":\"proc\",\"metric_type\":\"AWESOME_WORKFLOW\",\"identifiers\":{\"workflow_id\":\"15\",\"id\":\"abc\"},\"metrics\":{\"success\":true,\"value\":\"hello\",\"count\":42}}\n"
        )

        spy.mockRestore();
        dateSpy.mockRestore();
    });
});
