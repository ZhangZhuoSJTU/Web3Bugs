import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import AllocationTree from "../merkle-tree/balance-tree";

const deployWeth = async () => {
  const myWETHContract = await ethers.getContractFactory("WETH");
  const myWETH = await myWETHContract.deploy();
  return await myWETH.deployed();
};

const deploySplitter = async () => {
  const Splitter = await ethers.getContractFactory("Splitter");
  const splitter = await Splitter.deploy();
  return await splitter.deployed();
};

const deployMockCollection = async () => {
  const MockCollection = await ethers.getContractFactory("MockCollection");
  const mockCollection = await MockCollection.deploy();
  return await mockCollection.deployed();
};

const createSplit = async (
  proxyFactory,
  merkleRoot,
  wEth,
  mockCollection,
  splitId
) => {
  let royaltyVault, splittProxy, splitTx;

  if (mockCollection) {
    splitTx = await proxyFactory[
      "createSplit(bytes32,address,address,string)"
    ](merkleRoot, wEth, mockCollection, splitId);
  } else {
    splitTx = await proxyFactory["createSplit(bytes32,address,string)"](
      merkleRoot,
      wEth,
      splitId
    );
  }

  const splitTxn = await splitTx.wait(1);

  let eventVault = splitTxn.events.find(
    (event) => event.event === "VaultCreated"
  );
  [royaltyVault] = eventVault.args;

  let eventSplit = splitTxn.events.find(
    (event) => event.event === "SplitCreated"
  );
  [splittProxy] = eventSplit.args;

  return [royaltyVault, splittProxy];
};

const deployRoyaltyVault = async () => {
  const deployRoyaltyVaultContract = await ethers.getContractFactory(
    "MockRoyaltyVault"
  );
  const deployRoyaltyVault = await deployRoyaltyVaultContract.deploy();
  return await deployRoyaltyVault.deployed();
};

const getTree = async (allocationPercentages, allocatedAddresses) => {
  const allocations = allocationPercentages.map((percentage, index) => {
    return {
      who: allocatedAddresses[index],
      allocation: BigNumber.from(percentage),
    };
  });

  let tree = new AllocationTree(allocations);
  return tree;
};

const deployProxyFactory = async (
  splitterAddress: string,
  royaltyVaultAddress: string
) => {
  const SplitFactory = await ethers.getContractFactory("SplitFactory");
  const SplitFactoryContract = await SplitFactory.deploy(
    splitterAddress,
    royaltyVaultAddress
  );
  return await SplitFactoryContract.deployed();
};

const PERCENTAGE_SCALE = 1000000;
const NULL_BYTES =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

