const { expect } = require("chai");
const { BigNumber } = ethers
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const deployer = require('./deployer')

let fee = BigNumber.from(10)
const PRECISION = BigNumber.from(10000)
const _1e18 = ethers.constants.WeiPerEther

describe('GuestList', function() {
    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address

        bob = signers[8].address
        bobSigner = ethers.provider.getSigner(bob)

        pete = signers[10].address
        peteSigner = ethers.provider.getSigner(pete)

        feeSink = signers[9].address

        artifacts = await deployer.setupContracts(feeSink)
        ;({ curveLPToken, badgerPeak, bBTC, swap, sett, core } = artifacts)
    })

    it('setup GuestList', async function() {
        // don't include bob and feeSink
        _guestList = signers.slice(0, signers.length - 2).map(s => web3.utils.keccak256(s.address))
        merkleTree = new MerkleTree(_guestList, keccak256, { sortPairs: true })

        const GuestList = await ethers.getContractFactory("GuestList")
        guestList = await GuestList.deploy(bBTC.address)
        await Promise.all([
            guestList.setGuestRoot(merkleTree.getHexRoot()),
            guestList.setUserDepositCap(_1e18.mul(8)),
            guestList.setTotalDepositCap(_1e18.mul(9)),
            core.setGuestList(guestList.address)
        ])
    })

    it('mint sett LP', async function() {
        _sett = _1e18.mul(18)
        await Promise.all([
            curveLPToken.mint(alice, _sett),
            curveLPToken.approve(sett.address, _sett)
        ])
        await sett.deposit(_sett) // since gpps = 1, alice receives _sett number of sett LP tokens
        await sett.transfer(bob, _1e18.mul(4)) // will be utilized later
        await sett.transfer(pete, _1e18.mul(4)) // will be utilized later
    })

    it('invited guest (alice) can mint', async function() {
        const amount = _1e18.mul(8)

        await sett.approve(badgerPeak.address, amount)
        await badgerPeak.mint(0, amount, merkleTree.getHexProof(_guestList[0]))

        const bBtc = amount // since bBTC.pps() = 1
        const _fee = bBtc.mul(fee).div(PRECISION)
        const aliceBtc = bBtc.sub(_fee)

        expect(await sett.balanceOf(alice)).to.eq(_1e18.mul(2))
        expect(await sett.balanceOf(badgerPeak.address)).to.eq(amount)
        expect(await bBTC.balanceOf(alice)).to.eq(aliceBtc)
        expect(await core.accumulatedFee()).to.eq(_fee)
    })

    it('alice cannot mint more than userDepositCap', async function() {
        await sett.approve(badgerPeak.address, _1e18)
        await expect(
            badgerPeak.mint(0, _1e18, merkleTree.getHexProof(_guestList[0]))
        ).to.be.revertedWith('guest-list-authorization')
        await sett.approve(badgerPeak.address, 0)
    })

    it('raise userDepositCap', async function() {
        await guestList.setUserDepositCap(_1e18.mul(10))
        expect(await guestList.userDepositCap()).to.eq(_1e18.mul(10))
    })

    it('alice mints after userDepositCap raise', async function() {
        const amount = _1e18
        await sett.approve(badgerPeak.address, amount)

        await expect(
            badgerPeak.mint(0, amount, merkleTree.getHexProof(_guestList[1])) // incorrect leaf
        ).to.be.revertedWith('guest-list-authorization')

        const balBefore = await bBTC.balanceOf(alice)

        await badgerPeak.mint(0, amount, merkleTree.getHexProof(_guestList[0]))

        const bBtc = _1e18 // since bBTC.pps() = 1
        const _fee = bBtc.mul(fee).div(PRECISION)
        const aliceBtc = bBtc.sub(_fee)

        expect(await bBTC.balanceOf(alice)).to.eq(aliceBtc.add(balBefore))
    })

    it('alice cannot mint more than totalDepositCap', async function() {
        await sett.approve(badgerPeak.address, _1e18)
        await expect(
            badgerPeak.mint(0, _1e18, merkleTree.getHexProof(_guestList[0]))
        ).to.be.revertedWith('guest-list-authorization')
        await sett.approve(badgerPeak.address, 0)
    })

    it('raise totalDepositCap', async function() {
        await guestList.setTotalDepositCap(_1e18.mul(12))
        expect(await guestList.totalDepositCap()).to.eq(_1e18.mul(12))
    })

    it('alice mints after totalDepositCap raise', async function() {
        const amount = _1e18
        await sett.approve(badgerPeak.address, amount)

        const balBefore = await bBTC.balanceOf(alice)

        await badgerPeak.mint(0, amount, merkleTree.getHexProof(_guestList[0]))

        const bBtc = _1e18 // since bBTC.pps() = 1
        const _fee = bBtc.mul(fee).div(PRECISION)

        expect(await bBTC.balanceOf(alice)).to.eq(bBtc.sub(_fee).add(balBefore))
    })

    it('uninvited guest (bob) cannot mint', async function() {
        const amount = _1e18.mul(2)
        await sett.connect(bobSigner).approve(badgerPeak.address, amount)
        await expect(
            badgerPeak.connect(bobSigner).mint(0, amount, merkleTree.getHexProof(_guestList[0]))
        ).to.be.revertedWith('guest-list-authorization')
    })

    it('include bob in GuestList', async function() {
        _guestList.push(web3.utils.keccak256(bob))
        merkleTree = new MerkleTree(_guestList, keccak256, { sortPairs: true })
        await guestList.setGuestRoot(merkleTree.getHexRoot())
    })

    it('newly invited guest (bob) mint', async function() {
        const amount = _1e18.mul(2)
        await badgerPeak.connect(bobSigner).mint(0, amount, merkleTree.getHexProof(_guestList[_guestList.length - 1]))

        const bBtc = amount // since bBTC.pps() = 1
        const _fee = bBtc.mul(fee).div(PRECISION)

        expect(await bBTC.balanceOf(bob)).to.eq(bBtc.sub(_fee))
        expect(await sett.balanceOf(bob)).to.eq(_1e18.mul(2)) // Have 2 sett LP tokens leftover for the future
    })

    it('include pete in GuestList without merkleProof manually', async function() {
        await guestList.setGuests([pete], [true])
    })

    it('manually added guest (pete) mint', async function() {
        // Increase total deposit cap
        await guestList.setTotalDepositCap(_1e18.mul(16))

        const amount = _1e18.mul(2)
        await sett.connect(peteSigner).approve(badgerPeak.address, amount)
        await badgerPeak.connect(peteSigner).mint(0, amount, [])

        const bBtc = amount // since bBTC.pps() = 1
        const _fee = bBtc.mul(fee).div(PRECISION)

        expect(await bBTC.balanceOf(pete)).to.eq(bBtc.sub(_fee))
        expect(await sett.balanceOf(pete)).to.eq(_1e18.mul(2)) // Have 2 sett LP tokens leftover for the future
    })

    it('remove pete (no merkleProof invitation) from GuestList manually', async function() {
        await guestList.setGuests([pete], [false])
    })

    it('removed guest (pete) cannot mint', async function() {
        const amount = _1e18.mul(2)
        await sett.connect(peteSigner).approve(badgerPeak.address, amount)
        await expect(
            badgerPeak.connect(peteSigner).mint(0, amount, [])
        ).to.be.revertedWith('guest-list-authorization')
    })

    it('remove bob (merkleProof invitation) from GuestList manually', async function() {
        await guestList.setGuests([bob], [false])
    })

    it('removed guest (bob) cannot mint', async function() {
        const amount = _1e18.mul(2)
        await sett.connect(bobSigner).approve(badgerPeak.address, amount)
        await expect(
            badgerPeak.connect(bobSigner).mint(0, amount, merkleTree.getHexProof(_guestList[0]))
        ).to.be.revertedWith('guest-list-authorization')
    })
});
