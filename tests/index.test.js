'use strict';

const expect = require('expect.js');
const Plugin = require('../src/index.js');
const sinon = require('sinon');
const BbPromise = require('bluebird');

describe('serverless-plugin-lambda-dead-letter', () => {


  function createMockServerless(requestFunc) {

    const provider = {
      request: requestFunc,
      naming: {
        getStackName: () => 'MyCoolStack'
      }
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
        getAllFunctions: () => [],
        getFunction: () => null

      },
      cli: { log: () => {
      } }
      // cli: {
      //   log: (val) => {
      //     process.stdout.write(`${val} \n`);
      //   } }
    };

    return serverless;

  }

  function createMockRequest(requestStub) {

    return () => {

      const reqArgs = Array.prototype.slice.call(arguments);
      return new BbPromise((resolve, reject) => {
        const result = requestStub.apply(undefined, reqArgs);
        if (result !== null) {
          resolve(result);
          return;
        }
        reject(new Error(`Call to request() with unexpected arguments:  ${JSON.stringify(reqArgs)}`));

      });
    };


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
        expect(stubBuildDeadLetterUpdateParams.firstCall.calledWithExactly('f1', true)).to.be(true);
        expect(stubBuildDeadLetterUpdateParams.secondCall.calledWithExactly('f2', true)).to.be(true);
        expect(stubBuildDeadLetterUpdateParams.thirdCall.calledWithExactly('f3', true)).to.be(true);

        expect(stubRequestFunc.callCount).to.be(2);

        expect(stubRequestFunc.withArgs('Lambda', 'updateFunctionConfiguration',
          dlF1, stage, region).calledOnce);

        expect(stubRequestFunc.withArgs('Lambda', 'updateFunctionConfiguration',
          dlF3, stage, region).calledOnce);

      });

    });

    it('does not call updateFunctionConfiguration if noDeploy option set', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

      sinon.stub(mockServerless.service, 'getAllFunctions', () => ['f1', 'f2', 'f3']);
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const options = { stage, region, noDeploy: true };
      const plugin = new Plugin(mockServerless, options);

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
        expect(stubBuildDeadLetterUpdateParams.firstCall.calledWithExactly('f1', false)).to.be(true);
        expect(stubBuildDeadLetterUpdateParams.secondCall.calledWithExactly('f2', false)).to.be(true);
        expect(stubBuildDeadLetterUpdateParams.thirdCall.calledWithExactly('f3', false)).to.be(true);

        expect(stubRequestFunc.callCount).to.be(0);

      });

    });
  });

  describe('buildDeadLetterUpdateParams', () => {

    const dynamicTests = [
      { resolveStackResources: true },
      { resolveStackResources: false }
    ];

    it('can return nothing when deadLetter object is missing', () => {
      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';
      const logicalFuncName = 'F1Cool';
      const actualFuncName = 'f1-cool';
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

      const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
      stubGetFunction.withArgs(logicalFuncName).returns({ name: actualFuncName });


      const plugin = new Plugin(mockServerless, { stage, region });

      const stubresolveTargetArn = sinon.stub(plugin, 'resolveTargetArn', () => BbPromise.resolve());

      // ACT:
      const actual = plugin.buildDeadLetterUpdateParams(logicalFuncName, true);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then((targetArnString) => {

        expect(stubresolveTargetArn.callCount).to.be(0);
        expect(targetArnString).to.be(undefined);

      });

    });

    dynamicTests.forEach((test) => {

      it(`can call resolveTargetArn and return params when targetArn is present when resolveStackResources = ${test.resolveStackResources}`, () => {
        // ARRANGE:

        const stage = 'test1';
        const region = 'us-west-42';
        const logicalFuncName = 'F1Cool';
        const actualFuncName = 'f1-cool';
        const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

        const mockTargetArn = { someKey: 'someVal' };
        const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
        stubGetFunction.withArgs(logicalFuncName).returns({
          name: actualFuncName,
          deadLetter: {
            targetArn: mockTargetArn
          }
        });


        const plugin = new Plugin(mockServerless, { stage, region });

        const resolvedTargetArnStr = 'some-arn';
        const stubresolveTargetArn = sinon.stub(plugin, 'resolveTargetArn', () => BbPromise.resolve(resolvedTargetArnStr));

        // ACT:
        const actual = plugin.buildDeadLetterUpdateParams(logicalFuncName,
          test.resolveStackResources);

        // ASSERT:
        expect(isPromise(actual)).to.be(true);

        return actual.then((actualParams) => {

          expect(stubresolveTargetArn.callCount).to.be(1);
          expect(stubresolveTargetArn.withArgs(logicalFuncName, { targetArn: mockTargetArn },
            test.resolveStackResources).calledOnce).to.be(true);

          expect(actualParams).to.eql({
            FunctionName: actualFuncName,
            DeadLetterConfig: {
              TargetArn: resolvedTargetArnStr
            }
          });

        });
      });

      it(`can return params with empty targetArn when resolveStackResources = ${test.resolveStackResources}`, () => {
        // ARRANGE:

        const stage = 'test1';
        const region = 'us-west-42';
        const logicalFuncName = 'F1Cool';
        const actualFuncName = 'f1-cool';
        const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

        const mockTargetArn = '';
        const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
        stubGetFunction.withArgs(logicalFuncName).returns({
          name: actualFuncName,
          deadLetter: {
            targetArn: mockTargetArn
          }
        });


        const plugin = new Plugin(mockServerless, { stage, region });

        const stubresolveTargetArn = sinon.stub(plugin, 'resolveTargetArn', () => BbPromise.resolve(''));

        // ACT:
        const actual = plugin.buildDeadLetterUpdateParams(logicalFuncName,
          test.resolveStackResources);

        // ASSERT:
        expect(isPromise(actual)).to.be(true);

        return actual.then((actualParams) => {

          expect(stubresolveTargetArn.callCount).to.be(1);
          expect(stubresolveTargetArn.withArgs(logicalFuncName, { targetArn: mockTargetArn },
            test.resolveStackResources).calledOnce).to.be(true);

          expect(actualParams).to.eql({
            FunctionName: actualFuncName,
            DeadLetterConfig: {
              TargetArn: ''
            }
          });

        });
      });

    });

    it('will bubble exception if resolveTargetArn throws an exception', () => {
      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';
      const logicalFuncName = 'F1Cool';
      const actualFuncName = 'f1-cool';
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

      const mockTargetArn = '';
      const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
      stubGetFunction.withArgs(logicalFuncName).returns({
        name: actualFuncName,
        deadLetter: {
          targetArn: mockTargetArn
        }
      });


      const plugin = new Plugin(mockServerless, { stage, region });

      const stubresolveTargetArn = sinon.stub(plugin, 'resolveTargetArn');
      stubresolveTargetArn.throws(new Error('fail'));

      // ACT:
      const actual = plugin.buildDeadLetterUpdateParams(logicalFuncName);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      // Make sure we caught an exception.
      return actual
        .then(() => {
          // Acceptance case, we should not get here.
          expect().fail('exception did not appear to be thrown');
        }, (e) => {
          // Failure case, we should get here.
          expect(e.message).to.equal('fail');
        });

    });
  });

  describe('resolveTargetArn', () => {

    const dynamicTests = [
      { resolveStackResources: true },
      { resolveStackResources: false }
    ];

    it('can throw an exception when all deadLetter targets are undefined', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { });


      // ACT:
      const act = () => plugin.resolveTargetArn('f1', { }, true);

      // ASSERT:
      expect(act).throwException();


    });

    it('can throw an exception when deadLetter targetArn and sqs are defined', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { });


      // ACT:
      const act = () => plugin.resolveTargetArn('f1', {
        targetArn: 'arn::something',
        sqs: 'somequeue'
      }, true);

      // ASSERT:
      expect(act).throwException();


    });

    it('can throw an exception when deadLetter targetArn and sns are defined', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { });


      // ACT:
      const act = () => plugin.resolveTargetArn('f1', {
        targetArn: 'arn::something',
        sns: 'sometopic'
      }, true);

      // ASSERT:
      expect(act).throwException();


    });

    it('can throw an exception when deadLetter sqs and sns are defined', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { });


      // ACT:
      const act = () => plugin.resolveTargetArn('f1', {
        sqs: 'somequeue',
        sns: 'sometopic'
      }, true);

      // ASSERT:
      expect(act).throwException();


    });

    dynamicTests.forEach((test) => {

      it(`can call resolveTargetArnFromObject if sqs is supplied when resolveStackResources = ${test.resolveStackResources}`, () => {

        // ARRANGE:
        const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
        const plugin = new Plugin(mockServerless, { });

        const stubResolveTargetArnFromString = sinon.stub(plugin, 'resolveTargetArnFromString', () => BbPromise.resolve());
        const stubResolveTargetArnFromObject = sinon.stub(plugin, 'resolveTargetArnFromObject', () => BbPromise.resolve('arn:cool'));


        // ACT:
        const actual = plugin.resolveTargetArn('f1', { sqs: 'myQueue' }, test.resolveStackResources);

        // ASSERT:
        expect(isPromise(actual)).to.be(true);

        return actual.then((arnString) => {

          expect(arnString).to.be('arn:cool');

          expect(stubResolveTargetArnFromObject.callCount).to.be(1);
          expect(stubResolveTargetArnFromObject.calledWithExactly('f1', {
            GetResourceArn: 'F1DeadLetterQueue'
          }, test.resolveStackResources)).to.be(true);

          expect(stubResolveTargetArnFromString.callCount).to.be.eql(0);


        });

      });

      it(`can call resolveTargetArnFromObject if sns is supplied when resolveStackResources = ${test.resolveStackResources}`, () => {

        // ARRANGE:
        const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
        const plugin = new Plugin(mockServerless, { });

        const stubResolveTargetArnFromString = sinon.stub(plugin, 'resolveTargetArnFromString', () => BbPromise.resolve());
        const stubResolveTargetArnFromObject = sinon.stub(plugin, 'resolveTargetArnFromObject', () => BbPromise.resolve('arn:cool'));


        // ACT:
        const actual = plugin.resolveTargetArn('f1', { sns: 'myTopic' }, test.resolveStackResources);

        // ASSERT:
        expect(isPromise(actual)).to.be(true);

        return actual.then((arnString) => {

          expect(arnString).to.be('arn:cool');

          expect(stubResolveTargetArnFromObject.callCount).to.be(1);
          expect(stubResolveTargetArnFromObject.calledWithExactly('f1', {
            GetResourceArn: 'F1DeadLetterTopic'
          }, test.resolveStackResources)).to.be(true);

          expect(stubResolveTargetArnFromString.callCount).to.be.eql(0);


        });

      });

      it(`can call resolveTargetArnFromObject if targetArn is an object when resolveStackResources = ${test.resolveStackResources}`, () => {

        // ARRANGE:
        const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
        const plugin = new Plugin(mockServerless, { });

        const stubResolveTargetArnFromString = sinon.stub(plugin, 'resolveTargetArnFromString', () => BbPromise.resolve());
        const stubResolveTargetArnFromObject = sinon.stub(plugin, 'resolveTargetArnFromObject', () => BbPromise.resolve('arn:cool'));

        const fakeArnObj = { k1: 'v1' };

        // ACT:
        const actual = plugin.resolveTargetArn('f1', { targetArn: fakeArnObj }, test.resolveStackResources);

        // ASSERT:
        expect(isPromise(actual)).to.be(true);

        return actual.then((arnString) => {

          expect(arnString).to.be('arn:cool');

          expect(stubResolveTargetArnFromObject.callCount).to.be(1);
          expect(stubResolveTargetArnFromObject.calledWithExactly('f1', fakeArnObj, test.resolveStackResources)).to.be(true);

          expect(stubResolveTargetArnFromString.callCount).to.be.eql(0);


        });

      });
    });


    it('can return empty string if targetArn is null', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { });

      const stubResolveTargetArnFromString = sinon.stub(plugin, 'resolveTargetArnFromString', () => BbPromise.resolve());
      const stubResolveTargetArnFromObject = sinon.stub(plugin, 'resolveTargetArnFromObject', () => BbPromise.resolve());


      // ACT:
      const actual = plugin.resolveTargetArn('f1', { targetArn: null }, true);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then((arnString) => {
        expect(arnString).to.be.empty();

        expect(stubResolveTargetArnFromString.callCount).to.be.eql(0);
        expect(stubResolveTargetArnFromObject.callCount).to.be.eql(0);


      });

    });

    it('can call resolveTargetArnFromString if targetArn is a non empty string', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { });

      const stubResolveTargetArnFromString = sinon.stub(plugin, 'resolveTargetArnFromString', () => BbPromise.resolve('arn:bob'));
      const stubResolveTargetArnFromObject = sinon.stub(plugin, 'resolveTargetArnFromObject', () => BbPromise.resolve());


      // ACT:
      const actual = plugin.resolveTargetArn('f1', { targetArn: 'bob' }, true);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then((arnString) => {

        expect(arnString).to.be('arn:bob');

        expect(stubResolveTargetArnFromString.callCount).to.be(1);
        expect(stubResolveTargetArnFromString.calledWithExactly('f1', 'bob')).to.be(true);

        expect(stubResolveTargetArnFromObject.callCount).to.be.eql(0);


      });

    });

    it('can call resolveTargetArnFromString if targetArn is an empty string', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { });

      const stubResolveTargetArnFromString = sinon.stub(plugin, 'resolveTargetArnFromString', () => BbPromise.resolve(''));
      const stubResolveTargetArnFromObject = sinon.stub(plugin, 'resolveTargetArnFromObject', () => BbPromise.resolve());


      // ACT:
      const actual = plugin.resolveTargetArn('f1', { targetArn: '' }, true);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then((arnString) => {

        expect(arnString).to.be.empty();

        expect(stubResolveTargetArnFromString.callCount).to.be(1);
        expect(stubResolveTargetArnFromString.calledWithExactly('f1', '')).to.be(true);

        expect(stubResolveTargetArnFromObject.callCount).to.be.eql(0);


      });

    });

    it('can throw an exception when targetArn is neither an object nor a string', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { });

      const stubResolveTargetArnFromString = sinon.stub(plugin, 'resolveTargetArnFromString', () => BbPromise.resolve());
      const stubResolveTargetArnFromObject = sinon.stub(plugin, 'resolveTargetArnFromObject', () => BbPromise.resolve());

      // ACT:
      const act = () => plugin.resolveTargetArn('f1', { targetArn: 123 }, true);

      // ASSERT:
      expect(act).to.throwException((e) => {
        expect(e.message).to.contain('is an unexpected type.  This must be an object or string');
      });

      expect(stubResolveTargetArnFromString.callCount).to.be.eql(0);
      expect(stubResolveTargetArnFromObject.callCount).to.be.eql(0);
    });


  });

  describe('resolveTargetArnString', () => {

    it('can return empty string when targetArn is empty', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { });

      // ACT:
      const actual = plugin.resolveTargetArnFromString('f1', '');

      // ASSERT:
      return actual.then((targetArnString) => {
        expect(targetArnString).to.be.empty();
        expect(stubRequestFunc.callCount).to.be(0);

      });

    });

    it('can return empty string when targetArn is whitespace', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { });

      // ACT:
      const actual = plugin.resolveTargetArnFromString('f1', '   ');

      // ASSERT:
      return actual.then((targetArnString) => {
        expect(targetArnString).to.be.empty();
        expect(stubRequestFunc.callCount).to.be(0);

      });

    });

    it('can throw exception if targetArn is not an SNS or SQS arn', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { });

      // ACT:
      const act = () => plugin.resolveTargetArnFromString('f1', 'something-bad');

      // ASSERT:

      expect(act).to.throwException();
      expect(stubRequestFunc.callCount).to.be(0);

    });

    it('can return the same string if targetArn is an SNS arn', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { });
      const snsArn = 'arn:aws:sns:us-west-2:123456789012:f1-dlt';

      // ACT:
      const actual = plugin.resolveTargetArnFromString('f1', snsArn);

      // ASSERT:

      expect(isPromise(actual)).to.be(true);
      return actual.then((resultArn) => {

        expect(resultArn).to.be(snsArn);
        expect(stubRequestFunc.callCount).to.be(0);
      });


    });

    it('can return the same string if targetArn is an SQS arn', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { });
      const sqsArn = 'arn:aws:sqs:us-west-2:123456789012:f1-dlq.fifo';

      // ACT:
      const actual = plugin.resolveTargetArnFromString('f1', sqsArn);

      // ASSERT:

      expect(isPromise(actual)).to.be(true);
      return actual.then((resultArn) => {

        expect(resultArn).to.be(sqsArn);
        expect(stubRequestFunc.callCount).to.be(0);
      });


    });

  });

  describe('resolveTargetArnFromObject', () => {

    it('can throw an exception when GetResourceArn property not present', () => {

      // ARRANGE:
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { });

      // ACT:
      const act = () => plugin.resolveTargetArnFromObject('f1', {}, true);

      // ASSERT:

      expect(act).to.throwException();
      expect(stubRequestFunc.callCount).to.be(0);

    });

    it('can throw an exception when resource is not a Topic or Queue ', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';
      const stackName = 'MyCoolStack';
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve({
        StackResourceDetail: { ResourceType: 'AWS::SNS::Other' }
      }));


      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      const actual = plugin.resolveTargetArnFromObject('f1', { GetResourceArn: 'DingBat' }, true);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {
        expect.fail('no exception thrown');
      }, (e) => {
        expect(e.message).to.contain('must be a queue or topic');

        expect(stubRequestFunc.callCount).to.be(1);
        expect(stubRequestFunc.calledWithExactly(
          'CloudFormation', 'describeStackResource', {
            StackName: stackName,
            LogicalResourceId: 'DingBat'
          }, stage, region));

      });


    });

    it('can return topic arn when resource is Topic', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';
      const stackName = 'MyCoolStack';
      const topicArn = 'arn:aws:sns:us-west-2:123456789012:my-topic';
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve({
        StackResourceDetail: {
          ResourceType: 'AWS::SNS::Topic',
          PhysicalResourceId: topicArn
        }
      }));


      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      const actual = plugin.resolveTargetArnFromObject('f1', { GetResourceArn: 'DingBat' }, true);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then((targetArnString) => {
        expect(targetArnString).to.be(topicArn);
        expect(stubRequestFunc.callCount).to.be(1);
        expect(stubRequestFunc.calledWithExactly(
          'CloudFormation', 'describeStackResource', {
            StackName: stackName,
            LogicalResourceId: 'DingBat'
          }, stage, region));

      });


    });

    it('can return topic arn when resource is Queue', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';
      const stackName = 'MyCoolStack';
      const queueArn = 'arn:aws:sqs:us-west-2:123456789012:my-queue';
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve({
        StackResourceDetail: {
          ResourceType: 'AWS::SQS::Queue',
          PhysicalResourceId: 'https://sqs.us-west-2.amazonaws.com/123456789012/my-queue'
        }
      }));


      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      const actual = plugin.resolveTargetArnFromObject('f1', { GetResourceArn: 'DingBat' }, true);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then((targetArnString) => {
        expect(targetArnString).to.be(queueArn);
        expect(stubRequestFunc.callCount).to.be(1);
        expect(stubRequestFunc.calledWithExactly(
          'CloudFormation', 'describeStackResource', {
            StackName: stackName,
            LogicalResourceId: 'DingBat'
          }, stage, region));

      });


    });

    it('will not describeStackResource when resolveStackResources is false', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';
      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());


      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      const logicalResourceId = 'DingBat';
      const actual = plugin.resolveTargetArnFromObject('f1', { GetResourceArn: logicalResourceId }, false);

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then((targetArnString) => {

        expect(targetArnString).to.be(`\${GetResourceArn: ${logicalResourceId}}`);
        expect(stubRequestFunc.callCount).to.be(0);

      });


    });


  });

  describe('compileFunctionDeadLetterResources', () => {

    it('does nothing if no functions are defined', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { stage, region });

      const stubCompileFunctionDeadLetterQueue = sinon.stub(plugin, 'compileFunctionDeadLetterQueue', () => BbPromise.resolve());


      // ACT:
      const actual = plugin.compileFunctionDeadLetterResources();

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubCompileFunctionDeadLetterQueue.callCount).to.be(0);
        expect(stubRequestFunc.callCount).to.be(0);

      });

    });

    it('calls compileFunctionDeadLetterResource after validate success', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

      const stubGetAllFunctions = sinon.stub(mockServerless.service, 'getAllFunctions', () => ['f1', 'f2']);

      const plugin = new Plugin(mockServerless, { stage, region });

      const stubValidate = sinon.stub(plugin, 'validate', () => BbPromise.resolve());
      const stubCompile = sinon.stub(plugin, 'compileFunctionDeadLetterResource', () => BbPromise.resolve());


      // ACT:
      const actual = plugin.compileFunctionDeadLetterResources();

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubGetAllFunctions.callCount).to.be(1);
        expect(stubValidate.firstCall.calledWithExactly('f1')).to.be(true);
        expect(stubCompile.firstCall.calledWithExactly('f1')).to.be(true);

        expect(stubValidate.secondCall.calledWithExactly('f2')).to.be(true);
        expect(stubCompile.secondCall.calledWithExactly('f2')).to.be(true);

      });

    });

    it('does not call compileFunctionDeadLetterResource after validate fails', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

      const stubGetAllFunctions = sinon.stub(mockServerless.service, 'getAllFunctions', () => ['f1', 'f2']);

      const plugin = new Plugin(mockServerless, { stage, region });

      const stubValidate = sinon.stub(plugin, 'validate', () => BbPromise.reject());
      const stubCompile = sinon.stub(plugin, 'compileFunctionDeadLetterResource', () => BbPromise.resolve());


      // ACT:
      const actual = plugin.compileFunctionDeadLetterResources();

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {
        expect().fail('exception did not appear to be thrown');
      }, () => {
        // Failure case, we should get here.

        expect(stubGetAllFunctions.callCount).to.be(1);

        expect(stubValidate.callCount).to.be(1);
        expect(stubValidate.calledWithExactly('f1')).to.be(true);

        expect(stubCompile.callCount).to.be(0);

      });

    });

  });

  describe('compileFunctionDeadLetterResource', () => {

    it('does not call compile resources if deadLetter.targetArn is defined', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));


      const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
      stubGetFunction.withArgs('f2').returns({ name: 'f2', deadLetter: { targetArn: 'arn:something' } });


      const plugin = new Plugin(mockServerless, { stage, region });

      const stubCompileFunctionDeadLetterQueue = sinon.stub(plugin, 'compileFunctionDeadLetterQueue');
      const stubCompileFunctionDeadLetterTopic = sinon.stub(plugin, 'compileFunctionDeadLetterTopic');

      // ACT:
      const actual = plugin.compileFunctionDeadLetterResource('f2');

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubGetFunction.callCount).to.be(1);
        expect(stubGetFunction.calledWithExactly('f2')).to.be(true);
        expect(stubCompileFunctionDeadLetterQueue.callCount).to.be(0);
        expect(stubCompileFunctionDeadLetterTopic.callCount).to.be(0);

      });

    });

    it('does not call compile resources if deadLetter is undefined', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));


      const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
      stubGetFunction.withArgs('f2').returns({ name: 'f2' });


      const plugin = new Plugin(mockServerless, { stage, region });

      const stubCompileFunctionDeadLetterQueue = sinon.stub(plugin, 'compileFunctionDeadLetterQueue');
      const stubCompileFunctionDeadLetterTopic = sinon.stub(plugin, 'compileFunctionDeadLetterTopic');

      // ACT:
      const actual = plugin.compileFunctionDeadLetterResource('f2');

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubGetFunction.callCount).to.be(1);
        expect(stubGetFunction.calledWithExactly('f2')).to.be(true);
        expect(stubCompileFunctionDeadLetterQueue.callCount).to.be(0);
        expect(stubCompileFunctionDeadLetterTopic.callCount).to.be(0);

      });

    });

    it('does not call compile resources if deadLetter is null', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));


      const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
      stubGetFunction.withArgs('f2').returns({ name: 'f2', deadLetter: null });


      const plugin = new Plugin(mockServerless, { stage, region });

      const stubCompileFunctionDeadLetterQueue = sinon.stub(plugin, 'compileFunctionDeadLetterQueue');
      const stubCompileFunctionDeadLetterTopic = sinon.stub(plugin, 'compileFunctionDeadLetterTopic');

      // ACT:
      const actual = plugin.compileFunctionDeadLetterResource('f2');

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubGetFunction.callCount).to.be(1);
        expect(stubGetFunction.calledWithExactly('f2')).to.be(true);
        expect(stubCompileFunctionDeadLetterQueue.callCount).to.be(0);
        expect(stubCompileFunctionDeadLetterTopic.callCount).to.be(0);

      });

    });

    it('calls compileFunctionDeadLetterQueue if deadLetter.sqs is defined', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

      const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
      stubGetFunction.withArgs('f1').returns({ name: 'f1', deadLetter: { sqs: 'myqueue1' } });


      const plugin = new Plugin(mockServerless, { stage, region });

      const stubCompileFunctionDeadLetterQueue = sinon.stub(plugin, 'compileFunctionDeadLetterQueue');
      stubCompileFunctionDeadLetterQueue.returns(BbPromise.resolve());
      const stubCompileFunctionDeadLetterTopic = sinon.stub(plugin, 'compileFunctionDeadLetterTopic');

      // ACT:
      const actual = plugin.compileFunctionDeadLetterResource('f1');

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubGetFunction.callCount).to.be(1);
        expect(stubGetFunction.calledWithExactly('f1')).to.be(true);
        expect(stubCompileFunctionDeadLetterQueue.callCount).to.be(1);
        expect(stubCompileFunctionDeadLetterQueue.calledWithExactly('f1', 'myqueue1')).to.be(true);

        expect(stubCompileFunctionDeadLetterTopic.callCount).to.be(0);

      });

    });

    it('calls compileFunctionDeadLetterTopic if deadLetter.sns is defined', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));

      const stubGetFunction = sinon.stub(mockServerless.service, 'getFunction');
      stubGetFunction.withArgs('f1').returns({ name: 'f1', deadLetter: { sns: 'mytopic1' } });
      stubGetFunction.withArgs('f2').returns({ name: 'f2', deadLetter: { sns: 'mytopic2' } });


      const plugin = new Plugin(mockServerless, { stage, region });

      const stubCompileFunctionDeadLetterQueue = sinon.stub(plugin, 'compileFunctionDeadLetterQueue');
      stubCompileFunctionDeadLetterQueue.returns(BbPromise.resolve());
      const stubCompileFunctionDeadLetterTopic = sinon.stub(plugin, 'compileFunctionDeadLetterTopic');
      stubCompileFunctionDeadLetterTopic.returns(BbPromise.resolve());

      // ACT:
      const actual = plugin.compileFunctionDeadLetterResource('f2');

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubGetFunction.callCount).to.be(1);
        expect(stubGetFunction.calledWithExactly('f2')).to.be(true);

        expect(stubCompileFunctionDeadLetterTopic.callCount).to.be(1);
        expect(stubCompileFunctionDeadLetterTopic.firstCall.calledWithExactly('f2', 'mytopic2')).to.be(true);

        expect(stubCompileFunctionDeadLetterQueue.callCount).to.be(0);

      });

    });

  });

  describe('compileFunctionDeadLetterQueue', () => {
    it('throws an error of deadLetter.sqs is not a string', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      const act = () => plugin.compileFunctionDeadLetterQueue('f1', { });

      // ASSERT:
      expect(act).throwException((e) => {
        expect(e.message).to.contain('deadLetter.sqs is an unexpected type.  This must be a or string.');
      });

    });

    const sqsStringValues = [null, '', '  '];

    sqsStringValues.forEach((sqsValue) => {

      it(`throws an error when deadLetter.sqs is '${sqsValue}' i.e. empty`, () => {

        // ARRANGE:
        const stage = 'test1';
        const region = 'us-west-42';

        const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
        const plugin = new Plugin(mockServerless, { stage, region });

        // ACT:
        const act = () => plugin.compileFunctionDeadLetterQueue('f1', sqsValue);

        // ASSERT:
        expect(act).throwException((e) => {
          expect(e.message).to.contain('deadLetter.sqs must contain one or more characters');
        });

      });

    });
    it('assigns SQS resource', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      plugin.compileFunctionDeadLetterQueue('f1', 'MySqs');

      // ASSERT:
      const resources = mockServerless.service.provider.compiledCloudFormationTemplate.Resources;

      expect(resources).to.have.key('F1DeadLetterQueue');
      expect(resources.F1DeadLetterQueue).to.eql({
        Type: 'AWS::SQS::Queue',
        Properties: {
          QueueName: 'MySqs'
        }
      });
    });

    it('assigns SQS Policy resource', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      plugin.compileFunctionDeadLetterQueue('f1', 'MySqs');

      // ASSERT:
      const resources = mockServerless.service.provider.compiledCloudFormationTemplate.Resources;

      expect(resources).to.have.key('F1DeadLetterQueuePolicy');
      expect(resources.F1DeadLetterQueuePolicy).to.eql({
        Type: 'AWS::SQS::QueuePolicy',
        Properties: {
          Queues: [{
            Ref: 'F1DeadLetterQueue'
          }],
          PolicyDocument: {
            Id: { 'Fn::Join': ['', [{ 'Fn::GetAtt': ['F1DeadLetterQueue', 'Arn'] }, '/SQSDefaultPolicy']] },
            Version: '2012-10-17',
            Statement: [{
              Sid: 'Allow-Lambda-SendMessage',
              Effect: 'Allow',
              Principal: { AWS: '*' },
              Action: ['SQS:SendMessage'],

              Resource: { 'Fn::GetAtt': ['F1DeadLetterQueue', 'Arn'] },
              Condition: {
                ArnEquals: {
                  'aws:SourceArn': {
                    'Fn::GetAtt': ['F1LambdaFunction', 'Arn']
                  }
                }
              }
            }]
          }
        }
      });

    });

  });

  describe('compileFunctionDeadLetterTopic', () => {

    it('throws an error of deadLetter.sns is not a string', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      const act = () => plugin.compileFunctionDeadLetterTopic('f1', { });

      // ASSERT:
      expect(act).throwException((e) => {
        expect(e.message).to.contain('deadLetter.sns is an unexpected type.  This must be a or string.');
      });

    });

    const snsStringValues = [null, '', '  '];

    snsStringValues.forEach((snsValue) => {

      it(`throws an error when deadLetter.ns is '${snsValue}' i.e. empty`, () => {

        // ARRANGE:
        const stage = 'test1';
        const region = 'us-west-42';

        const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
        const plugin = new Plugin(mockServerless, { stage, region });

        // ACT:
        const act = () => plugin.compileFunctionDeadLetterTopic('f1', snsValue);

        // ASSERT:
        expect(act).throwException((e) => {
          expect(e.message).to.contain('deadLetter.sns must contain one or more characters');
        });

      });
    });

    it('assigns SNS resource', () => {

      // ARRANGE:
      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const plugin = new Plugin(mockServerless, { stage, region });

      // ACT:
      plugin.compileFunctionDeadLetterTopic('f1', 'MySns');

      // ASSERT:
      const resources = mockServerless.service.provider.compiledCloudFormationTemplate.Resources;

      expect(resources).to.have.key('F1DeadLetterTopic');
      expect(resources.F1DeadLetterTopic).to.eql({
        Type: 'AWS::SNS::Topic',
        Properties: {
          TopicName: 'MySns'
        }
      });
    });
  });

  describe('validate', () => {

    it('should call buildDeadLetterUpdateParams with resolveStackResources = false', () => {

      // ARRANGE:

      const stage = 'test1';
      const region = 'us-west-42';

      const mockServerless = createMockServerless(createMockRequest(sinon.stub()));
      const stubRequestFunc = sinon.stub(mockServerless.getProvider('aws'), 'request', () => BbPromise.resolve());

      const plugin = new Plugin(mockServerless, { stage, region });
      const stubBuildDeadLetterUpdateParams = sinon.stub(plugin, 'buildDeadLetterUpdateParams', () => BbPromise.resolve());


      // ACT:
      const actual = plugin.validate('f1');

      // ASSERT:
      expect(isPromise(actual)).to.be(true);

      return actual.then(() => {

        expect(stubBuildDeadLetterUpdateParams.callCount).to.be(1);
        expect(stubBuildDeadLetterUpdateParams.calledWithExactly('f1', false)).to.be(true);
        expect(stubRequestFunc.callCount).to.be(0);

      });

    });
  });

});
