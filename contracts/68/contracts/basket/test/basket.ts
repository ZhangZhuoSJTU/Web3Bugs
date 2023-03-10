import { IERC20__factory } from './../typechain/factories/IERC20__factory';
import chai, { expect } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { ethers, run, network } from "hardhat";
import { Signer, constants, BigNumber, utils, Contract, BytesLike } from "ethers";

import BasketFacetArtifact from "../artifacts/contracts/facets/Basket/BasketFacet.sol/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/contracts/facets/ERC20/ERC20Facet.sol/ERC20Facet.json";
import MockTokenArtifact from "../artifacts/contracts/test/MockToken.sol/MockToken.json";
import { ERC20Facet, BasketFacet, DiamondFactoryContract, MockToken } from "../typechain";
import { IERC20__factory as Ierc20Factory } from "../typechain/factories/IERC20__factory";
import { IExperiPie__factory as IExperiPieFactory } from "../typechain/factories/IExperiPie__factory";
import { IExperiPie } from "../typechain/IExperiPie";
import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";

chai.use(solidity);

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2,
};

const referralCode = constants.Zero

function getSelectors(contract: Contract) {
  const signatures: BytesLike[] = [];
  for (const key of Object.keys(contract.functions)) {
    signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
  }

  return signatures;
}

