
const { expect } = require("chai");
const { ethers } = require("hardhat");

const {stake, deposit, getAll, mineBlocks, getOwner, getDeployedContract, getAllocatedTokensPerEpoch, getEndEpoch, getMaxCapMultiplier,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT} = require("../helpers");

describe("Transfer Unstaked", function () {

    it("Should transfer out after cool down ends, delegator", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      deposit(contract, (oneToken).mul(1000));
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      const amount = oneToken.mul(1000);
      await stake(amount, validator1, cqtContract, contract, 0)
      await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0)
      await mineBlocks(100);
      await contract.disableValidator(0)
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      await stake(amount, validator1, cqtContract, contract, 1)
      let amountIn = oneToken.mul(7000)
      await contract.connect(delegator1).unstake(0, amountIn)
      await mineBlocks(100)
      expect(await contract.connect(delegator1).redelegateUnstaked(amountIn, 0, 1, 0)).to.emit(contract,"TransferredUnstake").withArgs(0, 1, delegator1.address, amountIn.toString(), 0)
    });

    it("Should redelegate partially", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      deposit(contract, (oneToken).mul(1000));
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      const amount = oneToken.mul(1000);
      await stake(amount, validator1, cqtContract, contract, 0)
      await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0)
      await mineBlocks(100);
      await contract.disableValidator(0)
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      await stake(amount, validator1, cqtContract, contract, 1)

      let amountIn = oneToken.mul(7000)
      await contract.connect(delegator1).unstake(0, amountIn)

      expect(await contract.connect(delegator1).redelegateUnstaked(amountIn.sub(oneToken.mul(1)), 0, 1, 0)).to.emit(contract, "TransferredUnstake").withArgs(0, 1,  delegator1.address, amountIn.sub(oneToken.mul(1)).toString(), 0)
      await mineBlocks(100)
      expect(await contract.connect(delegator1).redelegateUnstaked(oneToken.mul(1), 0, 1, 0)).to.emit(contract, "TransferredUnstake").withArgs(0, 1, delegator1.address,oneToken.mul(1).toString(), 0)
 });


    it("Should revert when redelegating with enabled validator", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      deposit(contract, (oneToken).mul(1000));
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      const amount = oneToken.mul(1000);
      await stake(amount, validator1, cqtContract, contract, 0)
      await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0)
      await mineBlocks(100);
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      await stake(amount, validator1, cqtContract, contract, 1)
      let amountIn = oneToken.mul(7000)
      await contract.connect(delegator1).unstake(0, amountIn)
      await expect( contract.connect(delegator1).redelegateUnstaked(amountIn, 0, 1, 0)).to.revertedWith("Validator is not disabled")
   });

   it("Should revert when validators attempt to redelegate", async function () {
    const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
    deposit(contract, (oneToken).mul(1000));
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
    const amount = oneToken.mul(1000);
    await stake(amount, validator1, cqtContract, contract, 0)
    await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0)
    await mineBlocks(100);
    await contract.disableValidator(0)
    await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
    let amountIn = oneToken.mul(7000)
    await stake(amount, validator1, cqtContract, contract, 1)
    await contract.connect(delegator1).unstake(0, amountIn)
    await expect( contract.connect(validator1).redelegateUnstaked(amountIn, 0, 1, 0)).to.revertedWith("Validator cannot redelegate")
 });

 it("Should revert when redelegate greater than unstaked", async function () {
  const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
  deposit(contract, (oneToken).mul(1000));
  await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
  const amount = oneToken.mul(1000);
  await stake(amount, validator1, cqtContract, contract, 0)
  await stake(oneToken.mul(8000), delegator1, cqtContract, contract, 0)
  await mineBlocks(100);
  await contract.disableValidator(0)
  await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
  let amountIn = oneToken.mul(7000)
  await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
  await stake(amount, validator1, cqtContract, contract, 1)
  await contract.connect(delegator1).unstake(0, amountIn)
  await expect( contract.connect(delegator1).redelegateUnstaked(amountIn.add(1), 0, 1, 0)).to.revertedWith("Unstaking has less tokens")
});


})
