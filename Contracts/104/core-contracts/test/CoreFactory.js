const { expect } = require('chai')
const chai = require('chai')
const { ethers } = require('hardhat')
const eventemitter2 = require('chai-eventemitter2')

chai.use(eventemitter2())

const { CoreCollectionABI } = require('./abis')
const { deployContract, findEvents } = require('./utils')

const deployCoreContracts = async (splitterAdr) => {
  const coreCollection = await deployContract('CoreCollection')
  const coreFactory = await deployContract('CoreFactory', [
    coreCollection.address,
    splitterAdr,
  ])

  return [coreCollection, coreFactory]
}

const getContract = (address, abi) => {
  return new ethers.Contract(address, abi, ethers.provider)
}

describe('CoreFactory', () => {
  // signers
  let alice, bob, jack, maria

  // signer addresses
  let aliceAddr, bobAddr, jackAddr, mariaAddr

  // contracts
  let splitter, splitFactory, royaltyVault

  // project
  let projectA, projectB

  // collection
  let collectionA, collectionB

  before(async () => {
    // assign signers
    ;[alice, bob, jack, maria] = await ethers.getSigners()
    ;[aliceAddr, bobAddr, jackAddr, mariaAddr] = await Promise.all(
      [alice, bob, jack, maria].map((x) => x.getAddress()),
    )

    // deploy contracts
    splitter = await deployContract('Splitter')
    royaltyVault = await deployContract('RoyaltyVault')
    splitFactory = await deployContract('SplitFactory', [
      splitter.address,
      royaltyVault.address,
    ])

    // assign project ids & project creators
    projectA = {
      id: 'project-a',
      creator: aliceAddr,
      creatorSigner: alice,
    }

    projectB = {
      id: 'project-b',
      creator: bobAddr,
      creatorSigner: bob,
    }

    // assign collection data
    collectionA = {
      isForSale: false,
      maxSupply: 10000,
      mintFee: 1000,
      baseURI: 'https://project-a-base-uri.com',
      name: 'Collection A',
      symbol: 'CA',
      id: 'collection-A',
      claimsMerkleRoot: ethers.constants.HashZero,
      payableToken: ethers.constants.AddressZero,
    }

    collectionB = {
      isForSale: false,
      maxSupply: 10000,
      mintFee: 1000,
      baseURI: 'https://project-b-base-uri.com',
      name: 'Collection B',
      symbol: 'CB',
      id: 'collection-B',
      claimsMerkleRoot:
        '0x87802aa864474158cb068fc9a0cea36a2cdbd6dd65912f9da0b325b6fafc052b',
      payableToken: ethers.constants.AddressZero,
    }

    collectionC = {
      isForSale: false,
      maxSupply: 10000,
      mintFee: 1000,
      baseURI: 'https://project-c-base-uri.com',
      name: 'Collection C',
      symbol: 'CC',
      id: 'collection-C',
      claimsMerkleRoot:
        '0x87802aa864474158cb068fc9a0cea36a2cdbd6dd65912f9da0b325b6fafc052b',
      payableToken: ethers.constants.AddressZero,
    }
  })

  describe('Deployment', () => {
    let coreCollection, coreFactory

    before(async () => {
      ;[coreCollection, coreFactory] = await deployCoreContracts(
        splitFactory.address,
      )
    })

    it('Should assign correct Collection address', async () => {
      expect(await coreFactory.collection()).to.be.equal(coreCollection.address)
    })

    it('Should assign correct SplitFactory address', async () => {
      expect(await coreFactory.splitFactory()).to.be.equal(splitFactory.address)
    })
  })

  describe('Create new project', () => {
    describe('Create new project without any collection', () => {
      let coreFactory

      before(async () => {
        ;[, coreFactory] = await deployCoreContracts(splitFactory.address)
      })

      it('Should revert transaction', async () => {
        await expect(
          coreFactory.createProject(projectA.id, []),
        ).to.be.revertedWith(
          'CoreFactory: should have more at least one collection',
        )
      })

      it('Should not create a project', async () => {
        try {
          await coreFactory.createProject(projectA.id, [])
        } catch (error) {}

        const project = await coreFactory.getProject(projectA.id)
        await expect(project.id).not.equal(projectA.id)
        await expect(project.creator).not.equal(projectA.creator)
      })
    })

    describe('Alice creates new project with one collection', () => {
      let coreFactory, createProjectA, receipt

      before(async () => {
        ;[, coreFactory] = await deployCoreContracts(splitFactory.address)
        createProjectA = await coreFactory
          .connect(alice)
          .createProject(projectA.id, [collectionA])
        receipt = await createProjectA.wait()
      })

      it('Should have correct project owner', async () => {
        const creator = (await coreFactory.getProject(projectA.id)).creator
        expect(creator).be.equal(aliceAddr)
        expect(creator).not.be.equal(bobAddr)
      })

      it('Should deploy a new collection', async () => {
        const collectionAddress = await coreFactory.collections(collectionA.id)
        expect(collectionAddress).not.be.equal(ethers.constants.AddressZero)
      })

      it('Should emit one NewCollection event', async () => {
        const events = findEvents({ receipt, eventName: 'NewCollection' })
        expect(events.length).to.equal(1)
        const { collectionId, collection, projectId } = events[0].args
        expect(collectionId).to.equal(collectionA.id)
        expect(collection).to.be.ok
        expect(projectId).to.equal(projectA.id)
      })

      it('Should create a project', async () => {
        const project = await coreFactory.getProject(projectA.id)
        expect(project.id).equal(projectA.id)
        expect(project.creator).equal(aliceAddr)
      })

      it('Should emit a NewProject event', async () => {
        const events = findEvents({ receipt, eventName: 'NewProject' })
        expect(events.length).to.equal(1)
        const { id, creator } = events[0].args
        expect(id).to.equal(projectA.id)
        expect(creator).to.equal(aliceAddr)
      })

      it('Should revert transaction if collectionId is already used', async () => {
        await expect(
          coreFactory.createProject(projectB.id, [collectionA]),
        ).to.be.revertedWith('CoreFactory: Unavailable collection id')
      })

      it('Should revert transaction for same projectId', async () => {
        await expect(
          coreFactory.createProject(projectA.id, [collectionB]),
        ).to.be.revertedWith('CoreFactory: Unavailable project id')
      })

      describe('CoreCollection storages', () => {
        let coreCollectionContract

        before(async () => {
          const collection = await coreFactory.collections(collectionA.id)
          coreCollectionContract = getContract(collection, CoreCollectionABI)
        })

        it('Should have correct owner', async () => {
          expect(await coreCollectionContract.owner()).to.be.equal(
            alice.address,
          )
        })

        it('Should have correct name', async () => {
          expect(await coreCollectionContract.name()).to.be.equal(
            collectionA.name,
          )
        })

        it('Should have correct symbol', async () => {
          expect(await coreCollectionContract.symbol()).to.be.equal(
            collectionA.symbol,
          )
        })

        it('Should have correct base URI', async () => {
          expect(await coreCollectionContract.baseURI()).to.be.equal(
            collectionA.baseURI,
          )
        })

        it('Should have correct max supply', async () => {
          expect(await coreCollectionContract.maxSupply()).to.be.equal(
            collectionA.maxSupply,
          )
        })

        it('Should have correct mint fee', async () => {
          expect(await coreCollectionContract.mintFee()).to.be.equal(
            collectionA.mintFee,
          )
        })

        it('Should have correct payable token', async () => {
          expect(await coreCollectionContract.payableToken()).to.be.equal(
            collectionA.payableToken,
          )
        })

        it('Should have correct merkle root', async () => {
          expect(await coreCollectionContract.getMerkleRoot()).to.be.equal(
            collectionA.claimsMerkleRoot,
          )
        })

        it('Should have correct split factory', async () => {
          expect(await coreCollectionContract.splitFactory()).to.be.equal(
            splitFactory.address,
          )
        })

        it('Should have correct initialized', async () => {
          expect(await coreCollectionContract.initialized()).to.be.equal(true)
        })
      })
    })

    describe('Create new project with two collections', () => {
      let coreFactory, createProjectA, receipt

      before(async () => {
        ;[, coreFactory] = await deployCoreContracts(splitFactory.address)
        createProjectA = await coreFactory.createProject(projectA.id, [
          collectionA,
          collectionB,
        ])
        receipt = await createProjectA.wait()
      })

      it('Should have correct project owner', async () => {
        const project = await coreFactory.getProject(projectA.id)
        expect(project.creator.toString()).be.equal(projectA.creator)
      })

      it('Should deploy two new collections', async () => {
        expect(await coreFactory.collections(collectionA.id)).not.be.equal(
          ethers.constants.AddressZero,
        )
        expect(await coreFactory.collections(collectionB.id)).not.be.equal(
          ethers.constants.AddressZero,
        )
      })

      it('Should emit two NewCollection event', async () => {
        const events = findEvents({ receipt, eventName: 'NewCollection' })
        expect(events.length).to.equal(2)
        const event1 = events[0].args
        const event2 = events[1].args
        let collectionId, collection, projectId
        ;({ collectionId, collection, projectId } = event1)
        expect(collectionId).to.equal(collectionA.id)
        expect(collection).to.be.ok
        expect(projectId).to.equal(projectA.id)
        ;({ collectionId, collection, projectId } = event2)
        expect(collectionId).to.equal(collectionB.id)
        expect(collection).to.be.ok
        expect(projectId).to.equal(projectA.id)
      })

      it('Should emit one NewProject event', async () => {
        const events = findEvents({ receipt, eventName: 'NewProject' })
        expect(events.length).to.equal(1)
        const { id, creator } = events[0].args
        expect(id).to.equal(projectA.id)
        expect(creator).to.equal(aliceAddr)
      })

      it('Should create a project', async () => {
        const project = await coreFactory.getProject(projectA.id)
        expect(project.id).equal(projectA.id)
        expect(project.creator).equal(projectA.creator)
      })

      it('Should revert transaction for same collectionId', async () => {
        await expect(
          coreFactory.createProject(projectB.id, [collectionA]),
        ).to.be.revertedWith('CoreFactory: Unavailable collection id')
      })

      it('Should revert transaction for same projectId', async () => {
        await expect(
          coreFactory.createProject(projectA.id, [collectionB]),
        ).to.be.revertedWith('CoreFactory: Unavailable project id')
      })

      describe('CoreCollection storages', () => {
        let coreCollectionContractA, coreCollectionContractB

        before(async () => {
          const collection1 = await coreFactory.collections(collectionA.id)
          const collection2 = await coreFactory.collections(collectionB.id)
          coreCollectionContractA = getContract(collection1, CoreCollectionABI)
          coreCollectionContractB = getContract(collection2, CoreCollectionABI)
        })

        it('Should have correct name', async () => {
          expect(await coreCollectionContractA.name()).to.be.equal(
            collectionA.name,
          )
          expect(await coreCollectionContractB.name()).to.be.equal(
            collectionB.name,
          )
        })

        it('Should have correct symbol', async () => {
          expect(await coreCollectionContractA.symbol()).to.be.equal(
            collectionA.symbol,
          )
          expect(await coreCollectionContractB.symbol()).to.be.equal(
            collectionB.symbol,
          )
        })

        it('Should have correct base URI', async () => {
          expect(await coreCollectionContractA.baseURI()).to.be.equal(
            collectionA.baseURI,
          )
          expect(await coreCollectionContractB.baseURI()).to.be.equal(
            collectionB.baseURI,
          )
        })

        it('Should have correct max supply', async () => {
          expect(await coreCollectionContractA.maxSupply()).to.be.equal(
            collectionA.maxSupply,
          )
          expect(await coreCollectionContractB.maxSupply()).to.be.equal(
            collectionB.maxSupply,
          )
        })

        it('Should have correct mint fee', async () => {
          expect(await coreCollectionContractA.mintFee()).to.be.equal(
            collectionA.mintFee,
          )
          expect(await coreCollectionContractB.mintFee()).to.be.equal(
            collectionB.mintFee,
          )
        })

        it('Should have correct payable token', async () => {
          expect(await coreCollectionContractA.payableToken()).to.be.equal(
            collectionA.payableToken,
          )
          expect(await coreCollectionContractB.payableToken()).to.be.equal(
            collectionB.payableToken,
          )
        })

        it('Should have correct merkle root', async () => {
          expect(await coreCollectionContractA.getMerkleRoot()).to.be.equal(
            collectionA.claimsMerkleRoot,
          )
          expect(await coreCollectionContractB.getMerkleRoot()).to.be.equal(
            collectionB.claimsMerkleRoot,
          )
        })

        it('Should have correct split factory', async () => {
          expect(await coreCollectionContractA.splitFactory()).to.be.equal(
            splitFactory.address,
          )
          expect(await coreCollectionContractB.splitFactory()).to.be.equal(
            splitFactory.address,
          )
        })

        it('Should have correct initialized', async () => {
          expect(await coreCollectionContractA.initialized()).to.be.equal(true)
          expect(await coreCollectionContractB.initialized()).to.be.equal(true)
        })
      })
    })
  })

  describe('Create Project and Add collection', () => {
    let coreFactory, receipt

    before(async () => {
      ;[, coreFactory] = await deployCoreContracts(splitFactory.address)

      const createProjectA = await coreFactory
        .connect(alice)
        .createProject(projectA.id, [collectionA])
      receipt = await createProjectA.wait()
    })

    it('Should revert msg.sender is not an project owner', async () => {
      await expect(
        coreFactory.connect(bob).addCollection(projectA.id, collectionB),
      ).to.be.revertedWith('CoreFactory: Not an owner of the project')
    })

    describe('Create Collection', () => {
      let coreCollectionContract, addCollectionReceipt

      before(async () => {
        const addCollectionB = await coreFactory.addCollection(
          projectA.id,
          collectionB,
        )
        addCollectionReceipt = await addCollectionB.wait()
        const collection = await coreFactory.collections(collectionB.id)
        coreCollectionContract = getContract(collection, CoreCollectionABI)
      })

      it('Should revert transaction for same collectionId', async () => {
        await expect(
          coreFactory.addCollection(projectA.id, collectionA),
        ).to.be.revertedWith('CoreFactory: Unavailable collection id')
      })

      it('Should create collection with correct name', async () => {
        expect(await coreCollectionContract.name()).to.be.equal(
          collectionB.name,
        )
      })

      it('Should emit a NewCollection event', async () => {
        const events = findEvents({
          receipt: addCollectionReceipt,
          eventName: 'NewCollection',
        })
        expect(events.length).to.equal(1)
        const { collectionId, collection, projectId } = events[0].args
        expect(collectionId).to.equal(collectionB.id)
        expect(collection).to.be.ok
        expect(projectId).to.equal(projectA.id)
      })

      it('Should not emit a NewProject event', async () => {
        const events = findEvents({
          receipt: addCollectionReceipt,
          eventName: 'NewProject',
        })
        expect(events.length).to.equal(0)
      })

      it('Should transfer ownership of collection contract to producer', async () => {
        expect(await coreCollectionContract.owner()).to.be.equal(
          projectA.creator,
        )
      })

      it('Should have correct symbol', async () => {
        expect(await coreCollectionContract.symbol()).to.be.equal(
          collectionB.symbol,
        )
      })

      it('Should have correct base URI', async () => {
        expect(await coreCollectionContract.baseURI()).to.be.equal(
          collectionB.baseURI,
        )
      })

      it('Should have correct max supply', async () => {
        expect(await coreCollectionContract.maxSupply()).to.be.equal(
          collectionB.maxSupply,
        )
      })

      it('Should have correct mint fee', async () => {
        expect(await coreCollectionContract.mintFee()).to.be.equal(
          collectionB.mintFee,
        )
      })

      it('Should have correct payable token', async () => {
        expect(await coreCollectionContract.payableToken()).to.be.equal(
          collectionB.payableToken,
        )
      })

      it('Should have correct merkle root', async () => {
        expect(await coreCollectionContract.getMerkleRoot()).to.be.equal(
          collectionB.claimsMerkleRoot,
        )
      })

      it('Should have correct split factory', async () => {
        expect(await coreCollectionContract.splitFactory()).to.be.equal(
          splitFactory.address,
        )
      })

      it('Should have correct initialized', async () => {
        expect(await coreCollectionContract.initialized()).to.be.equal(true)
      })
    })
  })
})
