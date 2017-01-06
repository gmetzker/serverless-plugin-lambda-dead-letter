
const BbPromise = require('bluebird');

class Plugin {

  constructor(serverless, options) {

    this.serverless = serverless;
    this.options = options;
    this.provider = serverless.getProvider('aws');

    this.hooks = {

      'deploy:deploy': () => BbPromise.bind(this)
        .then(this.setLambdaDeadLetterConfig),


      'setLambdaDeadLetterConfig:setLambdaDeadLetterConfig': () => BbPromise.bind(this)
        .then(this.setLambdaDeadLetterConfig)

    };

    this.commands = {
      setLambdaDeadLetterConfig: {
        usage: 'Adds subscriptions to any SNS Topics defined by externalSNS.',
        lifecycleEvents: ['setLambdaDeadLetterConfig']
      }
    };

  }

  buildDeadLetterUpdateParams(functionName) {

    const functionObj = this.serverless.service.getFunction(functionName);

    this.serverless.cli.log(`** Function:  ${functionName}`);

    if (!functionObj.deadLetter) {
      return BbPromise.resolve();
    }
    if (functionObj.deadLetter.targetArn === undefined) {
      throw new Error(`Function: ${functionName} is missing 'targetArn' value.`);
    }
    const targetArn = functionObj.deadLetter.targetArn;

    return BbPromise.bind(this)
      .then(() => {

        if (targetArn === null ||
          (typeof targetArn === 'string' && targetArn.trim().length === 0)) {

          return BbPromise.resolve('');

        } else if (typeof targetArn === 'string') {

          const rg = new RegExp(
            '^(arn:aws:sqs:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_.]{1,80}' +
            '|arn:aws:sns:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_]{1,256})$');


          if (!rg.test(targetArn)) {
            throw new Error(`Function property ${functionName}.deadLetter.targetArn = '${functionObj.deadLetter.targetArn}'.  This is not a valid sns or sqs arn. `);
          }

          return BbPromise.resolve(targetArn);

        } else if (typeof targetArn === 'object') {

          if (!targetArn.GetResourceArn) {
            throw new Error(`Function property ${functionName}.deadLetter.targetArn object is missing GetResourceArn property.`);
          }

          const stackName = this.provider.naming.getStackName();

          this.serverless.cli.log(`Stackname: ${stackName}`);

          const params = {
            StackName: stackName,
            LogicalResourceId: targetArn.GetResourceArn
          };

          return this.provider.request('CloudFormation', 'describeStackResource',
            params, this.options.stage, this.options.region)
            .then((response) => {

              const resType = response.StackResourceDetail.ResourceType;
              switch (resType) {

                case 'AWS::SNS::Topic':
                  return BbPromise.resolve(response.StackResourceDetail.PhysicalResourceId);

                case 'AWS::SQS::Queue': {
                  const queueUrl = response.StackResourceDetail.PhysicalResourceId;
                  return BbPromise.resolve(Plugin.convertQueueUrlToArn(queueUrl));
                }
                default:
                  throw new Error(`Function property ${functionName}.deadLetter.targetArn.GetResourceArn ` +
                    `must be a queue or topic.  Resource not supported:  ${resType}`);

              }

            });

        }

        throw new Error(`Function property ${functionName}.deadLetter.targetArn is an unexpected type.  This must be an object or string.`);

      })
      .then(targetArnString =>
        BbPromise.resolve({
          FunctionName: functionObj.name,
          DeadLetterConfig: {
            TargetArn: targetArnString
          }
        })

      );
  }

  setLambdaDeadLetterConfig() {

    return BbPromise.mapSeries(this.serverless.service.getAllFunctions(), functionName =>
      this.buildDeadLetterUpdateParams(functionName)

      .then((deadLetterUpdateParams) => {

        if (!deadLetterUpdateParams) {
          return BbPromise.resolve();
        }

        return this.provider.request('Lambda', 'updateFunctionConfiguration',
          deadLetterUpdateParams, this.options.stage, this.options.region)
          .then(() => {

            const arnStr = deadLetterUpdateParams.DeadLetterConfig.TargetArn || '{none}';

            this.serverless.cli.log(`Function '${functionName}' ` +
              `DeadLetterConfig assigned TargetArn: '${arnStr}'`);

          });
      }));
  }

  static convertQueueUrlToArn(queueUrl) {

    const tokens = queueUrl.slice(8).split('/');
    const region = tokens[0].split('.')[1];
    const account = tokens[1];
    const queueName = tokens[2];

    return ['arn', 'aws', 'sqs', region, account, queueName].join(':');
  }

}

module.exports = Plugin;
