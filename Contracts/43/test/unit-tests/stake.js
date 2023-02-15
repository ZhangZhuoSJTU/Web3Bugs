
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {stake, deposit, getAll, mineBlocks, getOwner, getDeployedContract, getAllocatedTokensPerEpoch, getEndEpoch, getMaxCapMultiplier,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT} = require("../helpers");


describe("Staking", function () {

    it("Should revert when transfer not approved", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        await deposit(contract, (oneToken).mul(1000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        expect(contract.connect(validator1).stake(0, oneToken.mul(5))).to.revertedWith("ERC20: transfer amount exceeds allowance")
        expect(contract.connect(validator1).stake(0, oneToken)).to.revertedWith("ERC20: transfer amount exceeds allowance")
        expect(contract.connect(validator1).stake(0, oneToken.mul(500000))).to.revertedWith("ERC20: transfer amount exceeds allowance")
    });

    it("Should revert if exceeds max cap", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        await deposit(contract, (oneToken).mul(1000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        await expect(stake(oneToken, delegator1, cqtContract, contract, 0)).to.revertedWith("Validator max capacity exceeded")
        await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
        await expect(stake((oneToken.mul(10000)).add(1), delegator1, cqtContract, contract, 0)).to.revertedWith("Validator max capacity exceeded")
    });


    it("Should succeed when stakes filling max cap", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        await deposit(contract, (oneToken).mul(1000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
        await expect(stake((oneToken.mul(10000)), delegator1, cqtContract, contract, 0)).to.emit(contract, 'Staked').withArgs(0, DELEGATOR_1, oneToken.mul(10000).toString());

        await contract.addValidator(VALIDATOR_2, OPERATOR_2, 1000000000)
        await stake(oneToken.mul(1000), validator2, cqtContract, contract, 1)
        await expect(stake((oneToken.mul(2000)), delegator1, cqtContract, contract, 1)).to.emit(contract, 'Staked').withArgs(1, DELEGATOR_1, oneToken.mul(2000).toString());
        await expect(stake((oneToken.mul(8000)), validator1, cqtContract, contract, 1)).to.emit(contract, 'Staked').withArgs(1, VALIDATOR_1, oneToken.mul(8000).toString());
    });

    it("Should revert when stake by validator is less than minimum stake required", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        const required = oneToken.mul(100000)
        await contract.setValidatorMinStakedRequired(oneToken.mul(100000))
        await deposit(contract, (oneToken).mul(1000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        expect(stake(required.sub(1), validator1, cqtContract, contract, 0)).to.revertedWith("Amount < min staked required")
        expect(stake(oneToken, validator1, cqtContract, contract, 0)).to.revertedWith("Amount < min staked required")
      });

      it("Should revert when token is less than 1", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        await deposit(contract, (oneToken).mul(1000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        expect(stake(1, validator1, cqtContract, contract, 0)).to.revertedWith("Amount must be at least 1 token")
        expect(stake(100, validator1, cqtContract, contract, 0)).to.revertedWith("Amount must be at least 1 token")
        expect(stake(oneToken.sub(1), validator1, cqtContract, contract, 0)).to.revertedWith("Amount must be at least 1 token")
      });

    it("Should stake 1 token", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        await deposit(contract, (oneToken).mul(1000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        await stake(oneToken.mul(10000), validator1, cqtContract, contract, 0)
        expect(await stake(oneToken, delegator1, cqtContract, contract, 0)).to.emit(contract, 'Staked').withArgs(0, DELEGATOR_1, oneToken.toString());
      });

    it("Should change max cap when staked", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      await deposit(contract, (oneToken).mul(100000));

      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      const amount = oneToken.mul(1000);
      let delegated = ethers.BigNumber.from(0)
      let vDelegated = ethers.BigNumber.from(0)

      await stake(amount, validator1, cqtContract, contract, 0)
      vDelegated = vDelegated.add(amount)

      await mineBlocks(100);
      await stake(amount, delegator1, cqtContract, contract, 0)
      delegated = delegated.add(amount)

      await mineBlocks(100);
      await stake(amount, validator2, cqtContract, contract, 0)
      delegated = delegated.add(amount)

      await mineBlocks(100);
      await stake(amount, delegator1, cqtContract, contract, 0)
      delegated = delegated.add(amount)

      await mineBlocks(100);
      await stake(amount, delegator1, cqtContract, contract, 0)
      delegated = delegated.add(amount)

      await mineBlocks(100);
      await stake(amount, delegator1, cqtContract, contract, 0)
      delegated = delegated.add(amount)

      const vDetails = await contract.getValidatorsDetails()
      let dDetails = await contract.getDelegatorDetails(VALIDATOR_1)
      expect(vDetails.delegated[0].toString()).to.equal(delegated.toString());
      const multiplier = await getMaxCapMultiplier(contract);
      expect(dDetails.delegated[0].mul(multiplier).sub(vDetails.delegated[0]).toString()).to.equal(((vDelegated.mul(multiplier)).sub(delegated)).toString());
    });


    it("Should return correct delegated # ", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      await deposit(contract, (oneToken).mul(100000));

      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      const amount = oneToken.mul(1000);
      let delegated1 = ethers.BigNumber.from(0)
      let delegated2 = ethers.BigNumber.from(0)
      let vDelegated = ethers.BigNumber.from(0)

      await stake(amount, validator1, cqtContract, contract, 0)
      vDelegated = vDelegated.add(amount)
      await mineBlocks(100);
      await stake(amount, delegator1, cqtContract, contract, 0)
      delegated1 = delegated1.add(amount)

      await mineBlocks(100);
      await stake(amount, validator2, cqtContract, contract, 0)
      delegated2 = delegated2.add(amount)

      await mineBlocks(100);
      await stake(amount, delegator1, cqtContract, contract, 0)
      delegated1 = delegated1.add(amount)

      await mineBlocks(100);
      await stake(amount, delegator1, cqtContract, contract, 0)
      delegated1 = delegated1.add(amount)

      const vDetails = await contract.getDelegatorDetails(validator1.address)
      expect(vDetails.delegated[0].toString()).to.equal(vDelegated.toString());
      const d1Details = await contract.getDelegatorDetails(delegator1.address)
      expect(d1Details.delegated[0].toString()).to.equal(delegated1.toString());
      const d2Details = await contract.getDelegatorDetails(validator2.address)
      expect(d2Details.delegated[0].toString()).to.equal(delegated2.toString());
     });

  });
