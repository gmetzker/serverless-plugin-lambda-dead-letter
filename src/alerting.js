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
function compileCloudwatchSQSAlarm(serverless, alert) {
  serverless.cli.log(alert);
  return BbPromise.resolve();
}

module.exports = { compileCloudwatchSQSAlarm };
