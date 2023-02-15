import { expect } from 'chai'
import { ethers } from 'hardhat'
import { MerkleTree } from 'merkletreejs'
import { MockAccountAccessController } from '../typechain'
import { mockAccountAccessControllerFixture } from './fixtures/AccountAccessControllerFixture'
import { hashAddress, generateMerkleTree, revertReason } from './utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import {
    getAccountAllowedEvent,
    getAccountBlockedEvent,
    getRootChangedEvent,
    getAllowedAccountsClearedEvent,
    getBlockedAccountsClearedEvent,
} from './events'

describe('=> AccountAccessController', function () {
    let eligibleSigners: SignerWithAddress[]
    let ineligibleSigners: SignerWithAddress[]
    let eligibleAddresses: string[]
    let ineligibleAddresses: string[]
    let merkleTree: MerkleTree
    let accountAccessController: MockAccountAccessController
    beforeEach(async () => {
        const signers = await ethers.getSigners()
        eligibleSigners = signers.slice(0, 5)
        ineligibleSigners = signers.slice(5, 10)
        eligibleAddresses = Array.from(
            eligibleSigners,
            (signer) => signer.address
        )
        ineligibleAddresses = Array.from(
            ineligibleSigners,
            (signer) => signer.address
        )
        merkleTree = generateMerkleTree(eligibleAddresses)
        accountAccessController = await mockAccountAccessControllerFixture()
    })

    describe('# setRoot', () => {
        let newMerkleRoot: string
        beforeEach(async () => {
            const merkleTree = generateMerkleTree(ineligibleAddresses)
            newMerkleRoot = merkleTree.getHexRoot()
        })

        it('should only be usable by the owner', async () => {
            expect(await accountAccessController.owner()).to.not.eq(
                eligibleSigners[1].address
            )

            await expect(
                accountAccessController
                    .connect(eligibleSigners[1])
                    .setRoot(newMerkleRoot)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to a new root', async () => {
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )
            expect(await accountAccessController.getRoot()).to.not.eq(
                newMerkleRoot
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .setRoot(newMerkleRoot)

            expect(await accountAccessController.getRoot()).to.eq(
                newMerkleRoot
            )
        })

        it('should be settable to the same root twice', async () => {
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )
            expect(await accountAccessController.getRoot()).to.not.eq(
                newMerkleRoot
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .setRoot(newMerkleRoot)

            expect(await accountAccessController.getRoot()).to.eq(
                newMerkleRoot
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .setRoot(newMerkleRoot)

            expect(await accountAccessController.getRoot()).to.eq(
                newMerkleRoot
            )
        })

        it('should emit a RootChanged event', async () => {
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .setRoot(newMerkleRoot)

            const event = await getRootChangedEvent(accountAccessController)
            expect(event.args.root).to.eq(newMerkleRoot)
        })
    })

    describe('# setRootAndClearAllowedAccounts', () => {
        let newMerkleRoot: string
        beforeEach(async () => {
            const merkleTree = generateMerkleTree(ineligibleAddresses)
            newMerkleRoot = merkleTree.getHexRoot()
        })

        it('should only be usable by the owner', async () => {
            expect(await accountAccessController.owner()).to.not.eq(
                eligibleSigners[1].address
            )

            await expect(
                accountAccessController
                    .connect(eligibleSigners[1])
                    .setRootAndClearAllowedAccounts(newMerkleRoot)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should change the root and reset allowed accounts', async () => {
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )
            expect(await accountAccessController.getRoot()).to.not.eq(
                newMerkleRoot
            )
            const indexBefore =
                await accountAccessController.getAllowedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .setRootAndClearAllowedAccounts(newMerkleRoot)

            expect(await accountAccessController.getRoot()).to.eq(
                newMerkleRoot
            )
            expect(
                await accountAccessController.getAllowedAccountsIndex()
            ).to.eq(indexBefore + 1)
        })

        it('should be able to set the same root twice and reset allowed accounts', async () => {
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )
            expect(await accountAccessController.getRoot()).to.not.eq(
                newMerkleRoot
            )
            let indexBefore =
                await accountAccessController.getAllowedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .setRootAndClearAllowedAccounts(newMerkleRoot)

            expect(await accountAccessController.getRoot()).to.eq(
                newMerkleRoot
            )
            expect(
                await accountAccessController.getAllowedAccountsIndex()
            ).to.eq(indexBefore + 1)
            indexBefore =
                await accountAccessController.getAllowedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .setRootAndClearAllowedAccounts(newMerkleRoot)

            expect(await accountAccessController.getRoot()).to.eq(
                newMerkleRoot
            )
            expect(
                await accountAccessController.getAllowedAccountsIndex()
            ).to.eq(indexBefore + 1)
        })

        it('should emit an AllowedAccountsCleared and RootChanged event', async () => {
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )
            const indexBefore =
                await accountAccessController.getAllowedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .setRootAndClearAllowedAccounts(newMerkleRoot)

            const allowedAccountsClearedEvent =
                await getAllowedAccountsClearedEvent(accountAccessController)
            expect(allowedAccountsClearedEvent.args.index).to.eq(
                indexBefore + 1
            )
            const rootChangedEvent = await getRootChangedEvent(
                accountAccessController
            )
            expect(rootChangedEvent.args.root).to.eq(newMerkleRoot)
        })
    })

    describe('# allowSelf', () => {
        it("should not allow accounts when the root isn't set", async () => {
            expect(await accountAccessController.getRoot()).to.eq(
                ethers.utils.hexZeroPad([], 32)
            )

            for (const signer of eligibleSigners) {
                await expect(
                    accountAccessController.connect(signer).allowSelf([])
                ).to.be.revertedWith(revertReason('Invalid proof'))
            }
        })

        it('should allow caller if eligible', async () => {
            await accountAccessController.setRoot(merkleTree.getHexRoot())
            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountAllowed(
                        signer.address
                    )
                ).to.be.eq(false)
                const proof = merkleTree.getHexProof(
                    hashAddress(signer.address)
                )

                await accountAccessController.connect(signer).allowSelf(proof)

                expect(
                    await accountAccessController.isAccountAllowed(
                        signer.address
                    )
                ).to.be.eq(true)
            }
        })

        it('should not allow caller if ineligible', async () => {
            await accountAccessController.setRoot(merkleTree.getHexRoot())
            for (const signer of ineligibleSigners) {
                expect(
                    await accountAccessController.isAccountAllowed(
                        signer.address
                    )
                ).to.be.eq(false)
                const proof = merkleTree.getHexProof(
                    hashAddress(signer.address)
                )

                await expect(
                    accountAccessController.connect(signer).allowSelf(proof)
                ).to.be.revertedWith(revertReason('Invalid proof'))

                expect(
                    await accountAccessController.isAccountAllowed(
                        signer.address
                    )
                ).to.be.eq(false)
            }
        })

        it('should not allow the caller to register more than once', async () => {
            await accountAccessController.setRoot(merkleTree.getHexRoot())
            const proof = merkleTree.getHexProof(
                hashAddress(eligibleSigners[0].address)
            )
            await accountAccessController
                .connect(eligibleSigners[0])
                .allowSelf(proof)
            expect(
                await accountAccessController.isAccountAllowed(
                    eligibleSigners[0].address
                )
            ).to.be.eq(true)

            await expect(
                accountAccessController
                    .connect(eligibleSigners[0])
                    .allowSelf(proof)
            ).to.be.revertedWith(revertReason('Account already registered'))
        })

        it('should emit an AccountAllowed event', async () => {
            await accountAccessController.setRoot(merkleTree.getHexRoot())
            for (const signer of eligibleSigners) {
                const proof = merkleTree.getHexProof(
                    hashAddress(signer.address)
                )

                await accountAccessController.connect(signer).allowSelf(proof)

                const event = await getAccountAllowedEvent(
                    accountAccessController,
                    signer.address
                )
                expect(event.args.account).to.eq(signer.address)
            }
        })
    })

    describe('# allowAccounts', () => {
        it('should only be usable by the owner', async () => {
            expect(await accountAccessController.owner()).to.not.eq(
                eligibleSigners[1].address
            )

            await expect(
                accountAccessController
                    .connect(eligibleSigners[1])
                    .allowAccounts(eligibleAddresses)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be able to allow an account', async () => {
            expect(
                await accountAccessController.isAccountAllowed(
                    eligibleSigners[0].address
                )
            ).to.be.eq(false)
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .allowAccounts([eligibleAddresses[0]])

            expect(
                await accountAccessController.isAccountAllowed(
                    eligibleSigners[0].address
                )
            ).to.be.eq(true)
        })

        it('should be able to allow multiple accounts', async () => {
            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountAllowed(
                        signer.address
                    )
                ).to.be.eq(false)
            }
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .allowAccounts(eligibleAddresses)

            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountAllowed(
                        signer.address
                    )
                ).to.be.eq(true)
            }
        })

        it('should be able to allow already allowed accounts', async () => {
            await accountAccessController
                .connect(eligibleSigners[0])
                .allowAccounts(eligibleAddresses)
            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountAllowed(
                        signer.address
                    )
                ).to.be.eq(true)
            }
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .allowAccounts(eligibleAddresses)

            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountAllowed(
                        signer.address
                    )
                ).to.be.eq(true)
            }
        })

        it('should emit an AccountAllowed event for each account', async () => {
            await accountAccessController
                .connect(eligibleSigners[0])
                .allowAccounts(eligibleAddresses)

            for (const signer of eligibleSigners) {
                const event = await getAccountAllowedEvent(
                    accountAccessController,
                    signer.address
                )
                expect(event.args.account).to.eq(signer.address)
            }
        })
    })

    describe('# blockAccounts', () => {
        it('should only be usable by the owner', async () => {
            expect(await accountAccessController.owner()).to.not.eq(
                eligibleSigners[1].address
            )

            await expect(
                accountAccessController
                    .connect(eligibleSigners[1])
                    .blockAccounts(eligibleAddresses)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be able to block an account', async () => {
            expect(
                await accountAccessController.isAccountBlocked(
                    eligibleSigners[0].address
                )
            ).to.be.eq(false)
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .blockAccounts([eligibleAddresses[0]])

            expect(
                await accountAccessController.isAccountBlocked(
                    eligibleSigners[0].address
                )
            ).to.be.eq(true)
        })

        it('should be able to block multiple accounts', async () => {
            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountBlocked(
                        signer.address
                    )
                ).to.be.eq(false)
            }
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .blockAccounts(eligibleAddresses)

            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountBlocked(
                        signer.address
                    )
                ).to.be.eq(true)
            }
        })

        it('should be able to block already blocked accounts', async () => {
            await accountAccessController
                .connect(eligibleSigners[0])
                .blockAccounts(eligibleAddresses)
            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountBlocked(
                        signer.address
                    )
                ).to.be.eq(true)
            }
            expect(await accountAccessController.owner()).to.eq(
                eligibleSigners[0].address
            )

            await accountAccessController
                .connect(eligibleSigners[0])
                .blockAccounts(eligibleAddresses)

            for (const signer of eligibleSigners) {
                expect(
                    await accountAccessController.isAccountBlocked(
                        signer.address
                    )
                ).to.be.eq(true)
            }
        })

        it('should emit an AccountBlocked event for each account', async () => {
            await accountAccessController
                .connect(eligibleSigners[0])
                .blockAccounts(eligibleAddresses)

            for (const signer of eligibleSigners) {
                const event = await getAccountBlockedEvent(
                    accountAccessController,
                    signer.address
                )
                expect(event.args.account).to.eq(signer.address)
            }
        })
    })

    describe('# clearAllowedAccounts', () => {
        it('should only be usable by the owner', async () => {
            expect(await accountAccessController.owner()).to.not.eq(
                eligibleSigners[1].address
            )

            await expect(
                accountAccessController
                    .connect(eligibleSigners[1])
                    .clearAllowedAccounts()
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should increment the allowlist index', async () => {
            let indexBefore =
                await accountAccessController.getAllowedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .clearAllowedAccounts()

            expect(
                await accountAccessController.getAllowedAccountsIndex()
            ).to.eq(indexBefore + 1)
            indexBefore =
                await accountAccessController.getAllowedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .clearAllowedAccounts()

            expect(
                await accountAccessController.getAllowedAccountsIndex()
            ).to.eq(indexBefore + 1)
        })

        it('should clear the allowed status of all accounts', async () => {
            await accountAccessController
                .connect(eligibleSigners[0])
                .allowAccounts(eligibleAddresses)
            for (const account of eligibleAddresses) {
                expect(
                    await accountAccessController.isAccountAllowed(account)
                ).to.be.eq(true)
            }

            await accountAccessController
                .connect(eligibleSigners[0])
                .clearAllowedAccounts()

            for (const account of eligibleAddresses) {
                expect(
                    await accountAccessController.isAccountAllowed(account)
                ).to.be.eq(false)
            }
        })

        it('should emit an AllowedAccountsCleared event', async () => {
            const indexBefore =
                await accountAccessController.getAllowedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .clearAllowedAccounts()

            const event = await getAllowedAccountsClearedEvent(
                accountAccessController
            )
            expect(event.args.index).to.eq(indexBefore + 1)
        })
    })

    describe('# clearBlockedAccounts', () => {
        it('should only be usable by the owner', async () => {
            expect(await accountAccessController.owner()).to.not.eq(
                eligibleSigners[1].address
            )

            await expect(
                accountAccessController
                    .connect(eligibleSigners[1])
                    .clearBlockedAccounts()
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should increment the blocklist index', async () => {
            let indexBefore =
                await accountAccessController.getBlockedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .clearBlockedAccounts()

            expect(
                await accountAccessController.getBlockedAccountsIndex()
            ).to.eq(indexBefore + 1)
            indexBefore =
                await accountAccessController.getBlockedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .clearBlockedAccounts()

            expect(
                await accountAccessController.getBlockedAccountsIndex()
            ).to.eq(indexBefore + 1)
        })

        it('should clear the blocked status of all accounts', async () => {
            await accountAccessController
                .connect(eligibleSigners[0])
                .blockAccounts(eligibleAddresses)
            for (const account of eligibleAddresses) {
                expect(
                    await accountAccessController.isAccountBlocked(account)
                ).to.be.eq(true)
            }

            await accountAccessController
                .connect(eligibleSigners[0])
                .clearBlockedAccounts()

            for (const account of eligibleAddresses) {
                expect(
                    await accountAccessController.isAccountBlocked(account)
                ).to.be.eq(false)
            }
        })

        it('should emit an BlockedAccountsCleared event', async () => {
            const indexBefore =
                await accountAccessController.getBlockedAccountsIndex()

            await accountAccessController
                .connect(eligibleSigners[0])
                .clearBlockedAccounts()

            const event = await getBlockedAccountsClearedEvent(
                accountAccessController
            )
            expect(event.args.index).to.eq(indexBefore + 1)
        })
    })
})
