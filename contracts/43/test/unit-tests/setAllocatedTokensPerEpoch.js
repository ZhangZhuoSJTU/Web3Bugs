const { expect } = require("chai");

const {getAll, getDeployedContract, getValidatorsN, getAllocatedTokensPerEpoch,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT, deposit, stake} = require("../helpers");

describe("Set allocated tokens per epoch", function () {
  it("Should change delegation available.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    await contract.setAllocatedTokensPerEpoch(1000)
    let allocatedTokensPerEpoch = await getAllocatedTokensPerEpoch(contract)
    expect(allocatedTokensPerEpoch).to.equal(1000)

    await contract.setAllocatedTokensPerEpoch(100)
    allocatedTokensPerEpoch = await getAllocatedTokensPerEpoch(contract)
    expect(allocatedTokensPerEpoch).to.equal(100)

    await contract.setAllocatedTokensPerEpoch(1)
    allocatedTokensPerEpoch = await getAllocatedTokensPerEpoch(contract)
    expect(allocatedTokensPerEpoch).to.equal(1)

    await contract.setAllocatedTokensPerEpoch(oneToken)
    allocatedTokensPerEpoch = await getAllocatedTokensPerEpoch(contract)
    expect(allocatedTokensPerEpoch).to.equal(oneToken)

    await contract.setAllocatedTokensPerEpoch(oneToken.mul(1000000))
    allocatedTokensPerEpoch = await getAllocatedTokensPerEpoch(contract)
    expect(allocatedTokensPerEpoch).to.equal(oneToken.mul(1000000))

  });

  it("Should revert if set to 0.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    let message = "Amount is 0"
    await expect( contract.setAllocatedTokensPerEpoch(0)).to.revertedWith(message);
    await deposit(contract, oneToken.mul(100000))
    await expect( contract.setAllocatedTokensPerEpoch(0)).to.revertedWith(message);
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    await expect( contract.setAllocatedTokensPerEpoch(0)).to.revertedWith(message);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
    await expect( contract.setAllocatedTokensPerEpoch(0)).to.revertedWith(message);
  });

});