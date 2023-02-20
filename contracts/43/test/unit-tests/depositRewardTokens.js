const { expect } = require("chai");
const {getAll, getDeployedContract, getRewardsLocked,getAllocatedTokensPerEpoch, getMaxCapMultiplier, getEndEpoch,
    oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
    OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT, stake} = require("../helpers");

describe("Deposit reward Tokens", function () {

    it("Should change balance of the contract and the owner.", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      await cqtContract.approve(contract.address, oneToken);
      const oldOwnerBalance = await cqtContract.balanceOf(OWNER);
      expect(await cqtContract.balanceOf(contract.address)).to.equal(0);
      await contract.depositRewardTokens(oneToken);
      expect(await cqtContract.balanceOf(contract.address)).to.equal(oneToken);
      expect(await cqtContract.balanceOf(OWNER)).to.equal(oldOwnerBalance.sub(oneToken));
    });

    it("Should change endEpoch.", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      let amount = oneToken;
      await cqtContract.approve(contract.address, oneToken);
      const tokensPerEpoch = await getAllocatedTokensPerEpoch(contract);
      await contract.depositRewardTokens(oneToken);
      await contract.addValidator(validator1.address, validator1.address, 100000)
      let res = await stake(oneToken.mul(10000), validator1, cqtContract, contract, 0)
      let startEpoch = ethers.BigNumber.from(res.blockNumber)
      let endEpoch = startEpoch.add(amount.div(tokensPerEpoch));
      endEpoch = ethers.BigNumber.from(endEpoch)
      expect(await getEndEpoch(contract)).to.equal(ethers.BigNumber.from(endEpoch));

      amount = oneToken.mul(1000000);
      endEpoch = endEpoch.add(amount.div(tokensPerEpoch));
      await cqtContract.approve(contract.address, amount);
      await contract.depositRewardTokens(amount);
      expect(await getEndEpoch(contract)).to.equal(endEpoch);

      amount = oneToken.mul(1000);
      endEpoch = endEpoch.sub(amount.div(tokensPerEpoch));
      await contract.takeOutRewardTokens(amount)
      expect(await getEndEpoch(contract)).to.equal(endEpoch);
    });

    it("Should revert with wrong inputs.", async function () {
          const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
          let amount = 600;
          await cqtContract.approve(contract.address, amount);
          await expect(contract.depositRewardTokens(0)).to.be.revertedWith('Does not cover least 1 epoch');
          await expect(contract.depositRewardTokens(amount + 200)).to.be.reverted;
          await expect(contract.depositRewardTokens("115792089237316195423570985008687907853269984665640564039457584007913129639935")).to.be.reverted;
        });

    it("Should not change allocated tokens per epoch.", async function () {
            const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
            await cqtContract.approve(contract.address, oneToken);
            let tokensPerEpochBefore = await getAllocatedTokensPerEpoch(contract);
            await contract.depositRewardTokens(oneToken);
            let tokensPerEpochAfter = await getAllocatedTokensPerEpoch(contract);
            expect(tokensPerEpochAfter).to.equal(tokensPerEpochBefore);
            await cqtContract.approve(contract.address, oneToken);
            await contract.depositRewardTokens(oneToken);
            await cqtContract.approve(contract.address, oneToken);
            await contract.depositRewardTokens(oneToken);
            await cqtContract.approve(contract.address, oneToken);
            await contract.depositRewardTokens(oneToken);
            tokensPerEpochBefore = tokensPerEpochAfter
            tokensPerEpochAfter = await getAllocatedTokensPerEpoch(contract);
            expect(tokensPerEpochAfter).to.equal(tokensPerEpochBefore);
          });

    it("Should not change max cap multiplier.", async function () {
            const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
            await cqtContract.approve(contract.address, oneToken);
            let before = await getMaxCapMultiplier(contract);
            await contract.depositRewardTokens(oneToken);
            let after = await getMaxCapMultiplier(contract);
            expect(after).to.equal(before);
            await cqtContract.approve(contract.address, oneToken);
            await contract.depositRewardTokens(oneToken);
            await cqtContract.approve(contract.address, oneToken.mul(10000));
            await contract.depositRewardTokens(oneToken.mul(10000));
            await cqtContract.approve(contract.address, oneToken);
            await contract.depositRewardTokens(oneToken);
            before = after
            after = await getMaxCapMultiplier(contract);
            expect(after).to.equal(before);
          });


    });
