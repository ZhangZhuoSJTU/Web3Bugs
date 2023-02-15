const { expect } = require("chai");
const {getAll, getDeployedContract, getMaxCapMultiplier, getRewardsLocked, getAllocatedTokensPerEpoch, getEndEpoch,
    oneToken, OWNER, VALIDATOR_1, VALIDATOR_2, OPERATOR_1,
    OPERATOR_2, DELEGATOR_1, DELEGATOR_2, CQT, deposit, stake} = require("../helpers");

describe("Take out reward Tokens", function () {

    it("Should change balance of the contract and the owner.", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      await deposit(contract, oneToken.mul(100000))
      const oldOwnerBalance = await cqtContract.balanceOf(OWNER);
      await contract.takeOutRewardTokens(oneToken.mul(100))
      expect(await cqtContract.balanceOf(OWNER)).to.equal(oldOwnerBalance.add(oneToken.mul(100)));
    });

    it("Should take out correct # of rewards.", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      await deposit(contract, oneToken.mul(1000000))
      await contract.takeOutRewardTokens(oneToken.mul(100));
      await contract.takeOutRewardTokens(oneToken.mul(1000000-100));
      await expect(contract.takeOutRewardTokens(1)).to.be.revertedWith("Amount is greater than available");
    });

    it("Should change endEpoch.", async function () {
      const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
      let amount = oneToken;
      await cqtContract.approve(contract.address, oneToken);
      const tokensPerEpoch = await getAllocatedTokensPerEpoch(contract);
      await contract.depositRewardTokens(oneToken);

      await contract.addValidator(VALIDATOR_1, OPERATOR_1, 1000000000000)
      let res = await await stake(oneToken.mul(100000), validator1, cqtContract, contract, 0)
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
          await expect(contract.takeOutRewardTokens(0)).to.be.reverted;
          await expect(contract.takeOutRewardTokens(10000000000000000000000000000)).to.be.reverted;

          deposit(contract, oneToken.mul(1000000))
          await expect(contract.takeOutRewardTokens(0)).to.be.reverted;
          await expect(contract.takeOutRewardTokens(5000000)).to.be.revertedWith("Amount is greater than available");
        });

    it("Should not change allocated tokens per epoch.", async function () {
            const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
            let before = await getAllocatedTokensPerEpoch(contract);
            await deposit(contract, oneToken.mul(10000000));
            await contract.takeOutRewardTokens(120)
            let after = await getAllocatedTokensPerEpoch(contract);
            expect(after).to.equal(before);

            await deposit(contract, oneToken)
            await deposit(contract, oneToken.mul(10000))
            await contract.takeOutRewardTokens(120)
            await contract.takeOutRewardTokens(1000)
            await contract.takeOutRewardTokens(1)
            await deposit(contract, oneToken)
            before = after
            after = await getAllocatedTokensPerEpoch(contract);
            expect(after).to.equal(before);
          });

    it("Should not change max cap multiplier.", async function () {
            const [contract, cqtContract, validator1, validator2, delegator1, delegator2 ] = await getAll()
            let before = await getMaxCapMultiplier(contract);
            await deposit(contract, oneToken.mul(10000000));
            await contract.takeOutRewardTokens(120)
            let after = await getMaxCapMultiplier(contract);
            expect(after).to.equal(before);
            await deposit(contract, oneToken)
            await deposit(contract, oneToken.mul(10000))
            await contract.takeOutRewardTokens(120)
            await contract.takeOutRewardTokens(1000)
            await contract.takeOutRewardTokens(1)
            await deposit(contract, oneToken)
            before = after
            after = await getMaxCapMultiplier(contract);
            expect(after).to.equal(before);
          });


    });
