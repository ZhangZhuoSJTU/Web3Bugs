const { expect } = require("chai");

const {getAll, getDeployedContract, getValidatorsN,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT, deposit, stake} = require("../helpers");

describe("Add Validator", function () {
  it("Should change validators number.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    //deposit(contract, oneToken.mul(100000))
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    let validatorsN = await getValidatorsN(contract);
    expect(validatorsN).to.equal(1)
    await contract.addValidator(VALIDATOR_2, OPERATOR_2, 20);
    await contract.addValidator(DELEGATOR_2, OPERATOR_1, 20);
    validatorsN = await getValidatorsN(contract);
    expect(validatorsN).to.equal(3)

  });


  it("Should add validator with correct commission rate.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    //deposit(contract, oneToken.mul(100000))
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    let details = await contract.getValidatorsDetails();
    expect(details.commissionRates[0]).to.equal(10)
    await contract.addValidator(VALIDATOR_2, OPERATOR_2, 120000);
    await contract.addValidator(DELEGATOR_2, DELEGATOR_1, 5000000);
    details = await contract.getValidatorsDetails();
    expect(details.commissionRates[1]).to.equal(120000)
    expect(details.commissionRates[2]).to.equal(5000000)
  });


});