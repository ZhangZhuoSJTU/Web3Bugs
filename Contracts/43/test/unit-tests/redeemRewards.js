
const { expect } = require("chai");
const { ethers } = require("hardhat");

const {stake, deposit, getAll, mineBlocks, getOwner, getDeployedContract, getAllocatedTokensPerEpoch, getEndEpoch, getMaxCapMultiplier,
  oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
  OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT} = require("../helpers");

describe("Redeem Rewards", function () {

    it("Should emit redeem reward event with correct number of rewards", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      deposit(contract, (oneToken).mul(100000));
      const tokensPerEpoch = await getAllocatedTokensPerEpoch(contract)
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      const amount = oneToken.mul(1000);
      let start = await stake(amount, validator1, cqtContract, contract, 0)
      start = start.blockNumber
      await mineBlocks(100);
      let tokensGiven = tokensPerEpoch.mul(100)
      let details = await contract.getDelegatorDetails(validator1.address)
      expect(details.rewardsAvailable[0].add(details.commissionRewards[0]).toString()).to.equal(tokensGiven.toString());

      let end = await stake(amount, validator1, cqtContract, contract, 0)
      end = end.blockNumber
      await mineBlocks(100);
      tokensGiven = tokensPerEpoch.mul(200 + end - start - 100)
      details = await contract.getDelegatorDetails(validator1.address)
      expect(details.rewardsAvailable[0].add(details.commissionRewards[0])).to.be.closeTo(tokensGiven, 10000000000);
      let expectedCommission = tokensGiven.mul(1000000000000).div(oneToken)
      expect(details.commissionRewards[0]).to.be.closeTo(expectedCommission, 1);
      expectedCommission = details.commissionRewards[0];
      let expectedAmount = details.rewardsAvailable[0].add(details.commissionRewards[0])
      let redeemResult = await contract.connect(validator1).redeemAllRewards(0, VALIDATOR_1)
      end = redeemResult.blockNumber
      tokensGiven = tokensGiven.add(tokensPerEpoch)
      expectedCommission = tokensGiven.mul(1000000000000).div(oneToken) //203000000000000 =  ~ 202999999999999
      expect(redeemResult)
      .to.emit(contract, 'CommissionRewardRedeemed').withArgs(0, VALIDATOR_1, "202999999999999");
    });

    it("Should return number of rewards earned by validator with delegators", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      deposit(contract, (oneToken).mul(1100000));
      const tokensPerEpoch = await getAllocatedTokensPerEpoch(contract)
      let rate = ethers.BigNumber.from("200000000000000000")
      await contract.addValidator(VALIDATOR_1, OPERATOR_1, rate)
      const vAmount = oneToken.mul(2000000);
      const dAmount = oneToken.mul(4);
      let start = await stake(vAmount, validator1, cqtContract, contract, 0)
      let end = await stake(dAmount, delegator1, cqtContract, contract, 0)
      let difference = end.blockNumber - start.blockNumber
      let tokensAdded = tokensPerEpoch.mul(difference)
      let totalStaked = tokensAdded.add(vAmount).add(dAmount)
      let newVStaked = tokensAdded.add(vAmount)
      await mineBlocks(500);
      let end2;
      for (let i = 1; i< 101; i++){
        end2 = await stake(oneToken.mul(i*10), validator1, cqtContract, contract, 0)
      }

      let add = end2.blockNumber - end.blockNumber - 500
      await mineBlocks(500);

      let tokensGivenTotal100 = tokensPerEpoch.mul(1000 + add)
      let validatorTokensGiven100 = tokensGivenTotal100.mul(newVStaked).div(totalStaked)

      let delegatorEarned = tokensGivenTotal100.mul(dAmount).div(totalStaked)
      let delegatorCommissionPaid = delegatorEarned.mul(rate).div(oneToken)
      let validatorTotalReward = (validatorTokensGiven100.add(tokensAdded)).add(delegatorCommissionPaid)
      let details = await contract.getDelegatorDetails(validator1.address)
      const ddetails = await contract.getDelegatorDetails(delegator1.address)
      const sum_ = details.rewardsAvailable[0].add(details.commissionRewards[0]).add(ddetails.rewardsAvailable[0])
      const expectedSum = tokensGivenTotal100.add(tokensAdded)

      // console.log("Total received: ", sum_.toString());
      // console.log("Total should:   ", tokensGivenTotal100.add(tokensAdded).toString());
      expect(sum_).to.be.closeTo(expectedSum, 10000000000)
      expect(details.rewardsAvailable[0].add(details.commissionRewards[0])).to.be.closeTo(validatorTotalReward.toString(), ethers.BigNumber.from("1000000000000000"));
      expect(ddetails.rewardsAvailable[0]).to.be.closeTo(expectedSum.sub(validatorTotalReward).toString(), ethers.BigNumber.from("1000000000000000"));
    });

})
