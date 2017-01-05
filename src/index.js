
const BbPromise = require('bluebird');

class Plugin {

  constructor(serverless, options) {

    this.serverless = serverless;
    this.options = options;
    this.provider = serverless.getProvider('aws');

    this.hooks = {
       // 'deploy:compileEvents': this.compileLambdaDeadLetterResources.bind(this),
      'deploy:deploy': this.setLambdaDeadLetterConfig.bind(this),
      'setLambdaDeadLetterConfig:setLambdaDeadLetterConfig': this.setLambdaDeadLetterConfig.bind(this)
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
    if (!functionObj.deadLetter.targetArn) {
      throw new Error(`Function: ${functionName} is missing 'targetArn' value.`);
    }
    const targetArn = functionObj.deadLetter.targetArn;

    return BbPromise.bind(this)
      .then(() => {

        if (typeof targetArn === 'string') {
          const rg = new RegExp(
            '^(arn:aws:sqs:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_.]{1,80}' +
            '|arn:aws:sns:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_]{1,256})$');


          if (!rg.test(targetArn)) {
            throw new Error(`Function property ${functionName}.deadLetter.targetArn = '${functionObj.deadLetter.targetArn}'.  This is not a valid sns or sqs arn. `);
          }

          return BbPromise.resolve(targetArn);

        } else if (typeof targetArn === 'object') {

          if (!targetArn.GetArn) {
            throw new Error(`Function property ${functionName}.deadLetter.targetArn object is missing GetArn property.`);
          }
          // let dlLogicalId = targetArn.GetArn;

          // TODO:  Check that dlLogicalId is a valid resource in the stack
          // TODO:  Attempt to get the ARN of the resource identified by dlLogicalId
          // targetArnString ...
          return BbPromise.resolve();
        }

        throw new Error(`Function property ${functionName}.deadLetter.targetArn is an unexpected type.  This must be an object or string.`);

      })
      .then((targetArnString) => {

        this.serverless.cli.log(`** Function: ${functionName}, DeadLetterArn:  ${targetArnString}`);

        return BbPromise.resolve({
          FunctionName: functionObj.name,
          DeadLetterConfig: {
            TargetArn: targetArnString
          }
        });

      });
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
            this.serverless.cli.log(`Function '${functionName}' DeadLetterConfig assigned.`);
          });
      }));
  }

}

module.exports = Plugin;
