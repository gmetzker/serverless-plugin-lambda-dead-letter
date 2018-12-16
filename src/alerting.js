const BbPromise = require('bluebird');

/*
    TODO:
    - resolve names (i.e. topic/queue) and services (i.e. sns/sqs) from targetArn
    - standard alerting config for sns
    - standard alerting config for sqs
    - allow possibility for customization
         => overwrite AWS::CloudWatch::Alaram Properties keys, if specified
 */

 /**
 * clean up .requirements and .requirements.zip and unzip_requirements.py
 * @return {Promise}
 */
function cloudwatchSNSAlarmTemplate(functionName) {
  const template = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      AlarmName: `[Error] ${functionName}-SNS-DLQ`,
      AlarmDescription: `At least one message was sent to the dead-letter topic of the function "${functionName}"`,
      MetricName: 'NumberOfMessagesPublished',
      Namespace: 'AWS/SNS',
      Statistic: 'Sum',
      Period: 60,
      EvaluationPeriods: 1,
      Threshold: 1,
      Dimensions: null,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      ActionsEnabled: true,
      TreatMissingData: 'notBreaching',
      AlarmActions: null
    } };

  return template;
}

/**
 * clean up .requirements and .requirements.zip and unzip_requirements.py
 * @return {Promise}
 */
function cloudwatchSQSAlarmTemplate(functionName) {
  const template = {
    Type: 'AWS::CloudWatch::Alarm',
    Properties: {
      AlarmName: `[Error] ${functionName}-SQS-DLQ`,
      AlarmDescription: `At least one message was sent to the dead-letter queue of the function "${functionName}"`,
      MetricName: 'NumberOfMessagesSent',
      Namespace: 'AWS/SQS',
      Statistic: 'Sum',
      Period: 60,
      EvaluationPeriods: 1,
      Threshold: 1,
      Dimensions: null,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      ActionsEnabled: true,
      TreatMissingData: 'notBreaching',
      AlarmActions: null
    }
  };

  return template;

}

/**
 * clean up .requirements and .requirements.zip and unzip_requirements.py
 * @return {Promise}
 */
function compileCloudwatchAlarmTemplates(functionName, functionObj) {
  const deadLetter = functionObj.deadLetter;

  if (!deadLetter.alarm.enabled) {
    return BbPromise.resolve();
  }
  if (!deadLetter.alarm.alertingTopic) {
    throw new Error(`Must define ${functionName}.deadLetter.alarm.alertingTopic.`);
  }

  let alarmActions;

  if (Array.isArray(deadLetter.alarm.alertingTopic)) {
    alarmActions = deadLetter.alarm.alertingTopic;
  } else {
    alarmActions = [deadLetter.alarm.alertingTopic];
  }

  const templates = {};

  if ('sqs' in deadLetter) {
    const sqsAlarmTemplate = cloudwatchSQSAlarmTemplate(functionObj.name);
    sqsAlarmTemplate.Properties.AlarmActions = alarmActions;
    templates.sqs = sqsAlarmTemplate;

    if (typeof deadLetter.alarm.sqs === 'object' && deadLetter.alarm.sqs !== null) {
      Object.keys(deadLetter.alarm.sqs).forEach((key) => {
        templates.sqs.Properties[key] = deadLetter.alarm.sqs[key];
      });
    }
  }

  if ('sns' in deadLetter) {
    const snsAlarmTemplate = cloudwatchSNSAlarmTemplate(functionObj.name);
    snsAlarmTemplate.Properties.AlarmActions = alarmActions;
    templates.sns = snsAlarmTemplate;

    if (typeof deadLetter.alarm.sns === 'object' && deadLetter.alarm.sns !== null) {
      Object.keys(deadLetter.alarm.sns).forEach((key) => {
        templates.sns.Properties[key] = deadLetter.alarm.sns[key];
      });
    }
  }

  /*
  if ('targetArn' in deadLetter) {
    templates.sqs = cloudwatchSNSAlarmTemplate();
  }
  */

  return templates;
}

function snsAlarmDimensions(resourceLogicalId) {
  return [{
    Name: 'TopicName',
    Value: `!GetAtt ${resourceLogicalId}.TopicName`
  }];
}

function sqsAlarmDimensions(resourceLogicalId) {
  return [{
    Name: 'QueueName',
    Value: `!GetAtt ${resourceLogicalId}.QueueName`
  }];
}

module.exports = { compileCloudwatchAlarmTemplates,
  compileCloudwatchSQSAlarm: cloudwatchSQSAlarmTemplate,
  compileCloudwatchSNSAlarm: cloudwatchSNSAlarmTemplate,
  snsAlarmDimensions,
  sqsAlarmDimensions };
