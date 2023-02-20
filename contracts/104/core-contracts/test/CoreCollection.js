const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');
const BalanceTree = require('./merkle-tree/balance-tree');

const { CoreCollectionABI, RoyaltyVaultABI } = require('./abis');
const { deployContract, findEvents } = require('./utils');

const deployCoreContracts = async () => {
  const coreCollection = await deployContract('CoreCollection');
  return [coreCollection];
};

const getContract = (address, abi) => {
  return new ethers.Contract(address, abi, ethers.provider);
};

const createSplit = async (
  proxyFactory,
  merkleRoot,
  wEth,
  mockCollection,
  splitId,
) => {
  let royaltyVault, splitProxy, splitTx;

  if (mockCollection) {
    splitTx = await proxyFactory['createSplit(bytes32,address,address,string)'](
      merkleRoot,
      wEth,
      mockCollection,
      splitId,
    );
  } else {
    splitTx = await proxyFactory['createSplit(bytes32,address,string)'](
      merkleRoot,
      wEth,
      splitId,
    );
  }

  const splitTxn = await splitTx.wait(1);

  let eventVault = splitTxn.events.find(
    (event) => event.event === 'VaultCreated',
  );
  [royaltyVault] = eventVault.args;

  let eventSplit = splitTxn.events.find(
    (event) => event.event === 'SplitCreated',
  );
  [splitProxy] = eventSplit.args;

  return [royaltyVault, splitProxy];
};

const getTree = async (allocatedAddresses, allocationAmount) => {
  const allocations = allocationAmount.map((amount, index) => {
    return {
      who: allocatedAddresses[index],
      allocation: BigNumber.from(allocationAmount[index]),
    };
  });

  let tree = new BalanceTree(allocations);
  return tree;
};

