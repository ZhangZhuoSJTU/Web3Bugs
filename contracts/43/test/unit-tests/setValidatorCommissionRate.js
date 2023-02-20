const { expect } = require("chai");

const {getAll, getDeployedContract, getValidatorsN, getMaxCapMultiplier,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT, deposit, stake} = require("../helpers");

describe("Set validator commission rate", function () {
  it("Should change validator commission rate.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    deposit(contract, oneToken.mul(100000))
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);

    await contract.setValidatorCommissionRate(50000000, 0)
    let details_2 = await contract.getValidatorsDetails()
    let newCommissionRate = details_2.commissionRates[0]
    expect(newCommissionRate).to.equal(50000000);

    await contract.setValidatorCommissionRate(1000000, 0)
    details_2 = await contract.getValidatorsDetails()
    newCommissionRate = details_2.commissionRates[0]
    expect(newCommissionRate).to.equal(1000000);

    await contract.setValidatorCommissionRate(1, 0)
    details_2 = await contract.getValidatorsDetails()
    newCommissionRate = details_2.commissionRates[0]

    expect(newCommissionRate).to.equal(1);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)

  });

  it("Should revert if set to >= 10^18.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    const message = 'Rate must be less than 100%'
    await expect( contract.setValidatorCommissionRate(oneToken, 0)).to.revertedWith(message);
    await expect( contract.setValidatorCommissionRate(oneToken.add(1), 0)).to.revertedWith(message);
    await expect( contract.setValidatorCommissionRate(oneToken.mul(1000000), 0)).to.revertedWith(message);
    await deposit(contract, oneToken.mul(100000))
    await expect( contract.setValidatorCommissionRate(oneToken, 0)).to.revertedWith(message);
    await expect( contract.setValidatorCommissionRate(oneToken.add(1), 0)).to.revertedWith(message);
    await expect( contract.setValidatorCommissionRate(oneToken.mul(1000000), 0)).to.revertedWith(message);
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    await expect( contract.setValidatorCommissionRate(oneToken, 0)).to.revertedWith(message);
    await expect( contract.setValidatorCommissionRate(oneToken.add(1), 0)).to.revertedWith(message);
    await expect( contract.setValidatorCommissionRate(oneToken.mul(1000000), 0)).to.revertedWith(message);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
    await expect( contract.setValidatorCommissionRate(oneToken, 0)).to.revertedWith(message);
    await expect( contract.setValidatorCommissionRate(oneToken.add(1), 0)).to.revertedWith(message);
    await expect( contract.setValidatorCommissionRate(oneToken.mul(1000000), 0)).to.revertedWith(message);
  });

})