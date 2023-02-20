const { expect } = require("chai");
const { ethers } = require("hardhat");

const {getAll, getDeployedContract, getValidatorsN, getMaxCapMultiplier,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT, deposit, stake} = require("../helpers");

describe("Set max cap multiplier", function () {
  it("Should change delegation available.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    deposit(contract, oneToken.mul(100000))
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    await stake(oneToken.mul(100000), validator1, cqtContract, contract, 0)
    const initialMultiplier = await getMaxCapMultiplier(contract)
    const details = await contract.getValidatorsDetails()
    let vdetails = await contract.getDelegatorDetails(VALIDATOR_1)
    vdetails =  ethers.BigNumber.from(vdetails.delegated[0]);

    const initDelegationAvailable = (vdetails.mul(initialMultiplier)).sub(details.delegated[0])
    const newMultiplier = initialMultiplier.mul(2)
    const expectedNewDelegationAvailable = initDelegationAvailable.mul(2)
    await contract.setMaxCapMultiplier(newMultiplier)
    const details_2 = await contract.getValidatorsDetails()
    let vdetails_2 = await contract.getDelegatorDetails(VALIDATOR_1)
    vdetails_2 =  ethers.BigNumber.from(vdetails_2.delegated[0]);
    const newDelegationAvailable = (vdetails_2.mul(newMultiplier)).sub(details_2.delegated[0])
    expect(newDelegationAvailable).to.equal(expectedNewDelegationAvailable)
  });

  it("Should change max cap multiplier.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    await contract.setMaxCapMultiplier(23)
    let newMultiplier = await getMaxCapMultiplier(contract)
    expect(newMultiplier).to.equal(23)

    await contract.setMaxCapMultiplier(10)
    newMultiplier = await getMaxCapMultiplier(contract)
    expect(newMultiplier).to.equal(10)

    await contract.setMaxCapMultiplier(2)
    newMultiplier = await getMaxCapMultiplier(contract)
    expect(newMultiplier).to.equal(2)

    await contract.setMaxCapMultiplier(1)
    newMultiplier = await getMaxCapMultiplier(contract)
    expect(newMultiplier).to.equal(1)
  });

  it("Should be able to stake more if multiplier increases.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    deposit(contract, oneToken.mul(100000))
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
    const initialMultiplier = await getMaxCapMultiplier(contract)
    const newMultiplier = initialMultiplier.add(5)
    await contract.setMaxCapMultiplier(newMultiplier)
    expect(await stake(oneToken.mul(1000).mul(newMultiplier), delegator1, cqtContract, contract, 0))
    .to.emit(contract, 'Staked').withArgs(0, DELEGATOR_1, oneToken.mul(1000).mul(newMultiplier).toString());
  });

  it("Should revert if set to 0.", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    const message = 'Must be greater than 0'
    await expect( contract.setMaxCapMultiplier(0)).to.revertedWith(message);
    await deposit(contract, oneToken.mul(100000))
    await expect( contract.setMaxCapMultiplier(0)).to.revertedWith(message);
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 10);
    await expect( contract.setMaxCapMultiplier(0)).to.revertedWith(message);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
    await expect( contract.setMaxCapMultiplier(0)).to.revertedWith(message);
  });

});