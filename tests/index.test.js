

const expect = require('expect.js');
const Plugin = require('../src/index.js');
const sinon = require('sinon');
const BbPromise = require('bluebird');

describe('serverless-plugin-lambda-dead-letter', () => {


  function createMockServerless(requestFunc) {

    const provider = {
      request: requestFunc
    };

    const serverless = {
      getProvider: (providerName) => {

        if (providerName !== 'aws') {
          return null;
        }

        return provider;
      },
      service: {
        provider: {
          compiledCloudFormationTemplate: {
            Resources: {}
          }
        },
        getAllFunctions: () => []

      },
      cli: { log: () => {
      } }
       // cli: { log: function(val) {
       //    process.stdout.write(val + '\n');
       // } }
    };

    return serverless;

  }

  function createMockRequest(requestStub) {

    return (...reqArgs) =>

      new BbPromise((resolve, reject) => {
        const result = requestStub(...reqArgs);
        if (result !== null) {
          resolve(result);
          return;
        }
        reject(new Error(`Call to request() with unexpected arguments:  ${JSON.stringify(reqArgs)}`));

      });


  }

  function isPromise(obj) {
    return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
  }

  function createUpdateParams(functionName, targetArn) {
    return {
      FunctionName: functionName,
      DeadLetterConfig: {
        TargetArn: targetArn
      }
    };
  }

  describe('constructor', () => {

    it('can assign properties', () => {

      // ARRANGE:
      const serverlessStub = {
        getProvider: sinon.stub()
      };
      const provider = { kother: 'v' };
      const options = { k: 'v' };

      serverlessStub.getProvider.withArgs('aws').returns(provider);

      // ACT:
      const plugin = new Plugin(serverlessStub, options);

      // ASSERT:
      expect(plugin.options).to.be(options);
      expect(plugin.serverless).to.be(serverlessStub);
      expect(plugin.provider).to.be(provider);

      expect(serverlessStub.getProvider.calledOnce).to.be(true);
      expect(serverlessStub.getProvider.calledWithExactly('aws')).to.be(true);
    });

  });

  describe('setLambdaDeadLetterConfig', () => {

    it('does nothing if no functions are defined', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { stage, region });

      const stubBuildDeadLetterUpdateParams = sinon.stub(plugin, 'buildDeadLetterUpdateParams', () => BbPromise.resolve());


      // ACT:
      const actual = plugin.setLambdaDeadLetterConfig();

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubBuildDeadLetterUpdateParams.callCount).to.be(0);
        expect(stubRequestFunc.callCount).to.be(0);

      });

    });

    it('calls updateFunctionConfiguration for all functions that have a DeadLetter target', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

      sinon.stub(mockServerless.service, 'getAllFunctions', () => ['f1', 'f2', 'f3']);
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { stage, region });

      const stubBuildDeadLetterUpdateParams = sinon.stub(plugin, 'buildDeadLetterUpdateParams');

      const dlF1 = createUpdateParams('f1', 'arn:aws:sns:us-west-2:123456789012:f1-dlt');
      const dlF2 = null;
      const dlF3 = createUpdateParams('f3', 'arn:aws:sqs:us-west-2:123456789012:f3-dlq');

      stubBuildDeadLetterUpdateParams.withArgs('f1').returns(BbPromise.resolve(dlF1));
      stubBuildDeadLetterUpdateParams.withArgs('f2').returns(BbPromise.resolve(dlF2));
      stubBuildDeadLetterUpdateParams.withArgs('f3').returns(BbPromise.resolve(dlF3));


      // ACT:
      const actual = plugin.setLambdaDeadLetterConfig();

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubBuildDeadLetterUpdateParams.callCount).to.be(3);
        expect(stubBuildDeadLetterUpdateParams.firstCall.args[0]).to.be('f1');
        expect(stubBuildDeadLetterUpdateParams.secondCall.args[0]).to.be('f2');
        expect(stubBuildDeadLetterUpdateParams.thirdCall.args[0]).to.be('f3');

        expect(stubRequestFunc.callCount).to.be(2);

        expect(stubRequestFunc.withArgs('Lambda', 'updateFunctionConfiguration',
          dlF1, stage, region).calledOnce);

        expect(stubRequestFunc.withArgs('Lambda', 'updateFunctionConfiguration',
          dlF3, stage, region).calledOnce);

      });

    });
  });

});
