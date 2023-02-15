const { expect } = require("chai");

const {getAll, getDeployedContract,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT} = require("../helpers");

describe("Ownership", function () {
  it("Should return owner address same as signer.", async function () {
    const contract = await getDeployedContract();
    expect(await contract.owner()).to.equal(OWNER);
  });

  it("Should not access depositRewards, takeOutRewardTokens, addValidator, disableValidator, setAllocatedTokensPerEpoch by not owner.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    const ownableMessage = 'Ownable: caller is not the owner';
    await expect(contract.connect(validator1).depositRewardTokens(100)).to.be.revertedWith(ownableMessage);
    await expect(contract.connect(validator1).takeOutRewardTokens(100)).to.be.revertedWith(ownableMessage);
    await expect(contract.connect(validator1).addValidator(VALIDATOR_1, OPERATOR_1, 10)).to.be.revertedWith(ownableMessage);
    await expect(contract.connect(validator1).setAllocatedTokensPerEpoch(2)).to.be.revertedWith(ownableMessage);
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    await expect(contract.connect(validator2).disableValidator(2)).to.be.revertedWith('Caller is not owner or validator');
  });

  it("Should access depositRewardTokens, takeOutRewardTokens, addValidator, disabledValidator by owner.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    const depositAmount = oneToken.mul(100)
    await cqtContract.approve(contract.address, depositAmount);
    expect(await contract.depositRewardTokens(depositAmount)).to.emit(contract, 'RewardTokensDeposited').withArgs(depositAmount.toString());
    expect(await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10)).to.emit(contract, 'ValidatorAdded').withArgs(0, VALIDATOR_1, OPERATOR_1);
    expect(await contract.disableValidator(0)).to.emit(contract, 'ValidatorDisabled').withArgs(0);
    expect(await contract.takeOutRewardTokens(10)).to.emit(contract, 'AllocatedTokensTaken').withArgs(10);
    await expect(contract.connect(validator1).disableValidator(0)).to.emit(contract, 'ValidatorDisabled')
  });

  it("Should not access transfer, updateExchangeRate, updateValidator, sharesToTokens, tokensToShares.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    expect(() => contract.transfer(1, VALIDATOR_1, DELEGATOR_2)).to.throw("contract.transfer is not a function");
    expect(() => contract.updateExchangeRate()).to.throw("contract.updateExchangeRate is not a function");
    expect(() => contract.updateValidator(1, VALIDATOR_1, DELEGATOR_2)).to.throw("contract.updateValidator is not a function");
    expect(() => contract.sharesToTokens(1, 2)).to.throw("contract.sharesToTokens is not a function");
    expect(() => contract.tokensToShares(1, 2)).to.throw("contract.tokensToShares is not a function");
  });

});