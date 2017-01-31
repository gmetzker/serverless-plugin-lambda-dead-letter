# 1.2.0 (2017-01-30)

## Features
* Dead Letter Queue properties #12

## Meta
* [Git Hub Mile Stone](https://github.com/gmetzker/serverless-plugin-lambda-dead-letter/milestone/2?closed=1)
* [Comparison since last release](https://github.com/gmetzker/serverless-plugin-lambda-dead-letter/compare/v1.1.0...v1.2.0)


# 1.1.0 (2017-01-29)

## Features
* Simplified syntax to create new SQS queue and use it in the function's `DeadLetterConfig.TargetArn` #10
* Simplified syntax to create a new SNS topic and use it in the function's `DeadLetterConfig.TargetArn` #11
* Validate function `deadLetter` object before deploy #26

 ## Bug Fixes
 * Do not call `UpdateFunctionConfiguration` when `--noDeploy` option is specified #19

 ## Meta
 * [Git Hub Mile Stone](https://github.com/gmetzker/serverless-plugin-lambda-dead-letter/milestone/3?closed=1)
 * [Comparison since last release](https://github.com/gmetzker/serverless-plugin-lambda-dead-letter/compare/v1.0.0...v1.1.0)

# 1.0.0 (2017-01-15)

## Features
* Basic support to assign the Lambda `DeadLetterConfig` using after serverless Cloudformation stack is deployed.  [Amazon Docs](http://docs.aws.amazon.com/lambda/latest/dg/dlq.html)
  * Plugin makes a call to the [Lambda Api](http://docs.aws.amazon.com/lambda/latest/dg/API_UpdateFunctionConfiguration.html)
 `UpdateFunctionConfiguration`
* Using a pre-existing SQS Queue or SNS Topic as a dead letter target.
* Using an SNS Queue or SNS Topic created in the resources section.
* Remove a previously existing dead letter `targetArn` by specifying a blank `targetArn`
