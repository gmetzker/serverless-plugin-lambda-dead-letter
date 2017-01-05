
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

  setLambdaDeadLetterConfig() {

    // TODO:  Rework t his to wait until all promics are complete.
    this.serverless.service.getAllFunctions().forEach((functionName) => {

      const functionObj = this.serverless.service.getFunction(functionName);
      let targetArnString;


      this.serverless.cli.log(`** Function:  ${functionName}`);

      if (!functionObj.deadLetter) {
        return;
      }
      if (!functionObj.deadLetter.targetArn) {
        throw new Error(`Function: ${functionName} is missing 'targetArn' value.`);
      }
      const targetArn = functionObj.deadLetter.targetArn;

      if (typeof targetArn === 'string') {
        const rg = new RegExp(
          '^(arn:aws:sqs:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_.]{1,80}$' +
          '|arn:aws:sns:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_]{1,256})$');


        if (!rg.test(targetArn)) {
          throw new Error(`Function property ${functionName}.deadLetter.targetArn = '${functionObj.deadLetter.targetArn}'.  This is not a valid sns or sqs arn. `);
        }

        targetArnString = targetArn;

      } else if (typeof targetArn === 'object') {

        if (!targetArn.GetArn) {
          throw new Error(`Function property ${functionName}.deadLetter.targetArn object is missing GetArn property.`);
        }
        // let dlLogicalId = targetArn.GetArn;

        // TODO:  Check that dlLogicalId is a valid resource in the stack
        // TODO:  Attempt to get the ARN of the resource identified by dlLogicalId
        // targetArnString ...
      }

      this.serverless.cli.log(`** Function: ${functionName}, DeadLetterArn:  ${targetArnString}`);

      const params = {
        FunctionName: functionObj.name,
        DeadLetterConfig: {
          TargetArn: targetArnString
        }
      };

      return this.provider.request('Lambda', 'updateFunctionConfiguration', params, this.options.stage, this.options.region)
             .then(() => {
               this.serverless.cli.log(`Function '${functionName}' DeadLetterConfig assigned.`);
             });

    });
  }

}

module.exports = Plugin;