describe("BasketFacet", function () {
  this.timeout(300000000);

  let experiPie: IExperiPie;
  let account: string;
  let signers: Signer[];
  let timeTraveler: TimeTraveler;
  const testTokens: MockToken[] = [];

  before(async () => {
    signers = await ethers.getSigners();
    account = await signers[0].getAddress();
    timeTraveler = new TimeTraveler(network.provider);

    const diamondFactory = (await run("deploy-diamond-factory")) as DiamondFactoryContract;

    const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
    const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as ERC20Facet;

    await diamondFactory.deployNewDiamond(
      account,
      [
        {
          action: FacetCutAction.Add,
          facetAddress: basketFacet.address,
          functionSelectors: getSelectors(basketFacet)
        },
        {
          action: FacetCutAction.Add,
          facetAddress: erc20Facet.address,
          functionSelectors: getSelectors(erc20Facet)
        }
      ]
    )

    const experiPieAddress = await diamondFactory.diamonds(0);
    experiPie = IExperiPieFactory.connect(experiPieAddress, signers[0]);

    for (let i = 0; i < 3; i++) {
      const token = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;
      await token.mint(parseEther("1000000"), account);
      testTokens.push(token);
    }

    await timeTraveler.snapshot();
  });

  beforeEach(async () => {
    await timeTraveler.revertSnapshot();
  });


  describe("MaxCap", async () => {
    it("Check default cap", async () => {
      const maxCap = await experiPie.getCap();
      expect(maxCap).to.be.eq("0");
    });
    it("Test setCap not allowed", async () => {
      let experiPieAltSigner = experiPie.connect(signers[1]);
      await expect(
        experiPieAltSigner
          .setCap(parseEther("1000"))
      ).to.be.revertedWith("NOT_ALLOWED");

    });
    it("Set max cap", async () => {
      await experiPie.setCap(parseEther("100"));
      const maxCap = await experiPie.getCap();
      expect(maxCap).to.eq(parseEther("100"));
    });
  });

  describe("Lock", async () => {
    it("Check default locked", async () => {
      const lock = await experiPie.getLock();
      expect(lock).to.be.true;
    });
    it("Test setlock not allowed", async () => {
      const experiPieAltSigner = experiPie.connect(signers[1]);
      await expect(
        experiPieAltSigner.setLock(1)
      ).to.be.revertedWith("NOT_ALLOWED");
    });
    it("Check past lock", async () => {
      // set blockNumber to at least 2
      await timeTraveler.mine_blocks(2);

      // set lock in the past
      await experiPie.setLock(1);
      const lock = await experiPie.getLock();
      expect(lock).to.be.false;
    });
    it("Check future lock", async () => {
      const latestBlock = await ethers.provider.getBlockNumber();
      // set lock in the future
      await experiPie.setLock(latestBlock + 10);
      const lock = await experiPie.getLock();
      expect(lock).to.be.true;
    });
    it("Check current block lock", async () => {
      // assert lock == currentblock
      const latestBlock = await ethers.provider.getBlockNumber();
      await experiPie.setLock(latestBlock + 1);
      const lockBlock = await experiPie.getLockBlock();
      expect(lockBlock).to.eq(latestBlock + 1);

      // should still be locked (block is including)
      const lock = await experiPie.getLock();
      expect(lock).to.be.true;
    });
    it("Wait for lock expires", async () => {
      const latestBlock = await ethers.provider.getBlockNumber();

      await experiPie.setLock(latestBlock + 10);
      await timeTraveler.mine_blocks(11);

      const lock = await experiPie.getLock();
      expect(lock).to.be.false;
    });
  });

  describe("Joining and exiting", async () => {
    beforeEach(async () => {
      for (let token of testTokens) {
        await token.approve(experiPie.address, constants.MaxUint256);
        await token.transfer(experiPie.address, parseEther("10000"));
        const account1 = await signers[1].getAddress();
        await token.mint(parseEther("10000"), account1);
        token.connect(signers[1]).approve(experiPie.address, constants.MaxUint256);
        await experiPie.addToken(token.address);
      }

      await experiPie.initialize(parseEther("100"), "TEST", "TEST");
      await experiPie.setLock(constants.One);
      await experiPie.setCap(constants.MaxUint256);
    });

    const getBalances = async (address: string) => {
      return {
        t0: await testTokens[0].balanceOf(address),
        t1: await testTokens[1].balanceOf(address),
        t2: await testTokens[2].balanceOf(address),
        pie: await experiPie.balanceOf(address)
      }
    }

    it("Test locks", async () => {
      const latestBlock = await ethers.provider.getBlockNumber();
      await experiPie.setLock(latestBlock + 5);
      await expect(
        experiPie.joinPool(parseEther("1"), referralCode)
      ).to.be.revertedWith("POOL_LOCKED");

      await expect(
        experiPie.exitPool(parseEther("1"), referralCode)
      ).to.be.revertedWith("POOL_LOCKED");
    });
    it("Join pool", async () => {
      const mintAmount = parseEther("1");
      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);

      const calcTokenFor = await experiPie.calcTokensForAmount(mintAmount);

      const gasEstimation = await experiPie.estimateGas.joinPool(mintAmount, referralCode);
      console.log({ gasEstimation: gasEstimation.toString() })

      await experiPie.joinPool(mintAmount, referralCode);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);

      const expectedTokenAmount = pieBalancesBefore.t0.mul(mintAmount).div(totalSupplyBefore);
      calcTokenFor.amounts.forEach(amount => {
        expect(amount).to.be.eq(expectedTokenAmount)
      });

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount));

      // Verify user balances
      expect(userBalancesAfter.t0).to.eq(userBalancesBefore.t0.sub(expectedTokenAmount));
      expect(userBalancesAfter.t1).to.eq(userBalancesBefore.t1.sub(expectedTokenAmount));
      expect(userBalancesAfter.t2).to.eq(userBalancesBefore.t2.sub(expectedTokenAmount));
      expect(userBalancesAfter.pie).to.eq(userBalancesBefore.pie.add(mintAmount));

      // Verify pie balances
      expect(pieBalancesAfter.t0).to.eq(pieBalancesBefore.t0.add(expectedTokenAmount));
      expect(pieBalancesAfter.t1).to.eq(pieBalancesBefore.t1.add(expectedTokenAmount));
      expect(pieBalancesAfter.t2).to.eq(pieBalancesBefore.t2.add(expectedTokenAmount));

    });
    it("Join pool with fee", async () => {
      const fee = ethers.BigNumber.from("10").pow(16).mul(4) // 4%
      await experiPie.setEntryFee(fee)

      const mintAmount = parseEther("1");
      const feeAmount = parseEther("0.04") // 4 %
      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);

      const calcTokenFor = await experiPie.calcTokensForAmount(mintAmount);
      await experiPie.joinPool(mintAmount, referralCode);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);

      const expectedTokenAmount = pieBalancesBefore.t0.mul(mintAmount.add(feeAmount)).div(totalSupplyBefore);
      calcTokenFor.amounts.forEach(amount => {
        expect(amount).to.be.eq(expectedTokenAmount)
      });

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount));

      // Verify user balances
      expect(userBalancesAfter.t0).to.eq(userBalancesBefore.t0.sub(expectedTokenAmount));
      expect(userBalancesAfter.t1).to.eq(userBalancesBefore.t1.sub(expectedTokenAmount));
      expect(userBalancesAfter.t2).to.eq(userBalancesBefore.t2.sub(expectedTokenAmount));
      expect(userBalancesAfter.pie).to.eq(userBalancesBefore.pie.add(mintAmount));

      // Verify pie balances
      expect(pieBalancesAfter.t0).to.eq(pieBalancesBefore.t0.add(expectedTokenAmount));
      expect(pieBalancesAfter.t1).to.eq(pieBalancesBefore.t1.add(expectedTokenAmount));
      expect(pieBalancesAfter.t2).to.eq(pieBalancesBefore.t2.add(expectedTokenAmount));
    });
    it("Join pool with fee and beneficiary", async () => {
      const fee = ethers.BigNumber.from("10").pow(16).mul(4) // 4%
      const beneficiaryFee = ethers.BigNumber.from("10").pow(16).mul(50) // 50%
      await experiPie.setEntryFee(fee)
      await experiPie.setEntryFeeBeneficiaryShare(beneficiaryFee)
      await experiPie.setFeeBeneficiary(await signers[1].getAddress())

      const mintAmount = parseEther("1");
      const feeAmount = parseEther("0.04") // 4 %
      const beneficiaryShare = mintAmount.div(100).mul(2) // 2%

      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);
      const beneficiaryBefore = await getBalances(await signers[1].getAddress());

      const calcTokenFor = await experiPie.calcTokensForAmount(mintAmount);
      await experiPie.joinPool(mintAmount, referralCode);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);
      const beneficiaryAfter = await getBalances(await signers[1].getAddress());

      const expectedTokenAmount = pieBalancesBefore.t0.mul(mintAmount.add(feeAmount)).div(totalSupplyBefore);
      calcTokenFor.amounts.forEach(amount => {
        expect(amount).to.be.eq(expectedTokenAmount)
      });

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount).add(beneficiaryShare));

      // Verify user balances
      expect(userBalancesAfter.t0).to.eq(userBalancesBefore.t0.sub(expectedTokenAmount));
      expect(userBalancesAfter.t1).to.eq(userBalancesBefore.t1.sub(expectedTokenAmount));
      expect(userBalancesAfter.t2).to.eq(userBalancesBefore.t2.sub(expectedTokenAmount));
      expect(userBalancesAfter.pie).to.eq(userBalancesBefore.pie.add(mintAmount));

      // Verify pie balances
      expect(pieBalancesAfter.t0).to.eq(pieBalancesBefore.t0.add(expectedTokenAmount));
      expect(pieBalancesAfter.t1).to.eq(pieBalancesBefore.t1.add(expectedTokenAmount));
      expect(pieBalancesAfter.t2).to.eq(pieBalancesBefore.t2.add(expectedTokenAmount));

      // Verfiy beneficiary balances
      expect(beneficiaryAfter.t0).to.eq(beneficiaryBefore.t0);
      expect(beneficiaryAfter.t1).to.eq(beneficiaryBefore.t1);
      expect(beneficiaryAfter.t2).to.eq(beneficiaryBefore.t2);
      expect(beneficiaryAfter.pie).to.eq(beneficiaryBefore.pie.add(beneficiaryShare));
    });
    it("Exit pool", async () => {
      const burnAmount = parseEther("5");

      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);
      const calcTokenFor = await experiPie.calcTokensForAmountExit(burnAmount)

      const gasEstimationExitPool = await experiPie.estimateGas.exitPool(burnAmount, referralCode);
      console.log({ gasEstimationExitPool: gasEstimationExitPool.toString() })

      await experiPie.exitPool(burnAmount, referralCode);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);

      const expectedTokenAmount = pieBalancesBefore.t0.mul(burnAmount).div(totalSupplyBefore);
      calcTokenFor.amounts.forEach(amount => {
        expect(amount).to.be.eq(expectedTokenAmount)
      });

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.sub(burnAmount));

      // Verify user balances
      expect(userBalancesAfter.t0).to.eq(userBalancesBefore.t0.add(expectedTokenAmount));
      expect(userBalancesAfter.t1).to.eq(userBalancesBefore.t1.add(expectedTokenAmount));
      expect(userBalancesAfter.t2).to.eq(userBalancesBefore.t2.add(expectedTokenAmount));
      expect(userBalancesAfter.pie).to.eq(userBalancesBefore.pie.sub(burnAmount));

      // Verify Pie balances
      expect(pieBalancesAfter.t0).to.eq(pieBalancesBefore.t0.sub(expectedTokenAmount));
      expect(pieBalancesAfter.t1).to.eq(pieBalancesBefore.t1.sub(expectedTokenAmount));
      expect(pieBalancesAfter.t2).to.eq(pieBalancesBefore.t2.sub(expectedTokenAmount));

    });
    it("Exit pool with fee", async () => {
      const fee = ethers.BigNumber.from("10").pow(16).mul(4) // 4%
      await experiPie.setExitFee(fee)

      const burnAmount = parseEther("5");
      const feeAmount = parseEther("0.20") // 4 %

      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);
      const calcTokenFor = await experiPie.calcTokensForAmountExit(burnAmount)

      await experiPie.exitPool(burnAmount, referralCode);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);

      const expectedTokenAmount = pieBalancesBefore.t0.mul(burnAmount.sub(feeAmount)).div(totalSupplyBefore);
      calcTokenFor.amounts.forEach(amount => {
        expect(amount).to.be.eq(expectedTokenAmount)
      });

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.sub(burnAmount));

      // Verify user balances
      expect(userBalancesAfter.t0).to.eq(userBalancesBefore.t0.add(expectedTokenAmount));
      expect(userBalancesAfter.t1).to.eq(userBalancesBefore.t1.add(expectedTokenAmount));
      expect(userBalancesAfter.t2).to.eq(userBalancesBefore.t2.add(expectedTokenAmount));
      expect(userBalancesAfter.pie).to.eq(userBalancesBefore.pie.sub(burnAmount));

      // Verify Pie balances
      expect(pieBalancesAfter.t0).to.eq(pieBalancesBefore.t0.sub(expectedTokenAmount));
      expect(pieBalancesAfter.t1).to.eq(pieBalancesBefore.t1.sub(expectedTokenAmount));
      expect(pieBalancesAfter.t2).to.eq(pieBalancesBefore.t2.sub(expectedTokenAmount));

    });
    it("Exit pool with fee and beneficiary", async () => {
      const fee = ethers.BigNumber.from("10").pow(16).mul(4) // 4%
      const beneficiaryFee = ethers.BigNumber.from("10").pow(16).mul(50) // 50%
      await experiPie.setExitFee(fee)
      await experiPie.setExitFeeBeneficiaryShare(beneficiaryFee)
      await experiPie.setFeeBeneficiary(await signers[1].getAddress())

      const burnAmount = parseEther("5");
      const feeAmount = parseEther("0.20") // 4 %
      const beneficiaryShare = burnAmount.div(100).mul(2) // 2%

      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);
      const beneficiaryBefore = await getBalances(await signers[1].getAddress());
      const calcTokenFor = await experiPie.calcTokensForAmountExit(burnAmount)

      await experiPie.exitPool(burnAmount, referralCode);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);
      const beneficiaryAfter = await getBalances(await signers[1].getAddress());

      const expectedTokenAmount = pieBalancesBefore.t0.mul(burnAmount.sub(feeAmount)).div(totalSupplyBefore);
      calcTokenFor.amounts.forEach(amount => {
        expect(amount).to.be.eq(expectedTokenAmount)
      });
      expect(totalSupplyAfter).to.eq(totalSupplyBefore.sub(burnAmount).add(beneficiaryShare));

      // Verify user balances
      expect(userBalancesAfter.t0).to.eq(userBalancesBefore.t0.add(expectedTokenAmount));
      expect(userBalancesAfter.t1).to.eq(userBalancesBefore.t1.add(expectedTokenAmount));
      expect(userBalancesAfter.t2).to.eq(userBalancesBefore.t2.add(expectedTokenAmount));
      expect(userBalancesAfter.pie).to.eq(userBalancesBefore.pie.sub(burnAmount));

      // Verify Pie balances
      expect(pieBalancesAfter.t0).to.eq(pieBalancesBefore.t0.sub(expectedTokenAmount));
      expect(pieBalancesAfter.t1).to.eq(pieBalancesBefore.t1.sub(expectedTokenAmount));
      expect(pieBalancesAfter.t2).to.eq(pieBalancesBefore.t2.sub(expectedTokenAmount));

      // Verify beneficiary balances
      expect(beneficiaryAfter.t0).to.eq(beneficiaryBefore.t0);
      expect(beneficiaryAfter.t1).to.eq(beneficiaryBefore.t1);
      expect(beneficiaryAfter.t2).to.eq(beneficiaryBefore.t2);
      expect(beneficiaryAfter.pie).to.eq(beneficiaryBefore.pie.add(beneficiaryShare));

    });
    it("Join fails if it exceeds balance", async () => {
      await expect(
        experiPie.joinPool(parseEther("10000"), referralCode)
      ).to.be.revertedWith("transfer amount exceeds balance");
    });
    it("Exit fails if it exceeds MIN_AMOUNT", async () => {
      const balance = await experiPie.balanceOf(account);
      await expect(
        experiPie.exitPool(balance.sub(1), referralCode)
      ).to.be.revertedWith("TOKEN_BALANCE_TOO_LOW");
    });
    it("Join pool with two accounts", async () => {
      const mintAmount = parseEther("100");
      const experiPieAltSigner = experiPie.connect(signers[1]);

      const account1 = await signers[1].getAddress();

      const totalSupplyBefore = await experiPie.totalSupply();
      const user0BalancesBefore = await getBalances(account);
      const user1BalancesBefore = await getBalances(account1);
      const pieBalancesBefore = await getBalances(experiPie.address);

      await experiPie.joinPool(mintAmount, referralCode);
      await experiPieAltSigner.joinPool(mintAmount, referralCode);

      const totalSupplyAfter = await experiPie.totalSupply();
      const user0BalancesAfter = await getBalances(account);
      const user1BalancesAfter = await getBalances(account1);
      const pieBalancesAfter = await getBalances(experiPie.address);

      const expectedTokenAmount = pieBalancesBefore.t0.mul(mintAmount).div(totalSupplyBefore);

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount.mul(2)));

      // Verify user0 balances
      expect(user0BalancesAfter.t0).to.eq(user0BalancesBefore.t0.sub(expectedTokenAmount));
      expect(user0BalancesAfter.t1).to.eq(user0BalancesBefore.t1.sub(expectedTokenAmount));
      expect(user0BalancesAfter.t2).to.eq(user0BalancesBefore.t2.sub(expectedTokenAmount));
      expect(user0BalancesAfter.pie).to.eq(user0BalancesBefore.pie.add(mintAmount));

      // Verify user1 balances
      expect(user1BalancesAfter.t0).to.eq(user1BalancesBefore.t0.sub(expectedTokenAmount));
      expect(user1BalancesAfter.t1).to.eq(user1BalancesBefore.t1.sub(expectedTokenAmount));
      expect(user1BalancesAfter.t2).to.eq(user1BalancesBefore.t2.sub(expectedTokenAmount));
      expect(user1BalancesAfter.pie).to.eq(user1BalancesBefore.pie.add(mintAmount));

      // Verify pie balances
      expect(pieBalancesAfter.t0).to.eq(pieBalancesBefore.t0.add(expectedTokenAmount.mul(2)));
      expect(pieBalancesAfter.t1).to.eq(pieBalancesBefore.t1.add(expectedTokenAmount.mul(2)));
      expect(pieBalancesAfter.t2).to.eq(pieBalancesBefore.t2.add(expectedTokenAmount.mul(2)));

    });
    it("Exit fails if it exceeds balance of user", async () => {
      const balance = await experiPie.balanceOf(account);
      await expect(
        experiPie.exitPool(balance.add(1), referralCode)
      ).to.be.revertedWith("subtraction overflow");
    });
    it("Join fails if it exceeds max cap", async () => {
      const totalSupply = await experiPie.totalSupply();
      const mintAmount = parseEther("10000");

      await experiPie.setCap(totalSupply.add(mintAmount).sub(1))

      await expect(
        experiPie.joinPool(mintAmount, referralCode)
      ).to.be.revertedWith("MAX_POOL_CAP_REACHED");
    });
    it("Adding a token", async () => {
      const addedToken = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;

      const tokensBefore = await experiPie.getTokens();

      await addedToken.mint(parseEther("1000000"), account);
      await addedToken.transfer(experiPie.address, parseEther("1000"));
      await experiPie.addToken(addedToken.address);

      const tokensAfter = await experiPie.getTokens();
      const tokenInPool = await experiPie.getTokenInPool(addedToken.address);

      expect(tokensAfter.length).to.eq(tokensBefore.length + 1);
      expect(tokensAfter[tokensAfter.length - 1]).to.eq(addedToken.address);
      expect(tokenInPool).to.be.true;
    });
    it("Adding token not allowed", async () => {
      await expect(experiPie.connect(signers[1]).addToken(constants.AddressZero)).to.be.revertedWith("NOT_ALLOWED");
    });
    it("Adding a token with less than MIN_AMOUNT should fail", async () => {
      const addedToken = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;
      await expect(experiPie.addToken(addedToken.address)).to.be.revertedWith("BALANCE_TOO_SMALL");
    });
    it("Adding a token which is already in the pool should fail", async () => {
      await expect(experiPie.addToken(testTokens[0].address)).to.be.revertedWith("TOKEN_ALREADY_IN_POOL");
    });
    it("Adding more than max tokens should fail", async () => {
      const tokens = await experiPie.getTokens();
      for (let i = 0; i < 30 - tokens.length; i++) {
        const token = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;
        await token.mint(parseEther("1000000"), account);
        await token.transfer(experiPie.address, parseEther("1"));
        await experiPie.addToken(token.address);
      }

      const token = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;
      await token.mint(parseEther("1000000"), account);
      await token.transfer(experiPie.address, parseEther("1"));

      await expect(experiPie.addToken(token.address)).to.revertedWith("TOKEN_LIMIT_REACHED");
    });
    it("Removing a token", async () => {
      const tokensBefore = await experiPie.getTokens();
      await experiPie.removeToken(testTokens[1].address);
      const tokensAfter = await experiPie.getTokens();

      const inPool = await experiPie.getTokenInPool(testTokens[1].address);

      expect(tokensAfter.length).to.eq(tokensBefore.length - 1);
      expect(inPool).to.be.false;
      expect(tokensAfter[0]).to.eq(tokensBefore[0]);
      expect(tokensAfter[1]).to.eq(tokensBefore[2]);
    });
    it("Removing a token not allowed", async () => {
      await expect(experiPie.connect(signers[1]).removeToken(testTokens[1].address)).to.be.revertedWith("NOT_ALLOWED");
    });
    it("Removing a token not in the pool should fail", async () => {
      await expect(experiPie.removeToken(constants.AddressZero)).to.be.revertedWith("TOKEN_NOT_IN_POOL");
    });
  });
  describe("AnnualizedFee", async () => {
    beforeEach(async () => {
      for (let token of testTokens) {
        await token.approve(experiPie.address, constants.MaxUint256);
        await token.transfer(experiPie.address, parseEther("10000"));
        const account1 = await signers[1].getAddress();
        await token.mint(parseEther("10000"), account1);
        token.connect(signers[1]).approve(experiPie.address, constants.MaxUint256);
        await experiPie.addToken(token.address);
      }

      await experiPie.initialize(parseEther("100"), "TEST", "TEST");
      await experiPie.setLock(constants.One);
      await experiPie.setCap(constants.MaxUint256);

      const fee2percent = ethers.BigNumber.from("10").pow(16).mul(2)
      await experiPie.setAnnualizedFee(fee2percent)
      await experiPie.setFeeBeneficiary(await signers[1].getAddress())
    });
    it("outStandingAnnualizedFee, fee ticks on charge is called", async () => {
      let tx = await experiPie.setFeeBeneficiary(constants.AddressZero)
      let timestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;

      expect(await experiPie.calcOutStandingAnnualizedFee()).to.be.eq(0)
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60 * 60 * 24 * 365])

      tx = await experiPie.chargeOutstandingAnnualizedFee()
      timestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60 * 60 * 24 * 365]);

      // zero because no beneficiary
      expect(await experiPie.calcOutStandingAnnualizedFee()).to.be.eq(0)

      const tx2 = await experiPie.setFeeBeneficiary(await signers[1].getAddress())

      timestamp = (await ethers.provider.getBlock(tx2.blockNumber)).timestamp;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60 * 60 * 24 * 365]);
      await ethers.provider.send("evm_mine", []);

      // only fee for 1 year (small rounding error due to block time being off)
      expect(await experiPie.calcOutStandingAnnualizedFee()).to.be.gt(parseEther("2"))
      expect(await experiPie.calcOutStandingAnnualizedFee()).to.be.lt(parseEther("2.00000000127"));
    })
    it("outStandingAnnualizedFee, 2 years", async () => {
      // year 1
      const balanceY1 = parseEther("2")
      let tx = await experiPie.chargeOutstandingAnnualizedFee()
      let timestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60 * 60 * 24 * 365]);
      tx = await experiPie.chargeOutstandingAnnualizedFee()
      timestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;
      expect(await experiPie.balanceOf(await signers[1].getAddress())).to.be.gt(balanceY1)
      expect(await experiPie.balanceOf(await signers[1].getAddress())).to.be.lt(balanceY1.add("64687975647"))
      // year 2 (compounding, original balance + new fee + fee on previous fee)
      const balanceY2 = balanceY1.add(parseEther("2")).add(parseEther("2").div(100).mul(2));
      await ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + 60 * 60 * 24 * 365]);
      await experiPie.chargeOutstandingAnnualizedFee()
      // * small discrepency due to inacurate block time
      expect(await experiPie.balanceOf(await signers[1].getAddress())).to.be.gt(balanceY2)
      expect(await experiPie.balanceOf(await signers[1].getAddress())).to.be.lte(balanceY2.add("65981735159"));
    })
  })
  describe("Fee setters", async () => {
    it("setEntryFee", async () => {
      const fee = ethers.BigNumber.from("10").pow(17)
      await experiPie.setEntryFee(fee)
      expect(await experiPie.getEntryFee()).to.be.eq(fee);
    });
    it("setEntryFee, exceed max", async () => {
      const fee = ethers.BigNumber.from("10").pow(17).add(1)
      await expect(experiPie.setEntryFee(fee)).to.be.revertedWith("FEE_TOO_BIG")
    });
    it("setEntryFee, not allowed", async () => {
      const fee = ethers.BigNumber.from("10").pow(17)
      await expect(experiPie.connect(signers[1]).setEntryFee(fee)).to.be.revertedWith("NOT_ALLOWED")
    });
    it("setExitFee", async () => {
      const fee = ethers.BigNumber.from("10").pow(17)
      await experiPie.setExitFee(fee)
      expect(await experiPie.getExitFee()).to.be.eq(fee);
    });
    it("setExitFee, exceed max", async () => {
      const fee = ethers.BigNumber.from("10").pow(17).add(1)
      await expect(experiPie.setExitFee(fee)).to.be.revertedWith("FEE_TOO_BIG")
    });
    it("setExitFee, not allowed", async () => {
      const fee = ethers.BigNumber.from("10").pow(17)
      await expect(experiPie.connect(signers[1]).setExitFee(fee)).to.be.revertedWith("NOT_ALLOWED")
    });
    it("setAnnualizedFee", async () => {
      const fee = ethers.BigNumber.from("10").pow(17)
      await experiPie.setAnnualizedFee(fee)
      expect(await experiPie.getAnnualizedFee()).to.be.eq(fee);
    });
    it("setAnnualizedFee, exceed max", async () => {
      const fee = ethers.BigNumber.from("10").pow(17).add(1)
      await expect(experiPie.setAnnualizedFee(fee)).to.be.revertedWith("FEE_TOO_BIG")
    });
    it("setAnnualizedFee, not allowed", async () => {
      const fee = ethers.BigNumber.from("10").pow(17)
      await expect(experiPie.connect(signers[1]).setAnnualizedFee(fee)).to.be.revertedWith("NOT_ALLOWED")
    });
    it("setFeeBeneficiary", async () => {
      await experiPie.setFeeBeneficiary(await signers[1].getAddress())
      expect(await experiPie.getFeeBeneficiary()).to.be.eq(await signers[1].getAddress());
    });
    it("setFeeBeneficiary, zero address", async () => {
      await experiPie.setFeeBeneficiary(constants.AddressZero)
      expect(await experiPie.getFeeBeneficiary()).to.be.eq(constants.AddressZero);
    });
    it("setFeeBeneficiary, not allowed", async () => {
      await expect(experiPie.connect(signers[1]).setFeeBeneficiary(constants.AddressZero)).to.be.revertedWith("NOT_ALLOWED")
    });
    it("setEntryFeeBeneficiaryShare", async () => {
      const fee = ethers.BigNumber.from("10").pow(18)
      await experiPie.setEntryFeeBeneficiaryShare(fee)
      expect(await experiPie.getEntryFeeBeneficiaryShare()).to.be.eq(fee);
    });
    it("setEntryFeeBeneficiaryShare, exceed max", async () => {
      const fee = ethers.BigNumber.from("10").pow(18).add(1)
      await expect(experiPie.setEntryFeeBeneficiaryShare(fee)).to.be.revertedWith("FEE_SHARE_TOO_BIG")
    });
    it("setEntryFeeBeneficiaryShare, not allowed", async () => {
      const fee = ethers.BigNumber.from("10").pow(18)
      await expect(experiPie.connect(signers[1]).setEntryFeeBeneficiaryShare(fee)).to.be.revertedWith("NOT_ALLOWED")
    });
    it("setExitFeeBeneficiaryShare", async () => {
      const fee = ethers.BigNumber.from("10").pow(18)
      await experiPie.setExitFeeBeneficiaryShare(fee)
      expect(await experiPie.getExitFeeBeneficiaryShare()).to.be.eq(fee);
    });
    it("setExitFeeBeneficiaryShare, exceed max", async () => {
      const fee = ethers.BigNumber.from("10").pow(18).add(1)
      await expect(experiPie.setExitFeeBeneficiaryShare(fee)).to.be.revertedWith("FEE_SHARE_TOO_BIG")
    });
    it("setExitFeeBeneficiaryShare, not allowed", async () => {
      const fee = ethers.BigNumber.from("10").pow(18)
      await expect(experiPie.connect(signers[1]).setExitFeeBeneficiaryShare(fee)).to.be.revertedWith("NOT_ALLOWED")
    });
  })
})