describe("SplitProxy via Factory", () => {
  describe("basic test", async () => {
    let splitProxyAddress, splitProxy, callableProxy, proxyFactory;
    let splitProxyAddress2;
    let royaltyVaultProxy, royaltyVaultProxyContract, royaltyFactory;
    let royaltyVaultProxy2, royaltyVaultProxyContract2, royaltyFactory2;
    let royaltyVault, royaltyVaultContract;
    let mockCollection;
    let funder, fakeWETH, account1, account2, account3, platformOwner;

    let tree, tree2;

    before(async function () {
      [funder, account1, account2, account3, platformOwner] = await ethers.getSigners();

      fakeWETH = await deployWeth();
      mockCollection = await deployMockCollection();
      mockCollection = await deployMockCollection();

      const allocationPercentages = [5000, 5000];
      const alloactedAddresses1 = [account1.address, account2.address];
      const alloactedAddresses2 = [account2.address, account3.address];

      tree = await getTree(allocationPercentages, alloactedAddresses1);
      tree2 = await getTree(allocationPercentages, alloactedAddresses2);

      const rootHash = tree.getHexRoot();
      const rootHash2 = tree2.getHexRoot();

      const royaltyVaultContract = await deployRoyaltyVault();
      const splitter = await deploySplitter();
      proxyFactory = await deployProxyFactory(
        splitter.address,
        royaltyVaultContract.address
      );

      [royaltyVaultProxy, splitProxyAddress] = await createSplit(
        proxyFactory,
        rootHash,
        fakeWETH.address,
        mockCollection.address,
        "1"
      );

      [royaltyVaultProxy2, splitProxyAddress2] = await createSplit(
        proxyFactory,
        rootHash2,
        fakeWETH.address,
        mockCollection.address,
        "2"
      );

      royaltyVaultProxyContract = await (
        await ethers.getContractAt("MockRoyaltyVault", royaltyVaultProxy)
      ).deployed();

      splitProxy = await (
        await ethers.getContractAt("Splitter", splitProxyAddress)
      ).deployed();

      await proxyFactory.setPlatformFeeRecipient(
        royaltyVaultProxyContract.address,
        platformOwner.address
      );
      await proxyFactory.setPlatformFee(
        royaltyVaultProxyContract.address,
        1000
      );
    });

    describe("when there is a 50-50 allocation", () => {
      it("Verify splitter address", async function () {
        let splitterAddress = await royaltyVaultProxyContract.getSplitter();
        expect(await splitterAddress).to.eq(splitProxy.address);
      });

      it("Should return correct RoyaltVault balance", async function () {
        await fakeWETH
          .connect(funder)
          .transfer(royaltyVaultProxy, ethers.utils.parseEther("1"));
        const balance = await fakeWETH.balanceOf(royaltyVaultProxy);

        expect(balance.toString()).to.eq(
          ethers.utils.parseEther("1").toString()
        );
      });

      it("Owner of RoyaltyVault must be SplitFactory", async function () {
        const owner = await royaltyVaultProxyContract.owner();
        expect(owner).to.eq(proxyFactory.address);
      });

      it("Send VaultBalance to Splitter and Increment window", async function () {
        await royaltyVaultProxyContract.sendToSplitter();
        setTimeout(async () => {}, 5000);
        const balance = await fakeWETH.balanceOf(splitProxy.address);
        expect(balance.toString()).to.eq(
          ethers.utils.parseEther("0.90").toString()
        );
      });

      it("Check for platform fee added to owner address", async function () {
        const balance = await fakeWETH.balanceOf(platformOwner.address);
        expect(balance.toString()).to.eq(
          ethers.utils.parseEther("0.10").toString()
        );
      });

      describe("and 1 ETH is deposited and the window is incremented", () => {
        describe("and one account claims on the first window", () => {
          let amountClaimed, allocation, claimTx;
          before(async () => {
            // Setup.
            const window = 0;
            const account = account1.address;
            allocation = BigNumber.from("5000");
            const proof = tree.getProof(account, allocation);
            const accountBalanceBefore = await fakeWETH.balanceOf(account);

            claimTx = await splitProxy
              .connect(account1)
              .claim(window, allocation, proof);

            const accountBalanceAfter = await fakeWETH.balanceOf(account);
            amountClaimed = accountBalanceAfter.sub(accountBalanceBefore);
          });

          it("it returns 0.9 ETH for balanceForWindow[0]", async () => {
            expect((await splitProxy.balanceForWindow(0)).toString()).to.eq(
              ethers.utils.parseEther("0.9").toString()
            );
          });

          it("gets 0.45 ETH from scaleAmountByPercentage", async () => {
            const scaledAmount = await splitProxy.scaleAmountByPercentage(
              allocation.toString(),
              ethers.utils.parseEther("0.9").toString()
            );
            expect(scaledAmount.toString()).to.eq(
              ethers.utils.parseEther("0.45").toString()
            );
          });

          it("allows them to successfully claim 0.45 ETH", async () => {
            expect(amountClaimed.toString()).to.eq(
              ethers.utils.parseEther("0.45").toString()
            );
          });

          describe("and another 1 ETH is added, and the window is incremented", () => {
            before(async () => {
              await fakeWETH
                .connect(funder)
                .transfer(royaltyVaultProxy, ethers.utils.parseEther("1"));
              await royaltyVaultProxyContract.sendToSplitter();
            });

            describe("and the other account claims on the second window", () => {
              let amountClaimedBySecond;
              beforeEach(async () => {
                // Setup.
                const window = 1;
                const account = account2.address;
                const allocation = BigNumber.from("5000");
                const proof = tree.getProof(account, allocation);

                const accountBalanceBefore = await fakeWETH.balanceOf(account);

                claimTx = await splitProxy
                  .connect(account2)
                  .claim(window, allocation, proof);

                const accountBalanceAfter = await fakeWETH.balanceOf(account);
                amountClaimedBySecond = accountBalanceAfter.sub(
                  accountBalanceBefore
                );
              });

              it("allows them to successfully claim 0.45 ETH", async () => {
                expect(amountClaimedBySecond.toString()).to.eq(
                  ethers.utils.parseEther("0.45").toString()
                );
              });
            });

            describe("and the other account claims on the first window", () => {
              let amountClaimedBySecond;
              before(async () => {
                // Setup.
                const window = 0;
                const account = account2.address;
                const allocation = BigNumber.from("5000");
                const proof = tree.getProof(account, allocation);
                const accountBalanceBefore = await fakeWETH.balanceOf(account);

                await splitProxy
                  .connect(account2)
                  .claim(window, allocation, proof);

                const accountBalanceAfter = await fakeWETH.balanceOf(account);
                amountClaimedBySecond = accountBalanceAfter.sub(
                  accountBalanceBefore
                );
              });

              it("allows them to successfully claim 0.45 ETH", async () => {
                expect(amountClaimedBySecond.toString()).to.eq(
                  ethers.utils.parseEther("0.45").toString()
                );
              });
            });

            describe("and the first account claims on the second window", () => {
              let amountClaimedBySecond;
              beforeEach(async () => {
                // Setup.
                const window = 1;
                const account = account1.address;
                const allocation = BigNumber.from("5000");
                const proof = tree.getProof(account, allocation);
                const accountBalanceBefore = await fakeWETH.balanceOf(account);

                await splitProxy
                  .connect(account1)
                  .claim(window, allocation, proof);

                const accountBalanceAfter = await fakeWETH.balanceOf(account);

                amountClaimed = accountBalanceAfter.sub(accountBalanceBefore);
              });

              it("allows them to successfully claim 0.45 ETH", async () => {
                expect(amountClaimed.toString()).to.eq(
                  ethers.utils.parseEther("0.45").toString()
                );
              });
            });
          });

          describe("Adding 2 more weth and incrementing window twice.", () => {
            before(async () => {
              await fakeWETH
                .connect(funder)
                .transfer(royaltyVaultProxy, ethers.utils.parseEther("1"));
              await royaltyVaultProxyContract.sendToSplitter();

              await fakeWETH
                .connect(funder)
                .transfer(royaltyVaultProxy, ethers.utils.parseEther("1"));
              await royaltyVaultProxyContract.sendToSplitter();
            });

            describe("and the second account claims on the all window", () => {
              let amountClaimedBySecond;
              before(async () => {
                // Setup.
                const account = account2.address;
                const allocation = BigNumber.from("5000");
                const proof = tree.getProof(account, allocation);
                const accountBalanceBefore = await fakeWETH.balanceOf(account);

                await splitProxy
                  .connect(account2)
                  .claimForAllWindows(allocation, proof);

                const accountBalanceAfter = await fakeWETH.balanceOf(account);

                amountClaimedBySecond = accountBalanceAfter.sub(
                  accountBalanceBefore
                );
              });

              it("allows them to successfully claim 1 ETH", async () => {
                expect(amountClaimedBySecond.toString()).to.eq(
                  ethers.utils.parseEther(".9").toString()
                );
              });
            });

            describe("and the first account claims on the all window", () => {
              let amountClaimedBySecond;
              before(async () => {
                // Setup.
                const account = account1.address;
                const allocation = BigNumber.from("5000");
                const proof = tree.getProof(account, allocation);
                const accountBalanceBefore = await fakeWETH.balanceOf(account);

                await splitProxy
                  .connect(account1)
                  .claimForAllWindows(allocation, proof);

                const accountBalanceAfter = await fakeWETH.balanceOf(account);

                amountClaimedBySecond = accountBalanceAfter.sub(
                  accountBalanceBefore
                );
              });

              it("allows them to successfully claim 1 ETH", async () => {
                expect(amountClaimedBySecond.toString()).to.eq(
                  ethers.utils.parseEther(".9").toString()
                );
              });
            });
          });
        });
      });
    });
  });
});
