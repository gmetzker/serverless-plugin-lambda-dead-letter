# Serverless Plugin:  DeadLetterConfig

## What is it?

A [serverless](https://serverless.com/) plugin that can assign the `DeadLetterConfig` to a Lambda function.

Failed asynchronous messages for Amazon Lambda can be be sent to an SQS queue or SNS topic by setting the `DeadLetterConfig`.  Lambda Dead Letter Queues [are documented here](http://docs.aws.amazon.com/lambda/latest/dg/dlq.html).  

At the time this plugin was developed AWS Cloudformation (and serverless) did not support the `DeadLetterConfig` property of the Lambda so we have introduced a plugin that calls `UpdateFunctionConfiguration` on the lambda after serverless deploys the CloudFormation stack.

## Installation

Install the plugin with npm and reference it in the serverless yaml file [as documented here.](https://serverless.com/framework/docs/providers/aws/guide/plugins/)

```
# serverless.yml file

plugins:
  - serverless-plugin-lambda-dead-letter
```

## How do I use it?

Dead letter settings are assigned via a new `deadLetter` property nested under a function in a `serverless.yml` file.  The property name `deadLetter` was used rather than `deadLetterConfig` so that future internal implementations of `deadLetterConfig`, that will most likely be directly supported by CloudFormation natively, will not conflict.

There are several ways to inform the plugin how you want to wire up the DLQ.

### Method-1
Use the `targetArn` property to specify the exact SQS queue or SNS topic to use for Lambda dead letter messages.  In this case the queue\topic must already exist as must the queue\topic policy.

Reference the ARN of an existing queue `createUser-dl-queue`
```
# 'functions' in serverless.yml

functions:
  createUser: # Function name
    handler: handler.createUser # Reference to function 'createUser' in code

    deadLetter:
      targetArn: arn:aws:sqs:us-west-2:123456789012:createUser-dl-queue
```

### Method-2
If you created a queue\topic in the `resource` section you can reference it using the `GetResourceArn` pseudo method.  

This will use the arn of the resource referenced by `{logicalId}`
```
    deadLetter:
      targetArn:
        GetResourceArn: {logicalId}
```
Note:  
- At present this only works for SQS queues or SNS Topics.
- If a queue\topic is created in the `resources` section you will still need to add a resource for the respective queue\topic policy so that that lambda has permissions to write to the dead letter queue\topic.

In this example the `createUser` lambda function is using the new `CreateUserDeadLetterQueue` SQS queue defined in the resources section.

```
# 'functions' in serverless.yml

functions:
  createUser: # Function name

    handler: handler.createUser # Reference to function 'createUser' in code

    # ...

    deadLetter:
      targetArn:
        GetResourceArn: CreateUserDeadLetterQueue

resources:
    Resources:
      CreateUserDeadLetterQueue:
        Type: AWS::SQS::Queue
        Properties:
          QueueName: create-user-lambda-dl-queue

      CreateUserDeadLetterQueuePolicy:
        Type: AWS::SQS::QueuePolicy
        Properties:
          Queues:
            - Ref: CreateUserDeadLetterQueue

            # Policy properties abbreviated but you need more here ...
```


## TODO:

- [ ] Unit tests
- [ ] Code coverage
- [ ] Grunt/Node:  Run Unit tests and code coverage automatically
- [ ] Refactor to break into several files.
- [ ] Add license file
- [ ] Implement simplified syntax:
    - Compiles new Queue/Topic into CF template and adds Queue/Topic Policy such that Lambda function can write to it.
    - Adds DeadLetterConfig afterward with call to `UpdateFunctionConfiguration`

    Future:
    ```
    deadLetter:
      targetQueue: {name of new SQS Queue}
    ```

    ```
    deadLetter:
      targetTopic: {name of new SNS Topic}
    ```
