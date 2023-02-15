const { ethers, upgrades, run } = require('hardhat')

const fs = require('fs-extra')
const path = require('path')
const createLockHash = require('../helpers/createLockCalldata')

// files path
const contractsPath = path.resolve(
  __dirname,
  '..',
  '..',
  'contracts',
  'past-versions'
)
const artifactsPath = path.resolve(
  __dirname,
  '..',
  '..',
  'artifacts',
  'contracts',
  'past-versions'
)

const versionsCount = 10
let unlock

contract('Unlock / upgrades', async (accounts) => {
  const [unlockOwner, lockOwner, keyOwner] = await ethers.getSigners()
  const keyPrice = web3.utils.toWei('0.01', 'ether')

  for (let versionNumber = 0; versionNumber < versionsCount; versionNumber++) {
    // skip the missing contracts (with flattening problems to be solved)
    if (versionNumber === 2 || versionNumber === 5) versionNumber++

    describe(`Testing version ${versionNumber}`, () => {
      let Unlock
      let UnlockLatest
      let PublicLockLatest

      let originalLockData

      const pastUnlockPath = require.resolve(
        `@unlock-protocol/contracts/dist/Unlock/UnlockV${versionNumber}.sol`
      )
      const pastPublicLockPath = require.resolve(
        `@unlock-protocol/contracts/dist/PublicLock/PublicLockV${versionNumber}.sol`
      )

      before(async function copyAndBuildContract() {
        // make sure mocha doesnt time out
        this.timeout(200000)

        // copy all versions over
        await fs.copy(
          pastUnlockPath,
          path.resolve(contractsPath, `UnlockV${versionNumber}.sol`)
        )

        await fs.copy(
          pastPublicLockPath,
          path.resolve(contractsPath, `PublicLockV${versionNumber}.sol`)
        )

        // re-compile contract using hardhat
        await run('compile')
      })

      after(async () => {
        await fs.remove(contractsPath)
        await fs.remove(artifactsPath)
      })

      beforeEach(async () => {
        UnlockLatest = await ethers.getContractFactory(
          'contracts/Unlock.sol:Unlock'
        )
        PublicLockLatest = await ethers.getContractFactory(
          'contracts/PublicLock.sol:PublicLock'
        )

        Unlock = await ethers.getContractFactory(
          `contracts/past-versions/UnlockV${versionNumber}.sol:Unlock`
        )

        // deploy instance
        unlock = await upgrades.deployProxy(Unlock, [unlockOwner.address])
      })

      it('Unlock version is set', async () => {
        if (versionNumber >= 2) {
          // Version numbers were introduced to Unlock with v2
          const version = await unlock.unlockVersion()
          assert.equal(version, versionNumber)
        }
      })

      it('this version and latest version have different Unlock bytecode', async () => {
        assert.notEqual(UnlockLatest.bytecode, Unlock.bytecode)
      })

      it('Unlock has an owner', async () => {
        const owner = await unlock.owner()
        assert.equal(owner, unlockOwner.address)
      })

      if (versionsCount && versionNumber <= versionsCount) {
        describe('Complete PublicLock configuration if require', () => {
          let publicLock
          let publicLockTemplate

          beforeEach(async () => {
            publicLock = await ethers.getContractFactory(
              `contracts/past-versions/PublicLockV${versionNumber}.sol:PublicLock`
            )

            if (versionNumber >= 5) {
              // The lock minimal proxy was introduced with version 5
              publicLockTemplate = await publicLock.deploy()

              if (versionNumber >= 7) {
                // Version 7 moved setLockTemplate to its own function
                await unlock.setLockTemplate(publicLockTemplate.address)
              } else {
                await unlock.configUnlock(publicLockTemplate.address, '', '')
              }
            }
          })

          it('this version and latest version have different PublicLock bytecode', async () => {
            assert.notEqual(PublicLockLatest.bytecode, publicLock.bytecode)
          })

          describe('Create a lock for testing', async () => {
            let lock

            beforeEach(async () => {
              // Create Lock
              let lockTx

              if (versionNumber >= 10) {
                const args = [
                  60 * 60 * 24, // expirationDuration 1 day
                  web3.utils.padLeft(0, 40), // token address
                  keyPrice,
                  5, // maxNumberOfKeys
                  'UpgradeTestingLock',
                ]
                const calldata = await createLockHash({ args })
                lockTx = await unlock.connect(lockOwner).createLock(calldata)
              } else if (versionNumber >= 5) {
                // Version 5 introduced `create2`, requiring a salt
                lockTx = await unlock.connect(lockOwner).createLock(
                  60 * 60 * 24, // expirationDuration 1 day
                  web3.utils.padLeft(0, 40), // token address
                  keyPrice,
                  5, // maxNumberOfKeys
                  'UpgradeTestingLock',
                  web3.utils.randomHex(12)
                )
              } else if (versionNumber >= 3) {
                // Version 3 added a lock name
                lockTx = await unlock.connect(lockOwner).createLock(
                  60 * 60 * 24, // expirationDuration 1 day
                  web3.utils.padLeft(0, 40), // token address
                  keyPrice,
                  5, // maxNumberOfKeys
                  'UpgradeTestingLock'
                )
              } else if (versionNumber >= 1) {
                // Version 1 added ERC-20 support, requiring a tokenAddress
                lockTx = await unlock.connect(lockOwner).createLock(
                  60 * 60 * 24, // expirationDuration 1 day
                  web3.utils.padLeft(0, 40), // token address
                  keyPrice,
                  5 // maxNumberOfKeys
                )
              } else {
                lockTx = await unlock.connect(lockOwner).createLock(
                  60 * 60 * 24, // expirationDuration 1 day
                  keyPrice,
                  5 // maxNumberOfKeys
                )
              }

              const { events } = await lockTx.wait()
              const evt = events.find(({ event }) => event === 'NewLock')
              // console.log(`lock created at ${evt.args.newLockAddress}`)
              lock = await publicLock.attach(evt.args.newLockAddress)
            })

            it('PublicLock version is set', async () => {
              if (versionNumber >= 1) {
                // Version numbers were introduced to PublicLock with v1
                const templateVersion = await lock.publicLockVersion()
                const version =
                  typeof templateVersion !== 'number'
                    ? templateVersion.toNumber()
                    : templateVersion
                if (versionNumber === 2) {
                  // version 2 had a bug: we forgot to bump the lock version
                  assert.equal(version, 1)
                } else if (versionNumber === 9) {
                  // unlock 9 uses lock 8
                  assert.equal(version, 8)
                } else {
                  assert.equal(version, versionNumber)
                }
              }
            })

            describe('Purchase a key', () => {
              beforeEach(async () => {
                // Buy Key
                await purchaseKey(lock)

                // Record sample lock data
                originalLockData = await unlock.locks(lock.address)
              })

              it('Key has an ID', async () => {
                const id = await lock.getTokenIdFor(keyOwner.address)
                assert.notEqual(id, 0)
              })

              it('Key is owned', async () => {
                if (versionNumber >= 1) {
                  // isKeyOwner was introduced in v1
                  const id = await lock.getTokenIdFor(keyOwner.address)
                  const isOwned = await lock.isKeyOwner(id, keyOwner.address)
                  assert.equal(isOwned, true)
                }
              })

              describe('Upgrade Unlock to latest version', () => {
                beforeEach(async () => {
                  // upgrade proxy to latest
                  unlock = await upgrades.upgradeProxy(
                    unlock.address,
                    UnlockLatest,
                    { unsafeAllowRenames: true }
                  )

                  // lock template
                  const publicLockLatestTemplate =
                    await PublicLockLatest.deploy()
                  await publicLockLatestTemplate.deployed()

                  // set template
                  const version =
                    await publicLockLatestTemplate.publicLockVersion()
                  await unlock.initializeProxyAdmin()
                  await unlock.addLockTemplate(
                    publicLockLatestTemplate.address,
                    version
                  )
                  await unlock.setLockTemplate(publicLockLatestTemplate.address)
                })

                it('this version and latest version have different Unlock version numbers', async () => {
                  const version = await unlock.unlockVersion()
                  assert.notEqual(version, versionNumber)
                })

                it('latest version number is correct', async () => {
                  const version = await await unlock.unlockVersion()
                  assert.equal(version, versionsCount)
                })

                it('Key id still set', async () => {
                  const id = await lock.getTokenIdFor(keyOwner.address)
                  assert.notEqual(id, 0)
                })

                it('Key is still owned', async () => {
                  // console.log(keyOwner)
                  const id = await lock.getTokenIdFor(keyOwner.address)
                  if (versionNumber >= 1) {
                    // isKeyOwner was introduced in v1
                    const bool = await lock.isKeyOwner(id, keyOwner.address)
                    assert.equal(bool, true)
                  }
                })

                it('New keys may still be purchased', async () => {
                  if (versionNumber >= 1) {
                    // version 0 purchases no longer work due to a change in Unlock.sol
                    await purchaseKey(lock)
                  }
                })

                it('Keys may still be transferred', async () => {
                  const tx = await lock
                    .connect(keyOwner)
                    .transferFrom(
                      keyOwner.address,
                      accounts[8],
                      await lock.getTokenIdFor(keyOwner.address)
                    )
                  const { events } = await tx.wait()
                  const evt = events.find(({ event }) => event === 'Transfer')
                  assert.equal(evt.event, 'Transfer')
                })

                it('grossNetworkProduct remains', async () => {
                  const grossNetworkProduct = await unlock.grossNetworkProduct()
                  assert.equal(grossNetworkProduct, keyPrice)
                })

                it('lock data should persist state between upgrades', async () => {
                  const resultsAfter = await unlock.locks(lock.address)

                  assert.equal(resultsAfter.deployed, originalLockData.deployed)
                  assert.equal(
                    resultsAfter.yieldedDiscountTokens.toString(),
                    originalLockData.yieldedDiscountTokens.toString()
                  )
                })

                it('tokenURI still works as expected', async () => {
                  if (versionNumber >= 3) {
                    // tokenURI was introduced with v3
                    await lock.tokenURI(1)
                  }
                })

                describe('Using latest version after an upgrade', () => {
                  let lockLatest

                  beforeEach(async () => {
                    // Create a new Lock
                    const args = [
                      60 * 60 * 24, // expirationDuration 1 day
                      web3.utils.padLeft(0, 40),
                      keyPrice,
                      5, // maxNumberOfKeys
                      'After-Upgrade Lock',
                    ]
                    const calldata = await createLockHash({ args })
                    const lockLatestTx = await unlock.createLock(calldata)

                    const { events } = await lockLatestTx.wait()
                    const evt = events.find(({ event }) => event === 'NewLock')

                    lockLatest = await PublicLockLatest.attach(
                      evt.args.newLockAddress
                    )

                    // Buy Key
                    await lockLatest.purchase(
                      0,
                      keyOwner.address,
                      web3.utils.padLeft(0, 40),
                      [],
                      { value: keyPrice }
                    )
                  })

                  it('this version and latest version have different PublicLock version numbers', async () => {
                    if (versionNumber !== versionsCount - 1) {
                      // ignore last version
                      const version = await lockLatest.publicLockVersion()
                      assert.notEqual(await version, versionNumber)
                    }
                  })

                  it('grossNetworkProduct sums previous version purchases with new version purchases', async () => {
                    const grossNetworkProduct =
                      await unlock.grossNetworkProduct()
                    assert.equal(
                      grossNetworkProduct.eq(
                        ethers.BigNumber.from(keyPrice).mul(2)
                      ),
                      true
                    )
                  })

                  it('Latest Key is owned', async () => {
                    const id = await lockLatest.getTokenIdFor(keyOwner.address)
                    assert.equal(await lockLatest.ownerOf(id), keyOwner.address)
                  })

                  it('Latest publicLock version is correct', async () => {
                    const publicLockVersion = await (
                      await lockLatest.publicLockVersion()
                    ).toString()
                    assert.equal(publicLockVersion, versionsCount - 1)
                  })
                })
              })
            })
          })
        })
      }
      async function purchaseKey(lock) {
        if (versionNumber >= 5) {
          // Version 5 renamed to purchase, added keyPrice, referrer, and data
          return await lock
            .connect(lockOwner)
            .purchase(0, keyOwner.address, web3.utils.padLeft(0, 40), [], {
              value: keyPrice,
            })
        }
        if (versionNumber >= 1) {
          // Version 1 removed the keyData field
          return await lock.connect(lockOwner).purchaseFor(keyOwner.address, {
            value: keyPrice,
          })
        }

        return await lock
          .connect(keyOwner)
          .purchaseFor(keyOwner.address, web3.utils.toHex('Julien'), {
            value: keyPrice,
          })
      }
    })
  }
})
