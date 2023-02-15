const Ethereum = require('./utils/EtheUtil');
const m = require('mocha-logger');

const Delegate = artifacts.require("Delegate");
const Delegator = artifacts.require("Delegator");

let delegate;
let delegator;

contract("Delegator", async accounts => {

  before(async () => {
    // runs once before the first test in this block
    delegate = await Delegate.new();
    delegator = await Delegator.new(delegate.address);
  });

  it("Delegation test", async () => {

    m.log("delegateOwner", await delegate.owner());
    m.log("delegatorOwner", await delegator.owner());
    await delegator.changeOwner(accounts[3]);
    m.log("change********************accounts[3]");
    m.log("delegateOwner", await delegate.owner());
    m.log("delegatorOwner", await delegator.owner());
    m.log("change********************accounts[4]");
    let changeOwner = await web3.eth.abi.encodeFunctionCall({
      name: 'changeOwner',
      type: 'function',
      inputs: [{
        type: 'address',
        name: 'newOwner'
      }]
    }, [accounts[4]]);
    await delegator.delegateToImplementation(changeOwner);
    m.log("delegateOwner", await delegate.owner());
    m.log("delegatorOwner", await delegator.owner());
    let owner = await web3.eth.abi.encodeFunctionCall({
      name: 'owner',
      type: 'function',
      inputs: []
    }, []);
    m.log("delegateToImplementation->owner", '0x' + (await delegator.delegateToViewImplementation(owner)).substring(26));
    assert.equal(web3.utils.toChecksumAddress('0x' + (await delegator.delegateToViewImplementation(owner)).substring(26)), web3.utils.toChecksumAddress(await delegator.owner()));
    assert.equal('0x0000000000000000000000000000000000000000', await delegate.owner());
    m.log("delegator.implementation()", await delegator.implementation());


    let setDelegatePrivateParam = await web3.eth.abi.encodeFunctionCall({
      name: 'setDelegatePrivateParam',
      type: 'function',
      inputs: [{
        type: 'uint256',
        name: 'delegatePrivateParam_'
      }]
    }, [2]);
    await delegator.delegateToImplementation(setDelegatePrivateParam);

    m.log("delegator set delegatePrivateParam", (await delegate.delegatePrivateParam()).toString());

    assert.equal('100', (await delegate.delegatePrivateParam()).toString());

    await delegate.setDelegatePrivateParam(4);

    m.log("self set delegatePrivateParam", (await delegate.delegatePrivateParam()).toString());
    assert.equal('4', (await delegate.delegatePrivateParam()).toString());


    let delegatePrivateParam = await web3.eth.abi.encodeFunctionCall({
      name: 'delegatePrivateParam',
      type: 'function',
      inputs: []
    }, []);
    m.log("delegator delegateToViewImplementation delegatePrivateParam", await delegator.delegateToViewImplementation(delegatePrivateParam));
    assert.equal('0x0000000000000000000000000000000000000000000000000000000000000002', await delegator.delegateToViewImplementation(delegatePrivateParam));

    let delegatePrivateConstant = await web3.eth.abi.encodeFunctionCall({
      name: 'delegatePrivateConstant',
      type: 'function',
      inputs: []
    }, []);
    m.log("delegator delegateToViewImplementation delegatePrivateConstant", await delegator.delegateToViewImplementation(delegatePrivateConstant));
    assert.equal('0x0000000000000000000000000000000000000000000000000000000000000001', await delegator.delegateToViewImplementation(delegatePrivateConstant));

  })
})
