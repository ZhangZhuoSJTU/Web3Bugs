
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {stake, deposit, getAll, mineBlocks, getOwner, getDeployedContract, getAllocatedTokensPerEpoch, getEndEpoch, getMaxCapMultiplier,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT} = require("../helpers");

describe("Recover Unstaking", function () {

    it("Should revert when recover greater than staking", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        const required = oneToken.mul(10000)
        await deposit(contract, (oneToken).mul(100000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        await stake(required, validator1, cqtContract, contract, 0)
        await contract.connect(validator1).unstake(0, oneToken.mul(900))
        expect(contract.connect(validator1).recoverUnstaking(oneToken.mul(1000), 0, 0)).to.revertedWith("Unstaking has less tokens")
     });

    it("Should emit event when recovered unstake successfully", async function () {
        const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
        const required = oneToken.mul(100000)
        await deposit(contract, (oneToken).mul(10000));
        await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
        await stake(required, validator1, cqtContract, contract, 0)
        await contract.connect(validator1).unstake(0, oneToken.mul(900))
        let res = await contract.connect(validator1).recoverUnstaking(oneToken.mul(200), 0, 0)
        expect(res).to.emit(contract, 'RecoveredUnstake').withArgs(0, VALIDATOR_1, oneToken.mul(200).toString(), 0);
        expect(res).to.emit(contract, 'Staked').withArgs(0, VALIDATOR_1, oneToken.mul(200).toString());

        res = await contract.connect(validator1).recoverUnstaking(oneToken.mul(700), 0, 0)
        expect(res).to.emit(contract, 'RecoveredUnstake').withArgs(0, VALIDATOR_1, oneToken.mul(700).toString(), 0);
        expect(res).to.emit(contract, 'Staked').withArgs(0, VALIDATOR_1, oneToken.mul(700).toString());
    });

  });