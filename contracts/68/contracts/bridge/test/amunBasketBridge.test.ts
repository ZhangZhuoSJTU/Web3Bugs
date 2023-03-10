import chai from "chai";
import chaiBN from "chai-bn";
import chaiAsPromised from "chai-as-promised";
import BN from "bn.js";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { BigNumber, ContractReceipt, Signer } from "ethers";
import { Event } from "@ethersproject/contracts/src.ts";


import { MintableERC20, MockERC20, PolygonERC20Wrapper } from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import sinon from "sinon";
import { zeroAddress } from "ethereumjs-util";
import TimeTraveler from "./helpers/TimeTraveler";

chai.use(chaiAsPromised).use(chaiBN(BN)).use(solidity).should();

const should = chai.should();
const expect = chai.expect;
const abi = ethers.utils.defaultAbiCoder;
describe("Amun Basket Bridge", function () {
  let timeTraveler: TimeTraveler;
  let childChainManager: SignerWithAddress;
  let rootChainManager: SignerWithAddress;
  let predicateProxy: SignerWithAddress;
  let user: Signer;
  let userAddress: string;
  let safeOwner: Signer;
  let anotherUser: Signer;
  let anotherUserAddress: string;
  let chainId: number;
  //Contracts
  let contracts: {
    basketAddress: string;
    basket: MockERC20;
    amunChildBasketBridge: PolygonERC20Wrapper;
    amunRootBasketBridge: MintableERC20;
  };
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    sinon.stub(console, "log"); // disable console.log

    const [userSig, safeOwnerSig, anotherSig, manager, predicate] =
      await ethers.getSigners();
    user = userSig;
    userAddress = await user.getAddress();
    safeOwner = safeOwnerSig;
    anotherUser = anotherSig;
    anotherUserAddress = await anotherUser.getAddress();
    childChainManager = manager;
    predicateProxy = predicate;
    chainId = await user.getChainId();
    await childChainManager.getAddress(), await predicateProxy.getAddress();

    await childChainManager.getAddress(), await predicateProxy.getAddress();

    const mockTokenFactory = await ethers.getContractFactory("MockERC20");

    const basket = (await mockTokenFactory.deploy("TTT", "TTT")) as MockERC20;
    const basketAddress = basket.address;

    const RootBasketBridgeFactory = await ethers.getContractFactory(
      "MintableERC20"
    );

    const ChildBasketBridgeFactory = await ethers.getContractFactory(
      "PolygonERC20Wrapper"
    );
    const amunChildBasketBridge =
      (await ChildBasketBridgeFactory.deploy()) as PolygonERC20Wrapper;

    await amunChildBasketBridge.initialize(
      basketAddress,
      await childChainManager.getAddress(),
      "wrapped MTI",
      "wMTI"
    );

    const amunRootBasketBridge =
      (await RootBasketBridgeFactory.deploy()) as MintableERC20;

    await amunRootBasketBridge.initialize(
      "MTI",
      "Matic Index",
      await predicateProxy.getAddress()
    );
    await basket.mint(userAddress, "100000000000000000000");
    contracts = {
      basketAddress,
      basket,
      amunChildBasketBridge,
      amunRootBasketBridge,
    };
    sinon.restore(); // enable console.log

    await timeTraveler.snapshot();
  });

  describe("Child", function () {
    const depositAmount = "100";
    let depositReceiver = userAddress;
    let depositData = abi.encode(["uint256"], [depositAmount]);
    let oldAccountBalance: BigNumber;

    describe("#deposit", function () {
      let depositTx: ContractReceipt;
      let transferLogMint: Event;
      let transferLogUnderlying: Event;
      before(async () => {
        await timeTraveler.revertSnapshot();
        await contracts.basket.transfer(
          contracts.amunChildBasketBridge.address,
          depositAmount
        );
        depositReceiver = userAddress;
        oldAccountBalance = await contracts.basket.balanceOf(depositReceiver);
      });
      describe("Should send underlying tokens on deposit", () => {
        it("Can receive deposit tx", async () => {
          depositTx = await (
            await contracts.amunChildBasketBridge
              .connect(childChainManager)
              .deposit(depositReceiver, depositData)
          ).wait();
          should.exist(depositTx);
        });

        it("Should emit mint Transfer log", () => {
          transferLogMint = depositTx.events?.find(
            (l) => l.event === "Transfer" && l.args?.from === zeroAddress()
          ) as Event;
          should.exist(transferLogMint);
        });
        it("Should emit underlying Transfer log", () => {
          transferLogUnderlying = depositTx.events?.find(
            (l) => l.event === "Transfer" && l.args?.from !== zeroAddress()
          ) as Event;
          should.exist(transferLogMint);
        });
        it("Deposit amount should be credited in underlying to deposit receiver", async () => {
          const newAccountBalance = (
            await contracts.basket.balanceOf(depositReceiver)
          ).toString();

          newAccountBalance.should.be.equals(
            oldAccountBalance.add(depositAmount).toString()
          );
        });
      });

      describe("Correct values should be emitted in mint Transfer log", () => {
        it("Event should be emitted by correct contract", () => {
          transferLogMint.address.should.equal(
            contracts.amunChildBasketBridge.address
          );
        });

        it("Should emit proper From", () => {
          transferLogMint.args?.from.should.equal(zeroAddress());
        });

        it("Should emit proper To", () => {
          transferLogMint.args?.to.should.equal(depositReceiver);
        });

        it("Should emit correct amount", () => {
          const transferLogAmount = new BN(
            transferLogMint.args?.value.toString()
          );
          transferLogAmount.should.be.bignumber.that.equals(depositAmount);
        });
      });

      describe("Correct values should be emitted in underlying Transfer log", () => {
        it("Event should be emitted by correct contract", () => {
          transferLogUnderlying.address.should.equal(contracts.basketAddress);
        });

        it("Should emit proper From", () => {
          transferLogUnderlying.args?.from.should.equal(
            contracts.amunChildBasketBridge.address
          );
        });

        it("Should emit proper To", () => {
          transferLogUnderlying.args?.to.should.equal(depositReceiver);
        });

        it("Should emit correct amount", () => {
          const transferLogAmount = new BN(
            transferLogUnderlying.args?.value.toString()
          );
          transferLogAmount.should.be.bignumber.that.equals(depositAmount);
        });
      });
      describe("Deposit called by non depositor account", () => {
        it("Tx should revert with proper reason", async () => {
          await expect(
            contracts.amunChildBasketBridge.deposit(userAddress, depositData)
          ).to.be.revertedWith("ONLY_CHILD_CHAIN_MANAGER");
        });
      });
    });
    describe("#withdraw", function () {
      const withdrawAmount = "100";
      let withdrawReceiver: string;

      let withdrawTx: ContractReceipt;
      let transferLogBurn: Event;
      let transferLogUnderlying: Event;

      let oldAccountBalance: BigNumber;
      before(async () => {
        await timeTraveler.revertSnapshot();
        withdrawReceiver = userAddress;
        await contracts.basket.approve(
          contracts.amunChildBasketBridge.address,
          depositAmount
        );
        oldAccountBalance = await contracts.basket.balanceOf(withdrawReceiver);
      });
      describe("Should burn tokens on withdraw", () => {
        it("Can receive withdraw tx", async () => {
          withdrawTx = await (
            await contracts.amunChildBasketBridge.withdraw(withdrawAmount)
          ).wait();
          should.exist(withdrawTx);
        });

        it("Should emit Burn Transfer log", () => {
          transferLogBurn = withdrawTx.events?.find(
            (l) => l.event === "Transfer" && l.args?.to === zeroAddress()
          ) as Event;
          should.exist(transferLogBurn);
        });
        it("Should emit Underlying Transfer log", () => {
          transferLogUnderlying = withdrawTx.events?.find(
            (l) =>
              l.event === "Transfer" && l.address === contracts.basketAddress
          ) as Event;
          should.exist(transferLogUnderlying);
        });
        describe("Correct values should be emitted in Burn Transfer log", () => {
          it("Event should be emitted by correct contract", () => {
            transferLogBurn.address.should.equal(
              contracts.amunChildBasketBridge.address
            );
          });

          it("Should emit proper From", () => {
            transferLogBurn.args?.from.should.equal(withdrawReceiver);
          });

          it("Should emit proper To", () => {
            transferLogBurn.args?.to.should.equal(zeroAddress());
          });

          it("Should emit correct amount", () => {
            const transferLogAmount = new BN(
              transferLogBurn.args?.value.toString()
            );
            transferLogAmount.should.be.bignumber.that.equals(withdrawAmount);
          });
        });
        describe("Correct values should be emitted in Underlying Transfer log", () => {
          it("Event should be emitted by correct contract", () => {
            transferLogUnderlying.address.should.equal(
              contracts.basket.address
            );
          });

          it("Should emit proper From", () => {
            transferLogUnderlying.args?.from.should.equal(withdrawReceiver);
          });

          it("Should emit proper To", () => {
            transferLogUnderlying.args?.to.should.equal(
              contracts.amunChildBasketBridge.address
            );
          });

          it("Should emit correct amount", () => {
            const transferLogAmount = new BN(
              transferLogUnderlying.args?.value.toString()
            );
            transferLogAmount.should.be.bignumber.that.equals(withdrawAmount);
          });
        });
        it("Withdraw amount should be deducted from user", async () => {
          const newAccountBalance = (
            await contracts.basket.balanceOf(withdrawReceiver)
          ).toString();
          newAccountBalance.should.be.equals(
            oldAccountBalance.sub(withdrawAmount).toString()
          );
        });
      });
    });
    describe("#withdrawTo", function () {
      const withdrawAmount = "100";
      let withdrawReceiver: string;
      let withdrawingAccount: string;

      let withdrawTx: ContractReceipt;
      let transferLogBurn: Event;
      let transferLogUnderlying: Event;

      let oldAccountBalance: BigNumber;
      before(async () => {
        await timeTraveler.revertSnapshot();
        withdrawReceiver = anotherUserAddress;
        withdrawingAccount = userAddress;
        await contracts.basket.approve(
          contracts.amunChildBasketBridge.address,
          depositAmount
        );
        oldAccountBalance = await contracts.basket.balanceOf(
          withdrawingAccount
        );
      });
      describe("Should burn tokens on withdraw", () => {
        it("Can receive withdraw tx", async () => {
          withdrawTx = await (
            await contracts.amunChildBasketBridge.withdrawTo(
              withdrawAmount,
              withdrawReceiver
            )
          ).wait();
          should.exist(withdrawTx);
        });

        it("Should emit Burn Transfer log", () => {
          transferLogBurn = withdrawTx.events?.find(
            (l) => l.event === "Transfer" && l.args?.to === zeroAddress()
          ) as Event;
          should.exist(transferLogBurn);
        });
        it("Should emit Underlying Transfer log", () => {
          transferLogUnderlying = withdrawTx.events?.find(
            (l) =>
              l.event === "Transfer" && l.address === contracts.basketAddress
          ) as Event;
          should.exist(transferLogUnderlying);
        });
        it("Withdraw amount should be deducted from user", async () => {
          const newAccountBalance = (
            await contracts.basket.balanceOf(withdrawingAccount)
          ).toString();
          newAccountBalance.should.be.equals(
            oldAccountBalance.sub(withdrawAmount).toString()
          );
        });
      });
      describe("Correct values should be emitted in Burn Transfer log", () => {
        it("Event should be emitted by correct contract", () => {
          transferLogBurn.address.should.equal(
            contracts.amunChildBasketBridge.address
          );
        });

        it("Should emit proper From", () => {
          transferLogBurn.args?.from.should.equal(withdrawReceiver);
        });

        it("Should emit proper To", () => {
          transferLogBurn.args?.to.should.equal(zeroAddress());
        });

        it("Should emit correct amount", () => {
          const transferLogAmount = new BN(
            transferLogBurn.args?.value.toString()
          );
          transferLogAmount.should.be.bignumber.that.equals(withdrawAmount);
        });
      });
      describe("Correct values should be emitted in Underlying Transfer log", () => {
        it("Event should be emitted by correct contract", () => {
          transferLogUnderlying.address.should.equal(contracts.basket.address);
        });

        it("Should emit proper From", () => {
          transferLogUnderlying.args?.from.should.equal(withdrawingAccount);
        });

        it("Should emit proper To", () => {
          transferLogUnderlying.args?.to.should.equal(
            contracts.amunChildBasketBridge.address
          );
        });

        it("Should emit correct amount", () => {
          const transferLogAmount = new BN(
            transferLogUnderlying.args?.value.toString()
          );
          transferLogAmount.should.be.bignumber.that.equals(withdrawAmount);
        });
      });
    });
  });
  describe("Root", function () {
    describe("#mint", function () {
      const mintAmount = "100";
      let mintReceiver: string;

      let mintTx: ContractReceipt;
      let transferLogMint: Event;

      let oldAccountBalance: BigNumber;
      before(async () => {
        await timeTraveler.revertSnapshot();
        mintReceiver = anotherUserAddress;

        oldAccountBalance = await contracts.amunRootBasketBridge.balanceOf(
          mintReceiver
        );
      });
      describe("Should mint tokens on mint", () => {
        it("Can receive mint tx", async () => {
          mintTx = await (
            await contracts.amunRootBasketBridge
              .connect(predicateProxy)
              .mint(mintReceiver, mintAmount)
          ).wait();
          should.exist(mintTx);
        });
        it("Should emit Mint Transfer log", () => {
          transferLogMint = mintTx.events?.find(
            (l) => l.event === "Transfer"
          ) as Event;
          should.exist(transferLogMint);
        });
        it("Mint amount should be added to user", async () => {
          const newAccountBalance = (
            await contracts.amunRootBasketBridge.balanceOf(mintReceiver)
          ).toString();
          newAccountBalance.should.be.equals(
            oldAccountBalance.add(mintAmount).toString()
          );
        });
      });
      describe("Correct values should be emitted in Mint Transfer log", () => {
        it("Event should be emitted by correct contract", () => {
          transferLogMint.address.should.equal(
            contracts.amunRootBasketBridge.address
          );
        });

        it("Should emit proper From", () => {
          transferLogMint.args?.from.should.equal(zeroAddress());
        });

        it("Should emit proper To", () => {
          transferLogMint.args?.to.should.equal(mintReceiver);
        });

        it("Should emit correct amount", () => {
          const transferLogAmount = new BN(
            transferLogMint.args?.value.toString()
          );
          transferLogAmount.should.be.bignumber.that.equals(mintAmount);
        });
      });
      describe("Mint called by non predicate proxy account", () => {
        it("Tx should revert with proper reason", async () => {
          await expect(
            contracts.amunRootBasketBridge.mint(mintReceiver, mintAmount)
          ).to.be.revertedWith("ONLY_PREDICATE_PROXY");
        });
      });
    });
  });
});
