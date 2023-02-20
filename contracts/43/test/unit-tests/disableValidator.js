const { expect } = require("chai");

const {getAll, getDeployedContract,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT, deposit, stake, mineBlocks} = require("../helpers");

describe("Disable validator", function () {
  it("Should not be able to call stake after validator got disabled by the owner.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    deposit(contract, oneToken.mul(100000))
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    await stake(oneToken.mul(1000000), validator1, cqtContract, contract, 0)
    mineBlocks(10)
    await contract.disableValidator(0)
    expect(stake(oneToken.mul(1000000), validator1, cqtContract, contract, 0)).to.revertedWith("Validator is disabled")
    expect(stake(oneToken.mul(1000000), delegator1, cqtContract, contract, 0)).to.revertedWith("Validator is disabled")
  });

  it("Should revert with invalid validator id when owner calls.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    expect(contract.disableValidator(5)).to.revertedWith("Invalid validator")
    expect(contract.disableValidator(1)).to.revertedWith("Invalid validator")
  });

  it("Should revert when non validator or non owner calls.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    await contract.addValidator(VALIDATOR_2, OPERATOR_2, 40);
    expect(contract.connect(validator2).disableValidator(5)).to.revertedWith("Caller is not owner or validator")
    expect(contract.connect(validator2).disableValidator(0)).to.revertedWith("Caller is not owner or validator")
    expect(contract.connect(validator2).disableValidator(2)).to.revertedWith("Caller is not owner or validator")

    expect(contract.connect(delegator1).disableValidator(5)).to.revertedWith("Caller is not owner or validator")
    expect(contract.connect(delegator1).disableValidator(0)).to.revertedWith("Caller is not owner or validator")
    expect(contract.connect(delegator1).disableValidator(1)).to.revertedWith("Caller is not owner or validator")

    expect(contract.connect(delegator2).disableValidator(5)).to.revertedWith("Caller is not owner or validator")
    expect(contract.connect(delegator2).disableValidator(0)).to.revertedWith("Caller is not owner or validator")
    expect(contract.connect(delegator2).disableValidator(1)).to.revertedWith("Caller is not owner or validator")
    });

    it("Should revert when disabling validator twice", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      deposit(contract, (oneToken).mul(100000));
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      const amount = oneToken.mul(1000);
      await stake(amount, validator1, cqtContract, contract, 0)
      await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0)
      await mineBlocks(100);
      await contract.disableValidator(0)
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      let amountIn = oneToken.mul(7000)
      await expect( contract.disableValidator(0)).to.revertedWith("Validator is already disabled")
    });


});