'use strict';

const BbPromise = require('bluebird');

class Plugin {

  constructor(serverless, options) {

    this.serverless = serverless;
    this.options = options;
    this.provider = serverless.getProvider('aws');
    this.deploy = options.noDeploy === undefined ? true : !options.noDeploy;

    this.hooks = {

      'deploy:deploy': () => BbPromise.bind(this)
        .then(this.setLambdaDeadLetterConfig),

      'deploy:compileEvents': () => BbPromise.bind(this)
        .then(this.compileFunctionDeadLetterResources),


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

  resolveTargetArn(functionName, deadLetter, resolveStackResources) {

    let targetDefCount = 0;

    if (deadLetter.sqs !== undefined) targetDefCount += 1;
    if (deadLetter.sns !== undefined) targetDefCount += 1;
    if (deadLetter.targetArn !== undefined) targetDefCount += 1;

    if (targetDefCount === 0) {
      throw new Error(`Function: ${functionName}.deadLetter is missing one of the following properties: [sqs, sns, targetArn]`);
    }

    if (targetDefCount > 1) {
      throw new Error(`Function: ${functionName}.deadLetter can only have one of the following properties: [sqs, sns, targetArn]`);
    }

    if (deadLetter.sqs !== undefined) {
      return this.resolveTargetArnFromObject(functionName, {
        GetResourceArn: Plugin.GetLogicalIdForDlQueue(functionName)
      }, resolveStackResources);
    }

    if (deadLetter.sns !== undefined) {
      return this.resolveTargetArnFromObject(functionName, {
        GetResourceArn: Plugin.GetLogicalIdForDlTopic(functionName)
      }, resolveStackResources);
    }

    const targetArn = deadLetter.targetArn;
    if (targetArn === null) {

      return BbPromise.resolve('');

    } else if (typeof targetArn === 'string') {

      return this.resolveTargetArnFromString(functionName, targetArn);

    } else if (typeof targetArn === 'object') {

      return this.resolveTargetArnFromObject(functionName, targetArn, resolveStackResources);
    }

    throw new Error(`Function property ${functionName}.deadLetter.targetArn is an unexpected type.  This must be an object or string.`);

  }

  // eslint-disable-next-line class-methods-use-this
  resolveTargetArnFromString(functionName, targetArn) {

    if (targetArn.trim().length === 0) {
      return BbPromise.resolve('');
    }

    const rg = new RegExp(
      '^(arn:aws:sqs:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_.]{1,80}' +
      '|arn:aws:sns:[a-z]{2,}-[a-z]{2,}-[0-9]{1}:[0-9]{12}:[a-zA-z0-9\\-_]{1,256})$');


    if (!rg.test(targetArn)) {
      throw new Error(`Function property ${functionName}.deadLetter.targetArn = '${targetArn}'.  This is not a valid sns or sqs arn. `);
    }

    return BbPromise.resolve(targetArn);
  }

  resolveTargetArnFromObject(functionName, targetArn, resolveStackResources) {

    if (!targetArn.GetResourceArn) {
      throw new Error(`Function property ${functionName}.deadLetter.targetArn object is missing GetResourceArn property.`);
    }

    if (!resolveStackResources) {
      // If the stack has not been deployed this we cannot get the resource arn
      // from cloudformation yet so just return a display string (not a real arn).
      // This can be used when:
      //  a)  the --noDeploy option is set
      //  b)  before stack deployment when we want to run this for simple validations.
      return BbPromise.resolve(`\${GetResourceArn: ${targetArn.GetResourceArn}}`);
    }

    const stackName = this.provider.naming.getStackName();

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

  buildDeadLetterUpdateParams(functionName, resolveStackResources) {

    const functionObj = this.serverless.service.getFunction(functionName);

    if (!functionObj.deadLetter) {
      return BbPromise.resolve();
    }

    return BbPromise.bind(this)

      .then(() => this.resolveTargetArn(functionName, functionObj.deadLetter,
        resolveStackResources))

      .then(targetArnString => BbPromise.resolve({
        FunctionName: functionObj.name,
        DeadLetterConfig: {
          TargetArn: targetArnString
        }
      }));
  }

  setLambdaDeadLetterConfig() {

    return BbPromise.mapSeries(this.serverless.service.getAllFunctions(), functionName =>
      this.buildDeadLetterUpdateParams(functionName, this.deploy)

      .then((deadLetterUpdateParams) => {

        if (!deadLetterUpdateParams) {
          return BbPromise.resolve();
        }

        let logPrefix;
        let updateStep;

        if (this.deploy) {
          logPrefix = '(updated)';
          updateStep = this.provider.request('Lambda', 'updateFunctionConfiguration',
            deadLetterUpdateParams, this.options.stage, this.options.region);
        } else {
          logPrefix = '(noDeploy)';
          updateStep = BbPromise.resolve();
        }

        return updateStep.then(() => {

          const arnDisplayStr = deadLetterUpdateParams.DeadLetterConfig.TargetArn || '{none}';

          this.serverless.cli.log(`${logPrefix} Function '${functionName}' ` +
              `DeadLetterConfig.TargetArn: ${arnDisplayStr}`);
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

  validate(functionName) {
    return this.buildDeadLetterUpdateParams(functionName, false);
  }

  compileFunctionDeadLetterResources() {
    return BbPromise.mapSeries(this.serverless.service.getAllFunctions(), functionName =>

      BbPromise.resolve()
        .then(() => this.validate(functionName))
        .then(() => this.compileFunctionDeadLetterResource(functionName))

    );
  }

  compileFunctionDeadLetterResource(functionName) {
    const functionObj = this.serverless.service.getFunction(functionName);

    if (functionObj.deadLetter === undefined) {
      return BbPromise.resolve();
    }
    if (functionObj.deadLetter.sqs !== undefined) {
      return this.compileFunctionDeadLetterQueue(functionName,
        functionObj.deadLetter.sqs);
    }

    if (functionObj.deadLetter.sns !== undefined) {
      return this.compileFunctionDeadLetterTopic(functionName,
        functionObj.deadLetter.sns);
    }

    return BbPromise.resolve();

  }

  static normalize(s) {
    if (s === undefined || s === '') {
      return '';
    }

    return s[0].toUpperCase() + s.substr(1);
  }

  static GetLogicalIdForDlQueue(functionName) {
    return `${Plugin.normalize(functionName)}DeadLetterQueue`;
  }
  static GetLogicalIdForDlQueuePolicy(functionName) {
    return `${Plugin.normalize(functionName)}DeadLetterQueuePolicy`;
  }
  static GetLogicalIdForDlTopic(functionName) {
    return `${Plugin.normalize(functionName)}DeadLetterTopic`;
  }
  static GetLogicalIdForFunction(functionName) {
    return `${Plugin.normalize(functionName)}LambdaFunction`;
  }

  compileFunctionDeadLetterQueue(functionName, queueConfig) {

    if (typeof queueConfig !== 'string') {
      throw new Error(`Function property ${functionName}.deadLetter.sqs is an unexpected type.  This must be a or string.`);
    }

    const queueName = queueConfig;

    const functionLogicalId = Plugin.GetLogicalIdForFunction(functionName);
    const queueLogicalId = Plugin.GetLogicalIdForDlQueue(functionName);
    const queuePolicyLogicalId = Plugin.GetLogicalIdForDlQueuePolicy(functionName);
    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

    const queueResource = {
      Type: 'AWS::SQS::Queue',
      Properties: {
        QueueName: queueName
      }
    };

    const queuePolicyResource = {
      Type: 'AWS::SQS::QueuePolicy',
      Properties: {
        Queues: [{
          Ref: queueLogicalId
        }],
        PolicyDocument: {
          Id: { 'Fn::Join': ['', [{ 'Fn::GetAtt': [queueLogicalId, 'Arn'] }, '/SQSDefaultPolicy']] },
          Version: '2012-10-17',
          Statement: [{
            Sid: 'Allow-Lambda-SendMessage',
            Effect: 'Allow',
            Principal: { AWS: '*' },
            Action: ['SQS:SendMessage'],

            Resource: { 'Fn::GetAtt': [queueLogicalId, 'Arn'] },
            Condition: {
              ArnEquals: {
                'aws:SourceArn': {
                  'Fn::GetAtt': [functionLogicalId, 'Arn']
                }
              }
            }
          }]
        }
      }
    };

    resources[queueLogicalId] = queueResource;
    resources[queuePolicyLogicalId] = queuePolicyResource;
  }

  compileFunctionDeadLetterTopic(functionName, topicConfig) {

    if (typeof topicConfig !== 'string') {
      throw new Error(`Function property ${functionName}.deadLetter.sns is an unexpected type.  This must be a or string.`);
    }

    const topicName = topicConfig;

    const topicLogicalId = Plugin.GetLogicalIdForDlTopic(functionName);
    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

    const topicResource = {
      Type: 'AWS::SNS::Topic',
      Properties: {
        TopicName: topicName
      }
    };
    resources[topicLogicalId] = topicResource;
  }

}

module.exports = Plugin;
