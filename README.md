# Serverless Plugin:  Lambda DeadLetterConfig

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://img.shields.io/npm/v/serverless-plugin-lambda-dead-letter.svg)](https://www.npmjs.com/package/serverless-plugin-lambda-dead-letter)


[![Build Status](https://travis-ci.org/gmetzker/serverless-plugin-lambda-dead-letter.svg?branch=master)](https://travis-ci.org/gmetzker/serverless-plugin-lambda-dead-letter)
[![Coverage Status](https://coveralls.io/repos/github/gmetzker/serverless-plugin-lambda-dead-letter/badge.svg?branch=master)](https://coveralls.io/github/gmetzker/serverless-plugin-lambda-dead-letter?branch=master)
[![dependencies Status](https://img.shields.io/david/gmetzker/serverless-plugin-lambda-dead-letter.svg)](https://david-dm.org/gmetzker/serverless-plugin-lambda-dead-letter)
[![devDependencies Status](https://img.shields.io/david/dev/gmetzker/serverless-plugin-lambda-dead-letter.svg)](https://david-dm.org/gmetzker/serverless-plugin-lambda-dead-letter?type=dev)



## What is it?

A [serverless](https://serverless.com/) plugin that can assign a `DeadLetterConfig` to a Lambda function and optionally create a new SQS queue or SNS Topic with a simple syntax.

Failed asynchronous messages for Amazon Lambda can be be sent to an SQS queue or an SNS topic by setting the `DeadLetterConfig`.  Lambda Dead Letter Queues [are documented here](http://docs.aws.amazon.com/lambda/latest/dg/dlq.html).  

At the time this plugin was developed AWS Cloudformation (and serverless) did not support the `DeadLetterConfig` property of the Lambda so we have introduced a plugin that calls `UpdateFunctionConfiguration` on the lambda after serverless deploys the CloudFormation stack.

## Installation

### Requirements
* nodeJs > `v4.0`
* serverless > `v1.4`

Install the plugin.
```bash
npm install serverless-plugin-lambda-dead-letter
```

Install the plugin with npm and reference it in the serverless yaml file [as documented here.](https://serverless.com/framework/docs/providers/aws/guide/plugins/)

```YAML
# serverless.yml file

plugins:
  - serverless-plugin-lambda-dead-letter
```

## How do I use it?

Dead letter settings are assigned via a new `deadLetter` property nested under a function in a `serverless.yml` file.  

There are several methods to configure the Lambda deadLetterConfig.

* [Method-1](#method-1):  Create a new deadLetter SQS queue or SNS Topic
* [Method-2](#method-2):  Use a pre-existing queue/topic.
* [Method-3](#method-3):  Use a queue/topic created in the resources.
* [Remove Dead Letter Resource](#remove-deadletter-resource):  Remove any deadletter queue/topic that was previously assigned.

### Method-1

#### DeadLetter Queue
Use the `deadLetter.sqs` to create a new dead letter queue for the function.  


The resulting cloudformation stack will contain an SQS Queue and it's respective QueuePolicy.  

#### Create new dead-letter queue by name
```YAML
# 'functions' in serverless.yml

functions:
  createUser: # Function name
    handler: handler.createUser # Reference to function 'createUser' in code

    deadLetter:
      sqs:  createUser-dl-queue  # New Queue with this name
```

#### Create new dead-letter queue with properties
```YAML
# 'functions' in serverless.yml

functions:
  createUser: # Function name
    handler: handler.createUser # Reference to function 'createUser' in code

    deadLetter:
      sqs:      # New Queue with these properties
        queueName: createUser-dl-queue
        delaySeconds: 60
        maximumMessageSize: 2048
        messageRetentionPeriod: 200000
        receiveMessageWaitTimeSeconds: 15
        visibilityTimeout: 300
```

#### DeadLetter Topic

Use the `deadLetter.sns` to create a new dead letter topic for the function.

The resulting cloudformation stack will contain an SQS Topic resource.

```YAML
# 'functions' in serverless.yml

functions:
  createUser: # Function name
    handler: handler.createUser # Reference to function 'createUser' in code

    deadLetter:
      sns:  createUser-dl-topic
```


### Method-2
Use the `targetArn` property to specify the exact SQS queue or SNS topic to use for Lambda dead letter messages.  In this case the queue\topic must already exist as must the queue\topic policy.

Reference the ARN of an existing queue `createUser-dl-queue`
```YAML
# 'functions' in serverless.yml

functions:
  createUser: # Function name
    handler: handler.createUser # Reference to function 'createUser' in code

    deadLetter:
      targetArn: arn:aws:sqs:us-west-2:123456789012:createUser-dl-queue
```

### Method-3
If you created a queue\topic in the `resource` section you can reference it using the `GetResourceArn` pseudo method.  

This will use the arn of the resource referenced by `{logicalId}`
```YAML
    deadLetter:
      targetArn:
        GetResourceArn: {logicalId}
```
Note:  
- At present this only works for SQS queues or SNS Topics.
- If a queue\topic is created in the `resources` section you will still need to add a resource for the respective queue\topic policy so that that lambda has permissions to write to the dead letter queue\topic.

In this example the `createUser` lambda function is using the new `CreateUserDeadLetterQueue` SQS queue defined in the resources section.

```YAML
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

### Remove DeadLetter Resource
If you previously had a DeadLetter target and want to remove it such that there is no dead letter queue or topic you can supply the `deadLetter` object with an empty `targetArn`.  Upon deploy the plugin will run the Lambda `UpdateFunctionConfiguration` and set an empty TargetArn.

```YAML
# 'functions' in serverless.yml

functions:
  createUser: # Function name

    handler: handler.createUser # Reference to function 'createUser' in code

    # ...

    # Set an empty targetArn to erase previous DLQ settings.
    deadLetter:
      targetArn:
```
