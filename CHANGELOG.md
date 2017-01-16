# 1.0.0 (2017-01-15)

 ## Features
* Basic support to assign the Lambda `DeadLetterConfig` using after serverless Cloudformation stack is deployed.  [Amazon Docs](http://docs.aws.amazon.com/lambda/latest/dg/dlq.html)
  * Plugin makes a call to the [Lambda Api](http://docs.aws.amazon.com/lambda/latest/dg/API_UpdateFunctionConfiguration.html)
 `UpdateFunctionConfiguration`
* Using a pre-existing SQS Queue or SNS Topic as a dead letter target.
* Using an SNS Queue or SNS Topic created in the resources section.
* Remove a previously existing dead letter `targetArn` by specifying a blank `targetArn`
