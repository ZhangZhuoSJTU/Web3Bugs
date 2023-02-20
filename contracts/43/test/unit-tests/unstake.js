
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {stake, deposit, getAll, mineBlocks, getOwner, getDeployedContract, getAllocatedTokensPerEpoch, getEndEpoch, getMaxCapMultiplier,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT} = require("../helpers");

describe("Unstaking", function () {

   it("Should revert when unstake is more than staked", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        await deposit(contract, (oneToken).mul(100000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        expect(contract.connect(delegator1).unstake(0, (oneToken))).to.revertedWith("Staked < amount provided")
        await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
        expect(contract.connect(delegator1).unstake(0, (oneToken.mul(11)))).to.revertedWith("Staked < amount provided")
        await stake(oneToken.mul(1000), delegator1, cqtContract, contract, 0)
        expect(contract.connect(delegator1).unstake(0, (oneToken.mul(1001)))).to.revertedWith("Staked < amount provided")
        expect(contract.connect(delegator1).unstake(0, (oneToken.mul(100000)))).to.revertedWith("Staked < amount provided")
        expect(contract.connect(delegator1).unstake(0, (oneToken.mul(1000)).add(1))).to.revertedWith("Staked < amount provided")
   });

   it("Should revert when unstake is too small", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        await deposit(contract, (oneToken).mul(100000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
        await stake(oneToken.mul(1000), delegator1, cqtContract, contract, 0)
        expect(contract.connect(delegator1).unstake(0, 1)).to.revertedWith("Unstake amount is too small")

    });

    it("Should revert when unstake by validator is below max cap", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        await deposit(contract, (oneToken).mul(100000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0)
        await stake(oneToken.mul(10000), delegator1, cqtContract, contract, 0)
        expect(contract.connect(validator1).unstake(0, oneToken)).to.revertedWith("Cannot unstake beyond max cap")
        expect(contract.connect(validator1).unstake(0, 10)).to.revertedWith("Cannot unstake beyond max cap")

        await contract.addValidator(VALIDATOR_2, OPERATOR_2, 1000000000000)
        await stake(oneToken.mul(1000), validator2, cqtContract, contract, 1)
        await stake(oneToken.mul(1000), delegator1, cqtContract, contract, 1)
        expect(contract.connect(validator2).unstake(1, oneToken.mul(901))).to.revertedWith("Cannot unstake beyond max cap")
        expect(contract.connect(validator2).unstake(1, (oneToken.mul(900)).add(1))).to.revertedWith("Cannot unstake beyond max cap")
    });


    it("Should revert when unstake by validator turns stake into less than minimum staked required", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        const required = oneToken.mul(1000)
        await contract.setValidatorMinStakedRequired(oneToken.mul(1000))
        await deposit(contract, (oneToken).mul(100000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        expect(await stake(required, validator1, cqtContract, contract, 0)).to.emit(contract, 'Staked').withArgs(0, VALIDATOR_1, required.toString());

        expect(contract.connect(validator1).unstake(0, oneToken)).to.revertedWith("Unstake > min staked required")
        expect(contract.connect(validator1).unstake(0, 10)).to.revertedWith("Unstake > min staked required")
    });

    it("Should emit event when unstaked successfully", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      const required = oneToken.mul(10000)
      await contract.setValidatorMinStakedRequired(oneToken.mul(100))
      await deposit(contract, (oneToken).mul(100000));
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      await stake(required, validator1, cqtContract, contract, 0)
      expect(await contract.connect(validator1).unstake(0, oneToken.mul(900))).to.emit(contract, 'Unstaked').withArgs(0, VALIDATOR_1, oneToken.mul(900).toString());
  });

  });
