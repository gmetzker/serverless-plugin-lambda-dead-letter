const BbPromise = require('bluebird');


/**
 * clean up .requirements and .requirements.zip and unzip_requirements.py
 * @return {Promise}
 */
function compileCloudwatchAlarm(deadLetter) {
  return BbPromise.all(
        [1, 2, 3].map(a =>
            a + 1
        )
    );
}

module.exports = { compileCloudwatchAlarm };
