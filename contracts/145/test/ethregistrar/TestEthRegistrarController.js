const {
  evm,
  reverse: { getReverseNode },
  contracts: { deploy },
} = require('../test-utils')

const { expect } = require('chai')

const { ethers } = require('hardhat')
const provider = ethers.provider
const namehash = require('eth-ens-namehash')
const sha3 = require('web3-utils').sha3

const DAYS = 24 * 60 * 60
const REGISTRATION_TIME = 28 * DAYS
const BUFFERED_REGISTRATION_COST = REGISTRATION_TIME + 3 * DAYS
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const EMPTY_BYTES =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

contract('ETHRegistrarController', function() {
  let ens
  let resolver
  let resolver2 // resolver signed by accounts[1]
  let baseRegistrar
  let controller
  let controller2 // controller signed by accounts[1]
  let priceOracle
  let reverseRegistrar
  let nameWrapper

  const secret =
    '0x0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF'
  let ownerAccount // Account that owns the registrar
  let registrantAccount // Account that owns test names
  let accounts = []

  async function registerName(
    name,
    txOptions = { value: BUFFERED_REGISTRATION_COST }
  ) {
    var commitment = await controller.makeCommitment(
      name,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      NULL_ADDRESS,
      [],
      false,
      0,
      0
    )
    var tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
      (await provider.getBlock(tx.blockNumber)).timestamp
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())

    var tx = await controller.register(
      name,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      NULL_ADDRESS,
      [],
      false,
      0,
      0,
      txOptions
    )

    return tx
  }

  before(async () => {
    signers = await ethers.getSigners()
    ownerAccount = await signers[0].getAddress()
    registrantAccount = await signers[1].getAddress()
    accounts = [ownerAccount, registrantAccount, signers[2].getAddress()]

    ens = await deploy('ENSRegistry')

    baseRegistrar = await deploy(
      'BaseRegistrarImplementation',
      ens.address,
      namehash.hash('eth')
    )

    nameWrapper = await deploy(
      'NameWrapper',
      ens.address,
      baseRegistrar.address,
      ownerAccount
    )

    reverseRegistrar = await deploy('ReverseRegistrar', ens.address)

    await ens.setSubnodeOwner(EMPTY_BYTES, sha3('eth'), baseRegistrar.address)

    const dummyOracle = await deploy('DummyOracle', '100000000')
    priceOracle = await deploy('StablePriceOracle', dummyOracle.address, [
      0,
      0,
      4,
      2,
      1,
    ])
    controller = await deploy(
      'ETHRegistrarController',
      baseRegistrar.address,
      priceOracle.address,
      600,
      86400,
      reverseRegistrar.address,
      nameWrapper.address
    )

    controller2 = controller.connect(signers[1])
    await baseRegistrar.addController(controller.address)
    await nameWrapper.setController(controller.address, true)
    await baseRegistrar.addController(nameWrapper.address)
    await reverseRegistrar.setController(controller.address, true)

    resolver = await deploy(
      'PublicResolver',
      ens.address,
      nameWrapper.address,
      controller.address,
      reverseRegistrar.address
    )

    resolver2 = await resolver.connect(signers[1])

    await ens.setSubnodeOwner(EMPTY_BYTES, sha3('reverse'), accounts[0], {
      from: accounts[0],
    })
    await ens.setSubnodeOwner(
      namehash.hash('reverse'),
      sha3('addr'),
      reverseRegistrar.address,
      { from: accounts[0] }
    )
  })

  beforeEach(async () => {
    result = await ethers.provider.send('evm_snapshot')
  })
  afterEach(async () => {
    await ethers.provider.send('evm_revert', [result])
  })

  const checkLabels = {
    testing: true,
    longname12345678: true,
    sixsix: true,
    five5: true,
    four: true,
    iii: true,
    ii: false,
    i: false,
    '': false,

    // { ni } { hao } { ma } (chinese; simplified)
    你好吗: true,

    // { ta } { ko } (japanese; hiragana)
    たこ: false,

    // { poop } { poop } { poop } (emoji)
    '\ud83d\udca9\ud83d\udca9\ud83d\udca9': true,

    // { poop } { poop } (emoji)
    '\ud83d\udca9\ud83d\udca9': false,
  }

  it('should report label validity', async () => {
    for (const label in checkLabels) {
      expect(await controller.valid(label)).to.equal(checkLabels[label], label)
    }
  })

  it('should report unused names as available', async () => {
    expect(await controller.available(sha3('available'))).to.equal(true)
  })

  it('should permit new registrations', async () => {
    const name = 'newname'
    const balanceBefore = await web3.eth.getBalance(controller.address)
    const tx = await registerName(name)
    const block = await provider.getBlock(tx.blockNumber)
    await expect(tx)
      .to.emit(controller, 'NameRegistered')
      .withArgs(
        name,
        sha3(name),
        registrantAccount,
        REGISTRATION_TIME,
        0,
        block.timestamp + REGISTRATION_TIME
      )

    expect(
      (await web3.eth.getBalance(controller.address)) - balanceBefore
    ).to.equal(REGISTRATION_TIME)
  })

  it('should revert when not enough ether is transferred', async () => {
    await expect(registerName('newname', { value: 0 })).to.be.revertedWith(
      'ETHRegistrarController: Not enough ether provided'
    )
  })

  it('should report registered names as unavailable', async () => {
    const name = 'newname'
    await registerName(name)
    expect(await controller.available(name)).to.equal(false)
  })

  it('should permit new registrations with resolver and records', async () => {
    var commitment = await controller.makeCommitment(
      'newconfigname',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          namehash.hash('newconfigname.eth'),
          registrantAccount,
        ]),
        resolver.interface.encodeFunctionData('setText', [
          namehash.hash('newconfigname.eth'),
          'url',
          'ethereum.com',
        ]),
      ],
      false,
      0,
      0
    )
    var tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
      (await web3.eth.getBlock(tx.blockNumber)).timestamp
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    var balanceBefore = await web3.eth.getBalance(controller.address)
    var tx = await controller.register(
      'newconfigname',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          namehash.hash('newconfigname.eth'),
          registrantAccount,
        ]),
        resolver.interface.encodeFunctionData('setText', [
          namehash.hash('newconfigname.eth'),
          'url',
          'ethereum.com',
        ]),
      ],
      false,
      0,
      0,
      { value: BUFFERED_REGISTRATION_COST }
    )

    const block = await provider.getBlock(tx.blockNumber)

    await expect(tx)
      .to.emit(controller, 'NameRegistered')
      .withArgs(
        'newconfigname',
        sha3('newconfigname'),
        registrantAccount,
        REGISTRATION_TIME,
        0,
        block.timestamp + REGISTRATION_TIME
      )

    expect(
      (await web3.eth.getBalance(controller.address)) - balanceBefore
    ).to.equal(REGISTRATION_TIME)

    var nodehash = namehash.hash('newconfigname.eth')
    expect(await ens.resolver(nodehash)).to.equal(resolver.address)
    expect(await ens.owner(nodehash)).to.equal(nameWrapper.address)
    expect(await baseRegistrar.ownerOf(sha3('newconfigname'))).to.equal(
      nameWrapper.address
    )
    expect(await resolver['addr(bytes32)'](nodehash)).to.equal(
      registrantAccount
    )
    expect(await resolver['text'](nodehash, 'url')).to.equal('ethereum.com')
    expect(await nameWrapper.ownerOf(nodehash)).to.equal(registrantAccount)
  })

  it('should not permit new registrations with 0 resolver', async () => {
    await expect(
      controller.makeCommitment(
        'newconfigname',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [
          resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
            namehash.hash('newconfigname.eth'),
            registrantAccount,
          ]),
          resolver.interface.encodeFunctionData('setText', [
            namehash.hash('newconfigname.eth'),
            'url',
            'ethereum.com',
          ]),
        ],
        false,
        0,
        0
      )
    ).to.be.revertedWith(
      'ETHRegistrarController: resolver is required when data is supplied'
    )
  })

  it('should not permit new registrations with EoA resolver', async () => {
    const commitment = await controller.makeCommitment(
      'newconfigname',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      registrantAccount,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          namehash.hash('newconfigname.eth'),
          registrantAccount,
        ]),
        resolver.interface.encodeFunctionData('setText', [
          namehash.hash('newconfigname.eth'),
          'url',
          'ethereum.com',
        ]),
      ],
      false,
      0,
      0
    )

    const tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
      (await web3.eth.getBlock(tx.blockNumber)).timestamp
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    await expect(
      controller.register(
        'newconfigname',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        registrantAccount,
        [
          resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
            namehash.hash('newconfigname.eth'),
            registrantAccount,
          ]),
          resolver.interface.encodeFunctionData('setText', [
            namehash.hash('newconfigname.eth'),
            'url',
            'ethereum.com',
          ]),
        ],
        false,
        0,
        0,
        { value: BUFFERED_REGISTRATION_COST }
      )
    ).to.be.revertedWith('Address: call to non-contract')
  })

  it('should not permit new registrations with an incompatible contract', async () => {
    const commitment = await controller.makeCommitment(
      'newconfigname',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      controller.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          namehash.hash('newconfigname.eth'),
          registrantAccount,
        ]),
        resolver.interface.encodeFunctionData('setText', [
          namehash.hash('newconfigname.eth'),
          'url',
          'ethereum.com',
        ]),
      ],
      false,
      0,
      0
    )

    const tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
      (await web3.eth.getBlock(tx.blockNumber)).timestamp
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    await expect(
      controller.register(
        'newconfigname',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        controller.address,
        [
          resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
            namehash.hash('newconfigname.eth'),
            registrantAccount,
          ]),
          resolver.interface.encodeFunctionData('setText', [
            namehash.hash('newconfigname.eth'),
            'url',
            'ethereum.com',
          ]),
        ],
        false,
        0,
        0,
        { value: BUFFERED_REGISTRATION_COST }
      )
    ).to.be.revertedWith('ETHRegistrarController: Failed to set Record')
  })

  it('should not permit new registrations with records updating a different name', async () => {
    const commitment = await controller.makeCommitment(
      'awesome',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          namehash.hash('othername.eth'),
          registrantAccount,
        ]),
      ],
      false,
      0,
      0
    )
    const tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
      (await web3.eth.getBlock(tx.blockNumber)).timestamp
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())

    await expect(
      controller.register(
        'awesome',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        resolver.address,
        [
          resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
            namehash.hash('othername.eth'),
            registrantAccount,
          ]),
        ],
        false,
        0,
        0,
        { value: BUFFERED_REGISTRATION_COST }
      )
    ).to.be.revertedWith(
      'ETHRegistrarController: Namehash on record do not match the name being registered'
    )
  })

  it('should not permit new registrations with any record updating a different name', async () => {
    const commitment = await controller.makeCommitment(
      'awesome',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          namehash.hash('awesome.eth'),
          registrantAccount,
        ]),
        resolver.interface.encodeFunctionData(
          'setText(bytes32,string,string)',
          [namehash.hash('other.eth'), 'url', 'ethereum.com']
        ),
      ],
      false,
      0,
      0
    )
    const tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
      (await web3.eth.getBlock(tx.blockNumber)).timestamp
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())

    await expect(
      controller.register(
        'awesome',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        resolver.address,
        [
          resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
            namehash.hash('awesome.eth'),
            registrantAccount,
          ]),
          resolver.interface.encodeFunctionData(
            'setText(bytes32,string,string)',
            [namehash.hash('other.eth'), 'url', 'ethereum.com']
          ),
        ],
        false,
        0,
        0,
        { value: BUFFERED_REGISTRATION_COST }
      )
    ).to.be.revertedWith(
      'ETHRegistrarController: Namehash on record do not match the name being registered'
    )
  })

  it('should permit a registration with resolver but no records', async () => {
    const commitment = await controller.makeCommitment(
      'newconfigname2',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      false,
      0,
      0
    )
    let tx = await controller.commit(commitment)
    expect(await controller.commitments(commitment)).to.equal(
      (await web3.eth.getBlock(tx.blockNumber)).timestamp
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    const balanceBefore = await web3.eth.getBalance(controller.address)
    let tx2 = await controller.register(
      'newconfigname2',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      false,
      0,
      0,
      { value: BUFFERED_REGISTRATION_COST }
    )

    const block = await provider.getBlock(tx2.blockNumber)

    await expect(tx2)
      .to.emit(controller, 'NameRegistered')
      .withArgs(
        'newconfigname2',
        sha3('newconfigname2'),
        registrantAccount,
        REGISTRATION_TIME,
        0,
        block.timestamp + REGISTRATION_TIME
      )

    const nodehash = namehash.hash('newconfigname2.eth')
    expect(await ens.resolver(nodehash)).to.equal(resolver.address)
    expect(await resolver['addr(bytes32)'](nodehash)).to.equal(NULL_ADDRESS)
    expect(
      (await web3.eth.getBalance(controller.address)) - balanceBefore
    ).to.equal(REGISTRATION_TIME)
  })

  it('should include the owner in the commitment', async () => {
    await controller.commit(
      await controller.makeCommitment(
        'newname2',
        accounts[2],
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0,
        0
      )
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    await expect(
      controller.register(
        'newname2',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0,
        0,
        {
          value: BUFFERED_REGISTRATION_COST,
        }
      )
    ).to.be.reverted
  })

  it('should reject duplicate registrations', async () => {
    await registerName('newname')
    await controller.commit(
      await controller.makeCommitment(
        'newname',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0,
        0
      )
    )

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    expect(
      controller.register(
        'newname',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0,
        0,
        {
          value: BUFFERED_REGISTRATION_COST,
        }
      )
    ).to.be.revertedWith('ETHRegistrarController: Name is unavailable')
  })

  it('should reject for expired commitments', async () => {
    await controller.commit(
      await controller.makeCommitment(
        'newname2',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0,
        0
      )
    )

    await evm.advanceTime((await controller.maxCommitmentAge()).toNumber() + 1)
    expect(
      controller.register(
        'newname2',
        registrantAccount,
        REGISTRATION_TIME,
        secret,
        NULL_ADDRESS,
        [],
        false,
        0,
        0,
        {
          value: BUFFERED_REGISTRATION_COST,
        }
      )
    ).to.be.revertedWith('ETHRegistrarController: Commitment has expired')
  })

  it('should allow anyone to renew a name', async () => {
    await registerName('newname')
    var expires = await baseRegistrar.nameExpires(sha3('newname'))
    var balanceBefore = await web3.eth.getBalance(controller.address)
    const duration = 86400
    const [price] = await controller.rentPrice(sha3('newname'), duration)
    await controller.renew('newname', duration, { value: price })
    var newExpires = await baseRegistrar.nameExpires(sha3('newname'))
    expect(newExpires.toNumber() - expires.toNumber()).to.equal(86400)
    expect(
      (await web3.eth.getBalance(controller.address)) - balanceBefore
    ).to.equal(86400)
  })

  it('should require sufficient value for a renewal', async () => {
    expect(controller.renew('name', 86400)).to.be.revertedWith(
      'ETHController: Not enough Ether provided for renewal'
    )
  })

  it('should allow anyone to withdraw funds and transfer to the registrar owner', async () => {
    await controller.withdraw({ from: ownerAccount })
    expect(parseInt(await web3.eth.getBalance(controller.address))).to.equal(0)
  })

  it('should set the reverse record of the account', async () => {
    const commitment = await controller.makeCommitment(
      'reverse',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      true,
      0,
      0
    )
    await controller.commit(commitment)

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    await controller.register(
      'reverse',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      true,
      0,
      0,
      { value: BUFFERED_REGISTRATION_COST }
    )

    expect(await resolver.name(getReverseNode(ownerAccount))).to.equal(
      'reverse.eth'
    )
  })

  it('should not set the reverse record of the account when set to false', async () => {
    const commitment = await controller.makeCommitment(
      'noreverse',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      false,
      0,
      0
    )
    await controller.commit(commitment)

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    await controller.register(
      'noreverse',
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      false,
      0,
      0,
      { value: BUFFERED_REGISTRATION_COST }
    )

    expect(await resolver.name(getReverseNode(ownerAccount))).to.equal('')
  })

  it('should auto wrap the name and set the ERC721 owner to the wrapper', async () => {
    const label = 'wrapper'
    const name = label + '.eth'
    const commitment = await controller.makeCommitment(
      label,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      true,
      0,
      0
    )
    await controller.commit(commitment)

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    await controller.register(
      label,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      true,
      0,
      0,
      { value: BUFFERED_REGISTRATION_COST }
    )

    expect(await nameWrapper.ownerOf(namehash.hash(name))).to.equal(
      registrantAccount
    )

    expect(await ens.owner(namehash.hash(name))).to.equal(nameWrapper.address)
    expect(await baseRegistrar.ownerOf(sha3(label))).to.equal(
      nameWrapper.address
    )
  })

  it('should auto wrap the name and allow fuses and expiry to be set', async () => {
    const MAX_INT_64 = 2n ** 64n - 1n
    const label = 'fuses'
    const name = label + '.eth'
    const commitment = await controller.makeCommitment(
      label,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      true,
      1,
      MAX_INT_64
    )
    await controller.commit(commitment)

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())
    const tx = await controller.register(
      label,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [],
      true,
      1,
      MAX_INT_64, // max number for uint64, but wrapper expiry is block.timestamp + REGISTRATION_TIME
      { value: BUFFERED_REGISTRATION_COST }
    )

    const block = await provider.getBlock(tx.block)

    const [, fuses, expiry] = await nameWrapper.getData(namehash.hash(name))
    expect(fuses).to.equal(65)
    expect(expiry).to.equal(REGISTRATION_TIME + block.timestamp)
  })

  it('approval should reduce gas for registration', async () => {
    const label = 'other'
    const name = label + '.eth'
    const node = namehash.hash(name)
    const commitment = await controller.makeCommitment(
      label,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          node,
          registrantAccount,
        ]),
      ],
      true,
      1,
      0
    )

    await controller.commit(commitment)

    await evm.advanceTime((await controller.minCommitmentAge()).toNumber())

    const gasA = await controller2.estimateGas.register(
      label,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          node,
          registrantAccount,
        ]),
      ],
      true,
      1,
      0,
      { value: BUFFERED_REGISTRATION_COST }
    )

    await resolver2.setApprovalForAll(controller.address, true)

    const gasB = await controller2.estimateGas.register(
      label,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver2.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          node,
          registrantAccount,
        ]),
      ],
      true,
      1,
      0,
      { value: BUFFERED_REGISTRATION_COST }
    )

    const tx = await controller2.register(
      label,
      registrantAccount,
      REGISTRATION_TIME,
      secret,
      resolver2.address,
      [
        resolver.interface.encodeFunctionData('setAddr(bytes32,address)', [
          node,
          registrantAccount,
        ]),
      ],
      true,
      1,
      0,
      { value: BUFFERED_REGISTRATION_COST }
    )

    console.log((await tx.wait()).gasUsed.toString())

    console.log(gasA.toString(), gasB.toString())

    expect(await nameWrapper.ownerOf(node)).to.equal(registrantAccount)
    expect(await ens.owner(namehash.hash(name))).to.equal(nameWrapper.address)
    expect(await baseRegistrar.ownerOf(sha3(label))).to.equal(
      nameWrapper.address
    )
    expect(await resolver2['addr(bytes32)'](node)).to.equal(registrantAccount)
  })
})
