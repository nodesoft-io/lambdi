# LambDI

Lambda with Typescript and DI

LambDI is based on https://github.com/mgechev/injection-js.

## Example:

```typescript
class MyService {
    foo() {
        return 'hello world!';
    }
}

@Lambda({
    providers: [MyService]
})
class MyLambda {
    constructor(private service: MyService) {}

    onHandler(@Event event: APIGatewayProxyEvent): APIGatewayProxyResult {
        return {
            statusCode: 200,
            body: this.service.foo()
        };
    }
}

export const handler = generateHandler(MyLambda);
```

## Lambda Decorator

`@Lambda({ ...options })`

Allows a class to resolve and inject dependencies.
Entrypoint for the Lambda and must inplements OnHandler.

Options:

-   `providers` - list of class or provider

Example:

```typescript
@Lambda({
    providers: [Service]
})
class MyLambda { ... }
```

## @Event and @Ctx

You need the decorate your onHandler's arguments

-   `@Event`: Inject the event object of the lambda, **and pass it to Molder if the type is compatible**
-   `@Ctx`: Inject the context object of the lambda

```typescript
@Lambda()
class MyLambda {
    onHandler(@Event event: SQSEvent, @Ctx context: Context);
}
```

## @SQSRecord("part")

to facilitate the handling of sqs batchs, you can decorate the onHandler with `@SQSRecord()`.
this will call onHandler for each record of the sqs batch and handle the failure of the onHandler without
interupting the other events. the record value will be available with `@Event`

### error handling

with `@SQSRecord()`, lambdi will take care of the partialfailure and handle any error in the function

### part parameter

SQSRecord accept one parameter: a path to the consumed data included in the body of the SQSRecord.
if this parameter is given, Lambdi will not provide the original SQS body but will browse it to
provide the subpart matching the given path. it's especialy usefull if the sqs body contained a EventBridge event

ie: your queue contain a SQSEvent<EventBridgeEvent<MyPayload>>

```ts
@Lambda()
class MyLambda {
    @SQSRecord("detail")
    onHandler(@Event event: MyPayload) {
        // the original sqs event contained a eventbridge event containing a MyPayload. we extracted it and matched it with molder
        // now, exploit your event with confidence

    }
}

```


### compartion with old partialFailure

the lambda consume each eb event in a record, and send a new event with the `count` + 17 for each of them

old, good implementation
```ts
@Lambda({
    partialBatchFailure: true
})
class MyLambda {
    onHandler(@Event event: SQSEvent): Promise<number>[] {
        return event.Records.map(async record => {
            const event = Molder.instantiate(MyEbEvent, JSON.parse(record.body).detail);
            return this.eventBridge.publish({val: event.count + 17}, "detail", "source", "service");
        });
    }
}
```

old, **broken** implementation
```ts
@Lambda({
    partialBatchFailure: true
})
class MyLambda {
    onHandler(@Event event: SQSEvent): Promise<number>[] {
        // this will make all record fail of one is not valid
        return event.Records.map(record => this.eventBridge.publish({val: JSON.stringify(record.body).detail.count + 17}, "detail", "source", "service"));
    }
}
```

with @SQSRecord
```ts
@Lambda({
    partialBatchFailure: true
})
class MyLambda {
    @SQSRecord("detail")
    async onHandler(@Event event: MyEbEvent): Promise<number> {
        return this.eventBridge.publish({val: event.count + 17}, "detail", "source", "service");
    }
}
```
## @Cors("allowed-origins")
To inject access-control-allow-origin headers in response, you can decorate the onHandler with `@Cors()`.
This will check if origin set in header request is allowed in authorized origins (pass as params).
If allowed origins passed in decorator is equal to * or if Origin header sent by the user agent in request header  matches one of the origins allowed, then Origin requested will be injected in response header as access-control-allow-origin-header.


## Service Decorator

`@Service()`

Allows a class to resolve and inject dependencies.
Must be provided as provider of the `@Lambda` if used.

Example:

```typescript
class MyService {
    foo() {
        return 1;
    }
}

@Service()
class MyServiceWithDep {
    constructor(private svc: MyService) {}

    foobar() {
        return this.svc.foo() + 1;
    }
}

@Lambda({
    providers: [MyService, MyServiceWithDep]
})
class MyLambda {
    constructor(private svc: MyServiceWithDep) {}

    onHandler() {
        return this.svc.foobar();
    }
}
```

## AWS Services

AWS Services are automatically injected:

