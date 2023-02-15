const { ethers, upgrades } = require('hardhat')
const { reverts } = require('truffle-assertions')

contract('proxyAdmin', () => {
  let unlock

  beforeEach(async () => {
    const Unlock = await ethers.getContractFactory('Unlock')
    const [unlockOwner] = await ethers.getSigners()
    unlock = await upgrades.deployProxy(Unlock, [unlockOwner.address], {
      initializer: 'initialize(address)',
    })
    await unlock.deployed()
  })

  it('is set by default', async () => {
    assert.notEqual(await unlock.proxyAdminAddress(), 0)
  })

  it('should set main contract as ProxyAdmin owner', async () => {
    const Unlock = await ethers.getContractFactory('Unlock')
    const [unlockOwner] = await ethers.getSigners()
    unlock = await upgrades.deployProxy(Unlock, [unlockOwner.address], {
      initializer: 'initialize(address)',
    })

    // make sure is has been set
    const proxyAdminAddress = await unlock.proxyAdminAddress()
    const proxyAdmin = await ethers.getContractAt(
      'TestProxyAdmin',
      proxyAdminAddress
    )
    assert.equal(await proxyAdmin.owner(), unlock.address)
  })

  it('forbid to deploy twice', async () => {
    reverts(unlock.initializeProxyAdmin(), 'ProxyAdmin already deployed')
  })
})
