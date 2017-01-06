

const expect = require('expect.js');
const Plugin = require('../src/index.js');
const sinon = require('sinon');

describe('serverless-plugin-lambda-dead-letter', () => {

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

});