```typescript
...
constructor(
    private s3: AWS.S3,
    private sqs: AWS.SQS,
    private sns: AWS.SNS,
    private db: AWS.DynamoDB.DocumentClient
) {
    this.db.PutItem(...);
    this.s3.GetObject(...);
    ...
}
...
```

## usage of custom Injection Token

the dependency injector allow to provide custom injection token.
create an custom injection token and allow to use it in the injector or other stuff.

```typescript
// create the token
export const MY_CUSTOM_PARAM = new InjectionToken<string>('MY_CUSTOM_PARAM');

// provide a default value in the injection of the type
@Service({ providers: [{ provide: MY_CUSTOM_PARAM, useValue: 'defaultValue' }] })
class MyService {

    constructor(@Inject(MY_CUSTOM_PARAM) private readonly val: FromInjectionToken<typeof MY_CUSTOM_PARAM> /* aka string */) {}

    getVal(): string {
        return this.val;
    }
}

// now you can provide a custom value for the token in outer scope of the injector
@Lambda({ providers: [MyService, { provide: MY_CUSTOM_PARAM, useValue: 'CustomizedValue' }] })
class MyLambda {
    constructor(private readonly s: MyService) {}
    async onHandler(): Promise<string> {
        return this.s.getVal();
    }
}

```

## SQS Partial Batch Failure

A Lambda can be triggered by a SQS Queue.
That queue can trigger one Lambda with a batch of maximum 10 messages.

If the 10 messages are processed successfuly, Lambda will delete the messages in the queue.

If all the messages fail to be processed, Lambda will not delete the batch of 10 messages.

But if some messages are successful and some are not, Lambda will keep the 10 messages in the queue and then with the retry policy, the successful ones will be re-processed again.

This feature helps to prevent that.

When the feature is activated, with the right event and the right result and on a partial failure, LambDI will delete manually all the successful messages

### How to use

-   Activate the `partialBatchFailure` parameter
-   Return an array of promises matching the records

```typescript
@Lambda({
    providers: [...],
    partialBatchFailure: true
})
class MyLambda {
    onHandler(@Event event: SQSEvent): Promise<boolean>[] {
        return event.Records.map(record => Promise.resolve(true));
    }
}
```

## API Gateway Validation and Documentation

### Molder is needed

LambDI allows to integrate validation and documentation with Models
You can do that with decorators:

-   `@QueryParams`: Will use the model specified as a type to validate the queryparams from the api event
-   `@PathParams`: Will use the model specified as a type to validate the pathparams from the api event
-   `@Headers`: Will use the model specified as a type to validate the headers from the api event
-   `@Payload`: Will use the model specified as a type to validate the payload from the api event
-   `@ApiResponse(model | { [status]: model })`: Will use the model for the right statusCode and validate the response

```typescript
class Query {
    @Simple foo: string;
}
class Path {
    @Simple foo: string;
}
class HeadersData {
    @Simple 'x-foo': string;
}
class PostData {
    @Simple foo: string;
    @Required bar: number;
}
class MyReponse {
    @Required: foobar: string;
}
@Lambda({
    providers: [...]
})
class MyLambda {
    @ApiResponse(MyResponse)
    onHandler(
        @QueryParams query: Query,
        @PathParams: path: Path,
        @Headers headers: HeadersData
        @Payload data: PostData
    ): APIGatewayProxyResponse<MyResponse> {
        return { statusCode: 200, body: { foobar: 'hello' } };
    }
}
```

## Logger

LambDI injects a logger using Pino.
It logs with a JSON format.

You can specify the level of logging with a var env:

`LOGGER_LEVEL`:

```typescript
class MyService {
    constructor(private logger: Logger) {}
    foo() {
        this.logger.info('foo() has been called');
        return 1;
    }
}
```

## Error handler for API response

When a model validation failed LambDI responds a 400 http response.
Sometimes you need to change the response with a custom one.

To do that:

```typescript
class PostData {
    @Simple foo: string;
    @Required bar: number;
}
@Lambda({
    providers: [...]
})
class MyLambda {
    onHandler(@Payload data: PostData): APIGatewayProxyResponse<MyResponse> {
        return { statusCode: 200, body: { foobar: 'hello' } };
    }
    // return additionnal header when PostData failed its validation
    onError(event: APIGatewayEvent /*, context, error */): { headers: Record<string, boolean | number | string> } {
        return { headers: httpUtils.createOriginHeader(httpUtils.getOriginFromEvent(event)) };
    }
}
```
