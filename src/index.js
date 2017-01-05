
class Plugin {

  constructor(serverless, options) {

    this.serverless = serverless;
    this.options = options;
    this.provider = serverless.getProvider('aws');

    this.hooks = {
       // 'deploy:compileEvents': this.compileLambdaDeadLetterResources.bind(this),
      'deploy:deploy': this.setLambdaDeadLetterConfig.bind(this),
      'setLambdaDeadLetterConfig:setLambdaDeadLetterConfig': this.setLambdaDeadLetterConfig.bind(this),
    };

    this.commands = {
      setLambdaDeadLetterConfig: {
        usage: 'Adds subscriptions to any SNS Topics defined by externalSNS.',
        lifecycleEvents: ['setLambdaDeadLetterConfig'],
      },
    };

  }

  setLambdaDeadLetterConfig() {

    this.serverless.service.getAllFunctions().forEach((functionName) => {

      const functionObj = this.serverless.service.getFunction(functionName);
      let targetArnString = '';

      this.serverless.cli.log(`** Function:  ${functionName}`);

      if (!functionObj.deadLetter) {
        return;
      }
      if (!functionObj.deadLetter.targetArn) {
        throw new Error(`Function: ${functionName} is missing 'targetArn' value.`);
      }

      if (typeof functionObj.deadLetter.targetArn === 'string') {
        const rg = new RegExp(
          '^(arn:aws:sqs:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_.]{1,80}$' +
          '|arn:aws:sns:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_]{1,256})$');


        if (!rg.test(functionObj.deadLetter.targetArn)) {
          throw new Error(`Function property ${functionName}.deadLetter.targetArn = '${functionObj.deadLetter.targetArn}'.  This is not a valid sns or sqs arn. `);
        }

        targetArnString = functionObj.deadLetter.targetArn;

      } else if (typeof functionObj.deadLetter.targetArn === 'object') {
        return;
      }

      this.serverless.cli.log(`** Function: ${functionName}, DeadLetterArn:  ${targetArnString}`);

    });
  }

}

module.exports = Plugin;
