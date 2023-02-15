const { expect } = require("chai");
const { ethers } = require("hardhat");

const totalSupply = '240000000000000000000000000';

const toWei = (value, add = 0, sub = 0) => (BigInt(value) * 1_000_000_000_000_000_000n + BigInt(add) - BigInt(sub)).toString();

// TODO: Test lockWithPermit

describe("XDEFIDistribution", () => {
    let XDEFI;
    let XDEFIDistribution;
    let god;
    let account1;
    let account2;
    let account3;

    beforeEach(async () => {
        [god, account1, account2, account3] = await ethers.getSigners();

        XDEFI = await (await (await ethers.getContractFactory("XDEFI")).deploy("XDEFI", "XDEFI", totalSupply)).deployed();
        XDEFIDistribution = await (await (await ethers.getContractFactory("XDEFIDistribution")).deploy(XDEFI.address, "https://www.xdefi.io/nfts/", 0)).deployed();

        // Setup some bonus multipliers (0 days with 1x, 1 day with 1.2x, 2 days with 1.5x)
        await (await XDEFIDistribution.setLockPeriods([0, 86400, 172800], [100, 120, 150])).wait();

        // Give each account 100 XDEFI
        await (await XDEFI.transfer(account1.address, toWei(1000))).wait();
        await (await XDEFI.transfer(account2.address, toWei(1000))).wait();
        await (await XDEFI.transfer(account3.address, toWei(1000))).wait();
    });

    it("Can enter and exit deposited amounts with no distributions (no bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('1');
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(1000));

        // Position 2 locks
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 0, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('1');
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(1000));

        // Position 3 locks
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 0, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account3.address)).to.equal('1');
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(1000));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(3000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1000));

        // Position 1 unlocks
        await (await XDEFIDistribution.connect(account1).unlock(nft1, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(1000));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));

        // Position 2 unlocks
        await (await XDEFIDistribution.connect(account2).unlock(nft2, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(1000));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));

        // Position 3 unlocks
        await (await XDEFIDistribution.connect(account3).unlock(nft3, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(1000));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
    });

    it("Can enter and exit deposited amounts with no distributions (varied bonuses)", async () => {
        // Position 1 locks (no bonus)
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('1');
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(1000));

        // Position 2 locks (1.2x bonus)
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('1');
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(1200));

        // Position 3 locks (1.5x bonus)
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account3.address)).to.equal('1');
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(1500));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(3000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3700));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1000));

        // Position 1 unlocks
        await (await XDEFIDistribution.connect(account1).unlock(nft1, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(1000));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));

        // Position 2 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account2).unlock(nft2, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(1000));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));

        // Position 3 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account3).unlock(nft3, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(1000));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
    });

    it("Can enter and exit staggered portions of distributions (no bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // First distribution (should all be for position 1)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(200))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1200, 0, 1));

        // Position 2 locks
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 0, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();

        // Second distribution (should split between position 1 and position 2)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(300))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1350, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1150, 0, 1));

        // Position 1 unlocks
        await (await XDEFIDistribution.connect(account1).unlock(nft1, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(1350, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));

        // Position 3 locks
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 0, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();

        // Third distribution (should split between position 2 and position 3)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(500))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1400, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1250, 0, 0));

        // Position 2 unlocks
        await (await XDEFIDistribution.connect(account2).unlock(nft2, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(1400, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));

        // Fourth distribution (should all be for position 3)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(400))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1650, 0, 1));

        // Position 3 unlocks
        await (await XDEFIDistribution.connect(account3).unlock(nft3, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(1650, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0, 3, 0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0, 3, 0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);
    });

    it("Can enter and exit staggered of distributions (varied bonuses)", async () => {
        // Position 1 locks (no bonus)
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // First distribution (should all be for position 1)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(200))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1200, 0, 1));

        // Position 2 locks (1.2x bonus)
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();

        // Second distribution (should split between position 1 and position 2, taking bonus into account)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(300))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1336, '363636363636363636', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1163, '636363636363636363', 0));

        // Position 1 unlocks
        await (await XDEFIDistribution.connect(account1).unlock(nft1, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(1336, '363636363636363636', 0));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));

        // Position 3 locks (1.5x bonus)
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();

        // Third distribution (should split between position 2 and position 3, taking bonus into account)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(500))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1385, '858585858585858585', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1277, '777777777777777777', 0));

        // Position 2 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account2).unlock(nft2, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(1385, '858585858585858585', 0));
        expect((await XDEFIDistribution.positionOf(account2.address)).units).to.equal(toWei(0));

        // Fourth distribution (should all be for position 3)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(400))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1677, '777777777777777777', 0));

        // Position 3 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account3).unlock(nft3, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(1677, '777777777777777777', ));
        expect((await XDEFIDistribution.positionOf(account3.address)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0, 2, 0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0, 2, 0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);
    });

    it("Can enter and re-lock deposited amounts with no distributions (no bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('1');
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(1000));

        // Position 2 locks
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 0, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('1');
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(1000));

        // Position 3 locks
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 0, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account3.address)).to.equal('1');
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(1000));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(3000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1000));

        // Position 1 re-locks 500
        await (await XDEFIDistribution.connect(account1).relock(nft1, toWei(500), 0, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(500));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('2');
        const nft4 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(500));

        // Position 2 re-locks 250
        await (await XDEFIDistribution.connect(account2).relock(nft2, toWei(250), 0, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(750));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('2');
        const nft5 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft5)).units).to.equal(toWei(250));

        // Position 3 re-locks all
        await (await XDEFIDistribution.connect(account3).relock(nft3, toWei(1000), 0, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account3.address)).to.equal('2');
        const nft6 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft6)).units).to.equal(toWei(1000));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(1750));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(1750));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(1750));
        expect(await XDEFIDistribution.totalSupply()).to.equal(6);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(500));
        expect(await XDEFIDistribution.withdrawableOf(nft5)).to.equal(toWei(250));
        expect(await XDEFIDistribution.withdrawableOf(nft6)).to.equal(toWei(1000));
    });

    it("Can enter and re-lock deposited amounts with no distributions (varied bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('1');
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(1000));

        // Position 2 locks
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('1');
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(1200));

        // Position 3 locks
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account3.address)).to.equal('1');
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(1500));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(3000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3700));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1000));

        // Position 1 re-locks 500
        await (await XDEFIDistribution.connect(account1).relock(nft1, toWei(500), 0, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(500));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('2');
        const nft4 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(500));

        // Position 2 re-locks 250
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account2).relock(nft2, toWei(250), 0, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(750));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('2');
        const nft5 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft5)).units).to.equal(toWei(250));

        // Position 3 re-locks 100
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account3).relock(nft3, toWei(1000), 0, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account3.address)).to.equal('2');
        const nft6 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft6)).units).to.equal(toWei(1000));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(1750));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(1750));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(1750));
        expect(await XDEFIDistribution.totalSupply()).to.equal(6);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(500));
        expect(await XDEFIDistribution.withdrawableOf(nft5)).to.equal(toWei(250));
        expect(await XDEFIDistribution.withdrawableOf(nft6)).to.equal(toWei(1000));
    });

    it("Can enter and re-lock staggered portions of distributions (no bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // First distribution (should all be for position 1)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(200))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1200, 0, 1));

        // Position 2 locks
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 0, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();

        // Second distribution (should split between position 1 and position 2)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(300))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1350, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1150, 0, 1));

        // Position 1 re-locks 500 into Position 3
        await (await XDEFIDistribution.connect(account1).relock(nft1, toWei(500), 0, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(850, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('2');
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(500));

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1150, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(500, 0, 0));

        // Position 4 locks
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 0, account3.address)).wait();
        const nft4 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1150, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(500, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(1000, 0, 0));

        // Third distribution (should split between position 2, 3, and 4)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(600))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1390, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(620, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(1240, 0, 1));

        // Position 2 re-locks 500 into Position 5
        await (await XDEFIDistribution.connect(account2).relock(nft2, toWei(1000), 0, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(390, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('2');
        const nft5 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft5)).units).to.equal(toWei(1000));

        // Fourth distribution (should split between position 3, 4, and 5)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(400))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(700, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(1400, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft5)).to.equal(toWei(1160, 0, 1));

        // Position 3 unlocks
        await (await XDEFIDistribution.connect(account1).unlock(nft3, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(1550, 0, 2));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Fifth distribution (should split between position 4 and 5)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(300))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(1550, 0, 1));
        expect(await XDEFIDistribution.withdrawableOf(nft5)).to.equal(toWei(1310, 0, 1));

        // Position 4 unlocks
        await (await XDEFIDistribution.connect(account3).unlock(nft4, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(1550, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(0));

        // Sixth distribution (should all be for position 5)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(300))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft5)).to.equal(toWei(1610, 0, 1));

        // Position 5 unlocks
        await (await XDEFIDistribution.connect(account2).unlock(nft5, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(2000, 0, 2));
        expect((await XDEFIDistribution.positionOf(nft5)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0, 5, 0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0, 5, 0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(5);
    });

    it("Can enter and re-lock staggered portions of distributions (varied bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // First distribution (should all be for position 1)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(200))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1200, 0, 1));

        // Position 2 locks
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();

        // Second distribution (should split between position 1 and position 2)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(300))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1336, '363636363636363636', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1163, '636363636363636363', 0));

        // Position 1 re-locks 500 into Position 3
        await (await XDEFIDistribution.connect(account1).relock(nft1, toWei(500), 86400, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(836, '363636363636363636', 0));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('2');
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(600));

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1163, '636363636363636363', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(500, 0, 0));

        // Position 4 locks
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft4 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1163, '636363636363636363', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(500, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(1000, 0, 0));

        // Third distribution (should split between position 2, 3, and 4)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(600))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1381, '818181818181818181', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(609, '090909090909090909', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(1272, '727272727272727272', 0));

        // Position 2 re-locks 500 into Position 5
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account2).relock(nft2, toWei(1000), 86400, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(381, '818181818181818181', 0));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('2');
        const nft5 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 1)).toString();
        expect((await XDEFIDistribution.positionOf(nft5)).units).to.equal(toWei(1200));

        // Fourth distribution (should split between position 3, 4, and 5)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(400))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(681, '818181818181818181', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(1454, '545454545454545454', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft5)).to.equal(toWei(1145, '454545454545454545', 0));

        // Position 3 unlocks
        await (await XDEFIDistribution.connect(account1).unlock(nft3, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(1518, '181818181818181818', 1));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Fifth distribution (should split between position 4 and 5)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(300))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(1621, '212121212121212121', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft5)).to.equal(toWei(1278, '787878787878787878', 0));

        // Position 4 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account3).unlock(nft4, account3.address)).wait();
        expect(await XDEFI.balanceOf(account3.address)).to.equal(toWei(1621, '212121212121212121', 0));
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(0));

        // Sixth distribution (should all be for position 5)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(300))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(0, 0, 0));
        expect(await XDEFIDistribution.withdrawableOf(nft5)).to.equal(toWei(1578, '787878787878787878', 0));

        // Position 5 unlocks
        await (await XDEFIDistribution.connect(account2).unlock(nft5, account2.address)).wait();
        expect(await XDEFI.balanceOf(account2.address)).to.equal(toWei(1960, '606060606060606060', 1));
        expect((await XDEFIDistribution.positionOf(nft5)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0, 3, 0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0, 3, 0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(5);
    });

    it("Can enter and batch exit deposited amounts with no distributions (no bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // Position 2 locks and is transferred to account 1
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 0, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        await (await XDEFIDistribution.connect(account2).transferFrom(account2.address, account1.address, nft2)).wait();

        // Position 3 locks and is transferred to account 1
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 0, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        await (await XDEFIDistribution.connect(account3).transferFrom(account3.address, account1.address, nft3)).wait();

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(3000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1000));

        // Position 1, 2, and 3 unlock
        await (await XDEFIDistribution.connect(account1).unlockBatch([nft1, nft2, nft3], account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(3000));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
    });

    it("Can enter and batch exit deposited amounts with no distributions (varied bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // Position 2 locks and is transferred to account 1
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        await (await XDEFIDistribution.connect(account2).transferFrom(account2.address, account1.address, nft2)).wait();

        // Position 3 locks and is transferred to account 1
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        await (await XDEFIDistribution.connect(account3).transferFrom(account3.address, account1.address, nft3)).wait();

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(3000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3700));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1000));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1000));

        // Position 1, 2, and 3 unlock
        await hre.ethers.provider.send('evm_increaseTime', [172800]);
        await (await XDEFIDistribution.connect(account1).unlockBatch([nft1, nft2, nft3], account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(3000));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
    });

    it("Can enter and batch exit with distributions (varied bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // Position 2 locks and is transferred to account 1
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        await (await XDEFIDistribution.connect(account2).transferFrom(account2.address, account1.address, nft2)).wait();

        // Position 3 locks and is transferred to account 1
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        await (await XDEFIDistribution.connect(account3).transferFrom(account3.address, account1.address, nft3)).wait();

        // Distribution (should split between position 1, 2, and 3)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(4000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(1000));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3700));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1270, '270270270270270270', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1324, '324324324324324324', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1405, '405405405405405405', 0));

        // Position 1, 2, and 3 unlock
        await hre.ethers.provider.send('evm_increaseTime', [172800]);
        await (await XDEFIDistribution.connect(account1).unlockBatch([nft1, nft2, nft3], account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(4000, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0, 1, 0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0, 1, 0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
    });

    it("Can enter and batch relock with distributions (varied bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // Position 2 locks and is transferred to account 1
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        await (await XDEFIDistribution.connect(account2).transferFrom(account2.address, account1.address, nft2)).wait();

        // Position 3 locks and is transferred to account 1
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        await (await XDEFIDistribution.connect(account3).transferFrom(account3.address, account1.address, nft3)).wait();

        // First distribution (should split between position 1, 2, and 3)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(4000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(1000));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3700));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1270, '270270270270270270', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1324, '324324324324324324', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1405, '405405405405405405', 0));

        // Position 1, 2, and 3 relock
        await hre.ethers.provider.send('evm_increaseTime', [172800]);
        await (await XDEFIDistribution.connect(account1).relockBatch([nft1, nft2, nft3], toWei(3000), 172800, account1.address)).wait();
        const nft4 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 3)).toString();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(1000, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(4500));

        // Second distribution (should all for position 4)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(4000, 0, 1));

        // Position 4 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [172800]);
        await (await XDEFIDistribution.connect(account1).unlock(nft4, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(5000, 0, 2));
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0, 2, 0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0, 2, 0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(4);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(0));
    });

    it("Can enter and batch relock all with distributions (varied bonuses)", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();

        // Position 2 locks and is transferred to account 1
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        await (await XDEFIDistribution.connect(account2).transferFrom(account2.address, account1.address, nft2)).wait();

        // Position 3 locks and is transferred to account 1
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        await (await XDEFIDistribution.connect(account3).transferFrom(account3.address, account1.address, nft3)).wait();

        // First distribution (should split between position 1, 2, and 3)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(4000));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(1000));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(3000));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(3700));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(1270, '270270270270270270', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(1324, '324324324324324324', 0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(1405, '405405405405405405', 0));

        // Position 1, 2, and 3 relock all
        await hre.ethers.provider.send('evm_increaseTime', [172800]);
        await (await XDEFIDistribution.connect(account1).relockBatch([nft1, nft2, nft3], toWei(4000, 0, 1), 172800, account1.address)).wait();
        const nft4 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 3)).toString();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(6000, 0, 2));

        // Second distribution (should all for position 4)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(5000, 0, 2));

        // Position 4 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [172800]);
        await (await XDEFIDistribution.connect(account1).unlock(nft4, account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(5000, 0, 2));
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0, 2, 0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0, 2, 0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(4);

        // Check withdrawable
        expect(await XDEFIDistribution.withdrawableOf(nft1)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft2)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft3)).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(0));
    });

    it("Can merge and transfer unlocked positions", async () => {
        // Position 1 locks
        const pointsOfPosition1 = (await XDEFIDistribution.getPoints(toWei(1000), 0)).toString();
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();
        expect(await XDEFIDistribution.pointsOf(nft1)).to.equal(pointsOfPosition1);

        // Position 2 locks and is transferred to account 1
        const pointsOfPosition2 = (await XDEFIDistribution.getPoints(toWei(1000), 86400)).toString();
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        expect(await XDEFIDistribution.pointsOf(nft2)).to.equal(pointsOfPosition2);
        await (await XDEFIDistribution.connect(account2).transferFrom(account2.address, account1.address, nft2)).wait();

        // Position 3 locks and is transferred to account 1
        const pointsOfPosition3 = (await XDEFIDistribution.getPoints(toWei(1000), 172800)).toString();
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        expect(await XDEFIDistribution.pointsOf(nft3)).to.equal(pointsOfPosition3);
        await (await XDEFIDistribution.connect(account3).transferFrom(account3.address, account1.address, nft3)).wait();

        // First distribution (should split between position 1, 2, and 3)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Position 1, 2, and 3 unlock
        await hre.ethers.provider.send('evm_increaseTime', [172800]);
        await (await XDEFIDistribution.connect(account1).unlockBatch([nft1, nft2, nft3], account1.address)).wait();
        expect(await XDEFI.balanceOf(account1.address)).to.equal(toWei(4000, 0, 1));
        expect((await XDEFIDistribution.positionOf(nft1)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft2)).units).to.equal(toWei(0));
        expect((await XDEFIDistribution.positionOf(nft3)).units).to.equal(toWei(0));

        // Check contract values
        expect(await XDEFI.balanceOf(XDEFIDistribution.address)).to.equal(toWei(0, 1, 0));
        expect(await XDEFIDistribution.distributableXDEFI()).to.equal(toWei(0, 1, 0));
        expect(await XDEFIDistribution.totalDepositedXDEFI()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalUnits()).to.equal(toWei(0));
        expect(await XDEFIDistribution.totalSupply()).to.equal(3);

        // Unlocked positions 1, 2, and 3 are merged into unlocked position 4
        await (await XDEFIDistribution.connect(account1).merge([nft1, nft2, nft3], account1.address)).wait();
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('1');
        const nft4 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();
        expect((await XDEFIDistribution.positionOf(nft4)).units).to.equal(toWei(0));
        expect(await XDEFIDistribution.withdrawableOf(nft4)).to.equal(toWei(0));
        expect(await XDEFIDistribution.pointsOf(nft4)).to.equal(BigInt(pointsOfPosition1) + BigInt(pointsOfPosition2) + BigInt(pointsOfPosition3));

        // Unlocked position 4 transferred
        await (await XDEFIDistribution.connect(account1).transferFrom(account1.address, account2.address, nft4)).wait();
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal('0');
        expect(await XDEFIDistribution.balanceOf(account2.address)).to.equal('1');
    });

    it("Cannot merge unlocked positions", async () => {
        // Position 1 locks
        const pointsOfPosition1 = (await XDEFIDistribution.getPoints(toWei(1000), 0)).toString();
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0)).toString();
        expect(await XDEFIDistribution.pointsOf(nft1)).to.equal(pointsOfPosition1);

        // Position 2 locks and is transferred to account 1
        const pointsOfPosition2 = (await XDEFIDistribution.getPoints(toWei(1000), 86400)).toString();
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0)).toString();
        expect(await XDEFIDistribution.pointsOf(nft2)).to.equal(pointsOfPosition2);
        await (await XDEFIDistribution.connect(account2).transferFrom(account2.address, account1.address, nft2)).wait();

        // Position 3 locks and is transferred to account 1
        const pointsOfPosition3 = (await XDEFIDistribution.getPoints(toWei(1000), 172800)).toString();
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0)).toString();
        expect(await XDEFIDistribution.pointsOf(nft3)).to.equal(pointsOfPosition3);
        await (await XDEFIDistribution.connect(account3).transferFrom(account3.address, account1.address, nft3)).wait();

        // Attempted to merge locked positions 1, 2, and 3 into unlocked position 4
        await expect(XDEFIDistribution.connect(account1).merge([nft1, nft2, nft3], account1.address)).to.be.revertedWith("POSITION_NOT_UNLOCKED");
    });
});