describe('CoreCollection', () => {
  // signers
  let alice, bob, jack, maria;

  // signer addresses
  let aliceAddr, bobAddr, jackAddr, mariaAddr;

  // contracts
  let splitter, splitFactory, royaltyVault, weth;

  // project
  let projectA, projectB;

  // collection
  let collectionA, collectionB;

  before(async () => {
    // assign signers
    [alice, bob, jack, maria] = await ethers.getSigners();
    [aliceAddr, bobAddr, jackAddr, mariaAddr] = await Promise.all(
      [alice, bob, jack, maria].map((x) => x.getAddress()),
    );

    // deploy contracts
    splitter = await deployContract('MockSplitter');
    royaltyVault = await deployContract('MockRoyaltyVault');
    splitFactory = await deployContract('MockSplitFactory', [
      splitter.address,
      royaltyVault.address,
    ]);

    weth = await deployContract('MockERC20');

    // assign collection data
    collectionA = [
      'Collection A',
      'CA',
      'https://project-a-base-uri.com',
      2,
      ethers.utils.parseEther('1'),
      weth.address,
      true,
      splitFactory.address,
    ];

    collectionB = [
      'Collection B',
      'CB',
      'https://project-b-base-uri.com',
      2,
      ethers.utils.parseEther('1'),
      weth.address,
      true,
      splitFactory.address,
    ];

    collectionC = [
      'Collection C',
      'CB',
      'https://project-c-base-uri.com',
      10,
      ethers.utils.parseEther('1'),
      weth.address,
      true,
      splitFactory.address,
    ];
  });

  describe('initialize', () => {
    let collectionAName,
      collectionASymbol,
      collectionABaseUri,
      collectionAMaxSupply,
      collectionAMintFee,
      collectionAWeth,
      collectionAForSale,
      collectionASplitFactory;

    let coreCollection;

    before(async () => {
      [coreCollection] = await deployCoreContracts();
      [coreCollectionB] = await deployCoreContracts();
      [
        collectionAName,
        collectionASymbol,
        collectionABaseUri,
        collectionAMaxSupply,
        collectionAMintFee,
        collectionAWeth,
        collectionAForSale,
        collectionASplitFactory,
      ] = collectionA;
    });

    describe('max supply is 0', () => {
      const maxSupply = 0;
      it('should revert', async () => {
        await expect(
          coreCollection.initialize(
            collectionAName,
            collectionASymbol,
            collectionABaseUri,
            maxSupply,
            collectionAMintFee,
            collectionAWeth,
            collectionAForSale,
            collectionASplitFactory,
          ),
        ).to.be.revertedWith(
          'CoreCollection: Max supply should be greater than 0',
        );
      });
    });

    describe('max supply is 1', () => {
      const maxSupply = 1;
      it('Should initialize core collection', async () => {
        await expect(
          coreCollection.initialize(
            collectionAName,
            collectionASymbol,
            collectionABaseUri,
            maxSupply,
            collectionAMintFee,
            collectionAWeth,
            collectionAForSale,
            collectionASplitFactory,
          ),
        );
        expect(await coreCollection.name()).to.be.equal(collectionA[0]);
      });
    });
  });

  describe('mintToken', () => {
    let collectionAName,
      collectionASymbol,
      collectionABaseUri,
      collectionAMaxSupply,
      collectionAMintFee,
      collectionAWeth,
      collectionAForSale,
      collectionASplitFactory;

    let collectionBName,
      collectionBSymbol,
      collectionBBaseUri,
      collectionBMaxSupply,
      collectionBMintFee,
      collectionBWeth,
      collectionBForSale,
      collectionBSplitFactory;

    let merkleRoot, tree, mariasProof, splitMerkleRoot, splitTree;

    describe('Collection created but not initialized', () => {
      let coreCollection, coreCollectionB;

      before(async () => {
        [coreCollection] = await deployCoreContracts();
        [
          collectionAName,
          collectionASymbol,
          collectionABaseUri,
          collectionAMaxSupply,
          collectionAMintFee,
          collectionAWeth,
          collectionAForSale,
          collectionASplitFactory,
        ] = collectionA;

        // Calculating Merkle tree for jack and maria Claims
        const allocationAmount = [1, 1];
        const allocatedAddresses = [jackAddr, mariaAddr];

        tree = await getTree(allocatedAddresses, allocationAmount);
        merkleRoot = tree.getHexRoot();
      });

      it('Should revert', async () => {
        await expect(
          coreCollection.mintToken(bobAddr, false, 0, 1, [
            ethers.constants.HashZero,
          ]),
        ).to.be.revertedWith('CoreCollection: Not initialized');
      });
    });

    describe('Collection created and initialized', () => {
      let coreCollection;

      before(async () => {
        [coreCollection] = await deployCoreContracts();
        [
          collectionAName,
          collectionASymbol,
          collectionABaseUri,
          collectionAMaxSupply,
          collectionAMintFee,
          collectionAWeth,
          collectionAForSale,
          collectionASplitFactory,
        ] = collectionA;

        await coreCollection.initialize(
          collectionAName,
          collectionASymbol,
          collectionABaseUri,
          collectionAMaxSupply,
          collectionAMintFee,
          collectionAWeth,
          collectionAForSale,
          collectionASplitFactory,
        );

        // Calculating Merkle tree for jack and maria Claims
        const allocationAmount = [1, 1];
        const allocatedAddresses = [jackAddr, mariaAddr];
        const splitAllocationAmount = [5000, 5000];

        tree = await getTree(allocatedAddresses, allocationAmount);
        splitTree = await getTree(allocatedAddresses, splitAllocationAmount);
        merkleRoot = tree.getHexRoot();
        splitMerkleRoot = splitTree.getHexRoot();
        mariasProof = tree.getProof(mariaAddr, 1);
      });

      describe('Mint amount is 0', () => {
        const mintAmount = 0;

        it('Should revert', async () => {
          await expect(
            coreCollection.mintToken(bobAddr, false, 0, mintAmount, [
              ethers.constants.HashZero,
            ]),
          ).to.be.revertedWith(
            'CoreCollection: Amount should be greater than 0',
          );
        });
      });

      describe('Collection is sold out', () => {
        it('should revert', async () => {
          await expect(
            coreCollection.mintToken(bobAddr, false, 0, 3, [
              ethers.constants.HashZero,
            ]),
          ).to.be.revertedWith('CoreCollection: Over Max Supply');
        });
      });

      describe('Mint amount is 1', () => {
        const mintAmount = 1;
        describe('Collection is not sold out', () => {
          describe('Minting is a free claim', () => {
            const isClaim = true;
            describe('Claim is not initialized', () => {
              it('Should revert', async () => {
                await expect(
                  coreCollection
                    .connect(maria)
                    .mintToken(mariaAddr, isClaim, 1, mintAmount, [
                      ethers.constants.HashZero,
                    ]),
                ).to.be.revertedWith('CoreCollection: No claimable');
              });
            });
            describe('Claim is initialized', () => {
              describe('User can claim', () => {
                let tx, receipt;
                before(async () => {
                  await coreCollection.initializeClaims(merkleRoot);
                  const tx = await coreCollection
                    .connect(maria)
                    .mintToken(mariaAddr, isClaim, 1, mintAmount, mariasProof);
                  receipt = await tx.wait();
                });
                it('Should emit a NewClaim event', async () => {
                  const events = findEvents({
                    receipt,
                    eventName: 'NewClaim',
                  });
                  expect(events.length).to.equal(1);
                  const { claimedBy, to, tokenId } = events[0].args;
                  expect(claimedBy).to.equal(mariaAddr);
                  expect(to).to.equal(mariaAddr);
                  expect(tokenId).to.equal(1);
                });
                it('Should mint a new token', async () => {
                  const events = findEvents({ receipt, eventName: 'Transfer' });
                  expect(events.length).to.equal(1);
                  const { from, to, tokenId } = events[0].args;
                  expect(from).to.equal(ethers.constants.AddressZero);
                  expect(to).to.equal(mariaAddr);
                  expect(tokenId).to.equal(1);
                });

                describe('royalty vault is set', () => {
                  let royaltyVaultProxy, splitProxy;
                  before(async () => {
                    [coreCollectionWithRoyalty] = await deployCoreContracts();
                    [
                      collectionCName,
                      collectionCSymbol,
                      collectionCBaseUri,
                      collectionCMaxSupply,
                      collectionCMintFee,
                      collectionCWeth,
                      collectionCForSale,
                      collectionCSplitFactory,
                    ] = collectionC;

                    await coreCollectionWithRoyalty.initialize(
                      collectionCName,
                      collectionCSymbol,
                      collectionCBaseUri,
                      collectionCMaxSupply,
                      collectionCMintFee,
                      collectionCWeth,
                      collectionCForSale,
                      collectionCSplitFactory,
                    );

                    [royaltyVaultProxy, splitProxy] = await createSplit(
                      splitFactory,
                      splitMerkleRoot,
                      weth.address,
                      coreCollectionWithRoyalty.address,
                      '1',
                    );
                    await weth
                      .connect(alice)
                      .approve(
                        coreCollectionWithRoyalty.address,
                        ethers.utils.parseEther('1'),
                      );

                    await coreCollectionWithRoyalty
                      .connect(alice)
                      .mintToken(bobAddr, false, 1, mintAmount, mariasProof);
                  });
                  describe('Royalty Vault balance is greater than 0', () => {
                    it('should send money to the splitter contract', async () => {
                      splitBalance = await weth.balanceOf(splitProxy);
                      await expect(splitBalance.toString()).to.equal(
                        ethers.utils.parseEther('0.95').toString(),
                      );
                    });
                  });
                  describe('Royalty Vault balance is 0', () => {
                    it('should not send money to the splitter contract', async () => {
                      royaltyVaultContract = getContract(
                        royaltyVaultProxy,
                        RoyaltyVaultABI,
                      );

                      await expect(
                        royaltyVaultContract.connect(alice).sendToSplitter(),
                      ).to.be.revertedWith(
                        'Vault does not have enough royalty Asset to send',
                      );
                    });
                  });
                });

                describe('royalty vault is not set', () => {
                  it('Core collection contract balance should be 1 ETH', async () => {
                    await weth
                      .connect(alice)
                      .approve(
                        coreCollection.address,
                        ethers.utils.parseEther('1'),
                      );

                    const tx = await coreCollection
                      .connect(alice)
                      .mintToken(mariaAddr, false, 0, 1, mariasProof);
                    const coreContractBalance = await weth.balanceOf(
                      coreCollection.address,
                    );
                    await expect(coreContractBalance).to.equal(
                      ethers.utils.parseEther('1'),
                    );
                  });
                });
              });
              describe('User cannot claim', () => {
                before(async () => {
                  [coreCollectionB] = await deployCoreContracts();

                  [
                    collectionBName,
                    collectionBSymbol,
                    collectionBBaseUri,
                    collectionBMaxSupply,
                    collectionBMintFee,
                    collectionBWeth,
                    collectionBForSale,
                    collectionBSplitFactory,
                  ] = collectionB;

                  await coreCollectionB.initialize(
                    collectionBName,
                    collectionBSymbol,
                    collectionBBaseUri,
                    collectionAMaxSupply,
                    collectionBMintFee,
                    collectionBWeth,
                    collectionBForSale,
                    collectionBSplitFactory,
                  );

                  await coreCollectionB.initializeClaims(merkleRoot);
                });

                it('should revert', async () => {
                  await expect(
                    coreCollectionB
                      .connect(maria)
                      .mintToken(mariaAddr, isClaim, 1, 2, mariasProof),
                  ).to.be.revertedWith("CoreCollection: Can't claim");
                });
              });
            });
          });
          describe('Minting is not a free claim', () => {
            const isClaim = false;

            describe('Collection isn’t for sale', () => {
              const isForSale = false;
              before(async () => {
                [coreCollection] = await deployCoreContracts();

                await coreCollection.initialize(
                  collectionAName,
                  collectionASymbol,
                  collectionABaseUri,
                  collectionAMaxSupply,
                  collectionAMintFee,
                  collectionAWeth,
                  isForSale,
                  collectionASplitFactory,
                );
              });

              it('Should revert', async () => {
                await expect(
                  coreCollection
                    .connect(maria)
                    .mintToken(mariaAddr, isClaim, 1, mintAmount, mariasProof),
                ).to.be.revertedWith('CoreCollection: Not for sale');
              });
            });
            describe('Collection is for sale or free', () => {
              const isForSale = true;
              const mintFee = 0;
              describe('Collection is free', () => {
                before(async () => {
                  [coreCollection] = await deployCoreContracts();

                  await coreCollection.initialize(
                    collectionCName,
                    collectionCSymbol,
                    collectionCBaseUri,
                    collectionCMaxSupply,
                    mintFee,
                    collectionCWeth,
                    isForSale,
                    collectionCSplitFactory,
                  );
                });
                it('Should mint a new token', async () => {
                  const tx = await coreCollection
                    .connect(maria)
                    .mintToken(mariaAddr, isClaim, 1, mintAmount, mariasProof);
                  const receipt = await tx.wait();
                  const events = findEvents({ receipt, eventName: 'Transfer' });
                  expect(events.length).to.equal(1);
                  const { from, to } = events[0].args;
                  expect(from).to.equal(ethers.constants.AddressZero);
                  expect(to).to.equal(mariaAddr);
                });
                describe('royalty vault is set', async () => {
                  let royaltyVaultProxy, splitProxy;

                  const splitAllocationAmount = [4000, 6000];
                  let splitTree = await getTree(
                    allocatedAddresses,
                    splitAllocationAmount,
                  );
                  splitMerkleRoot = splitTree.getHexRoot();

                  before(async () => {
                    [royaltyVaultProxy, splitProxy] = await createSplit(
                      splitFactory,
                      splitMerkleRoot,
                      weth.address,
                      coreCollection.address,
                      '2',
                    );
                    await weth
                      .connect(alice)
                      .approve(
                        coreCollection.address,
                        ethers.utils.parseEther('1'),
                      );

                    await coreCollection
                      .connect(alice)
                      .mintToken(bobAddr, false, 1, mintAmount, mariasProof);
                  });

                  describe('Royalty Vault balance is greater than 0', () => {
                    it('should send money to the splitter contract', async () => {
                      splitBalance = await weth.balanceOf(splitProxy);
                      await expect(splitBalance.toString()).to.equal(
                        ethers.utils.parseEther('0.95').toString(),
                      );
                    });
                  });
                  describe('Royalty Vault balance is 0', () => {
                    it('should not send money to the splitter contract', async () => {
                      royaltyVaultContract = getContract(
                        royaltyVaultProxy,
                        RoyaltyVaultABI,
                      );

                      await expect(
                        royaltyVaultContract.connect(alice).sendToSplitter(),
                      ).to.be.revertedWith(
                        'Vault does not have enough royalty Asset to send',
                      );
                    });
                  });
                });

                describe('royalty vault is not set', () => {
                  it('Core collection contract balance should be 0 ETH / as thi is a free mint', async () => {
                    await weth
                      .connect(alice)
                      .approve(
                        coreCollection.address,
                        ethers.utils.parseEther('1'),
                      );

                    const tx = await coreCollection
                      .connect(alice)
                      .mintToken(mariaAddr, false, 0, 1, mariasProof);
                    const coreContractBalance = await weth.balanceOf(
                      coreCollection.address,
                    );
                    await expect(coreContractBalance).to.equal(
                      ethers.utils.parseEther('0'),
                    );
                  });
                });
              });
              describe('Collection cost 1 wETH', () => {
                const mintFee = ethers.utils.parseEther('1');
                before(async () => {
                  [coreCollection] = await deployCoreContracts();

                  await coreCollection.initialize(
                    collectionAName,
                    collectionASymbol,
                    collectionABaseUri,
                    collectionAMaxSupply,
                    mintFee,
                    collectionAWeth,
                    isForSale,
                    collectionASplitFactory,
                  );
                });
                describe("Contract doesn't have allowance set", () => {
                  it('should revert', async () => {
                    await expect(
                      coreCollection
                        .connect(maria)
                        .mintToken(
                          mariaAddr,
                          isClaim,
                          1,
                          mintAmount,
                          mariasProof,
                        ),
                    ).to.be.revertedWith('ERC20: insufficient allowance');
                  });
                });
                describe('Contract have allowance set', () => {
                  describe('royalty vault is set', async () => {
                    let royaltyVaultProxy, splitProxy;

                    const splitAllocationAmount = [5500, 4500];
                    let splitTree = await getTree(
                      allocatedAddresses,
                      splitAllocationAmount,
                    );
                    splitMerkleRoot = splitTree.getHexRoot();

                    before(async () => {
                      [royaltyVaultProxy, splitProxy] = await createSplit(
                        splitFactory,
                        splitMerkleRoot,
                        weth.address,
                        coreCollection.address,
                        '3',
                      );
                      await weth
                        .connect(alice)
                        .approve(
                          coreCollection.address,
                          ethers.utils.parseEther('1'),
                        );

                      await coreCollection
                        .connect(alice)
                        .mintToken(bobAddr, false, 1, mintAmount, mariasProof);
                    });

                    describe('Royalty Vault balance is greater than 0', () => {
                      it('should send money to the ssplitter contract', async () => {
                        splitBalance = await weth.balanceOf(splitProxy);
                        await expect(splitBalance.toString()).to.equal(
                          ethers.utils.parseEther('0.95').toString(),
                        );
                      });
                    });
                    describe('Royalty Vault balance is 0', () => {
                      it('should not send money to the splitter contract', async () => {
                        royaltyVaultContract = getContract(
                          royaltyVaultProxy,
                          RoyaltyVaultABI,
                        );

                        await expect(
                          royaltyVaultContract.connect(alice).sendToSplitter(),
                        ).to.be.revertedWith(
                          'Vault does not have enough royalty Asset to send',
                        );
                      });
                    });
                  });
                  describe('royalty vault is not set', () => {
                    it('it should send 1 wETH to itself', async () => {
                      weth
                        .connect(alice)
                        .approve(
                          coreCollection.address,
                          ethers.utils.parseEther('1'),
                        )
                        .then(async () => {
                          const tx = await coreCollection
                            .connect(alice)
                            .mintToken(
                              mariaAddr,
                              isClaim,
                              1,
                              mintAmount,
                              mariasProof,
                            );
                          const receipt = await tx.wait();
                          const events = findEvents({
                            receipt,
                            eventName: 'NewPayment',
                          });
                          expect(events.length).to.equal(1);
                          const { from, to, amount, royaltyVault } =
                            events[0].args;
                          expect(from).to.equal(alice.address);
                          expect(to).to.equal(coreCollection.address);
                          expect(amount).to.equal(ethers.utils.parseEther('1'));
                          expect(royaltyVault).to.not.be.ok;
                        });
                    });
                    it('Should mint a new token', async () => {
                      const tx = await coreCollection
                        .connect(alice)
                        .mintToken(
                          mariaAddr,
                          isClaim,
                          1,
                          mintAmount,
                          mariasProof,
                        );
                      const receipt = await tx.wait();
                      const events = findEvents({
                        receipt,
                        eventName: 'Transfer',
                      });
                      expect(events.length).to.equal(1);
                      const { from, to } = events[0].args;
                      expect(from).to.equal(ethers.constants.AddressZero);
                      expect(to).to.equal(maria.address);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
