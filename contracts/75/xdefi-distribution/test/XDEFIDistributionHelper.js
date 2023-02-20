const { expect } = require("chai");
const { ethers } = require("hardhat");

const totalSupply = '240000000000000000000000000';

const toWei = (value, add = 0, sub = 0) => (BigInt(value) * 1_000_000_000_000_000_000n + BigInt(add) - BigInt(sub)).toString();

describe("XDEFIDistributionHelper", () => {
    let XDEFI;
    let XDEFIDistribution;
    let XDEFIDistributionHelper;
    let god;
    let account1;
    let account2;
    let account3;

    beforeEach(async () => {
        [god, account1, account2, account3] = await ethers.getSigners();

        XDEFI = await (await (await ethers.getContractFactory("XDEFI")).deploy("XDEFI", "XDEFI", totalSupply)).deployed();
        XDEFIDistribution = await (await (await ethers.getContractFactory("XDEFIDistribution")).deploy(XDEFI.address, "https://www.xdefi.io/nfts/", 0)).deployed();
        XDEFIDistributionHelper = await (await (await ethers.getContractFactory("XDEFIDistributionHelper")).deploy()).deployed();

        // Setup some bonus multipliers (0 days with 1x, 1 day with 1.2x, 2 days with 1.5x)
        await (await XDEFIDistribution.setLockPeriods([0, 86400, 172800], [100, 120, 150])).wait();

        // Give each account 100 XDEFI
        await (await XDEFI.transfer(account1.address, toWei(1000))).wait();
        await (await XDEFI.transfer(account2.address, toWei(1000))).wait();
        await (await XDEFI.transfer(account3.address, toWei(1000))).wait();
    });

    it("Can fetch all XDEFIDistribution data for an account", async () => {
        // Position 1 locks
        await (await XDEFI.connect(account1).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account1).lock(toWei(1000), 0, account1.address)).wait();
        const nft1 = (await XDEFIDistribution.tokenOfOwnerByIndex(account1.address, 0));

        // Position 2 locks and is transferred to account 1
        await (await XDEFI.connect(account2).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account2).lock(toWei(1000), 86400, account2.address)).wait();
        const nft2 = (await XDEFIDistribution.tokenOfOwnerByIndex(account2.address, 0));
        await (await XDEFIDistribution.connect(account2).transferFrom(account2.address, account1.address, nft2)).wait();

        // Position 3 locks and is transferred to account 1
        await (await XDEFI.connect(account3).approve(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.connect(account3).lock(toWei(1000), 172800, account3.address)).wait();
        const nft3 = (await XDEFIDistribution.tokenOfOwnerByIndex(account3.address, 0));
        await (await XDEFIDistribution.connect(account3).transferFrom(account3.address, account1.address, nft3)).wait();

        // Distribution (should split between position 1, 2, and 3)
        await (await XDEFI.transfer(XDEFIDistribution.address, toWei(1000))).wait();
        await (await XDEFIDistribution.updateDistribution()).wait();

        // Get all data for account 1's positions.
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal(3);
        expect(await XDEFIDistributionHelper.getAllTokensForAccount(XDEFIDistribution.address, account1.address)).to.deep.equal([nft1, nft2, nft3]);

        await XDEFIDistributionHelper.getAllLockedPositionsForAccount(XDEFIDistribution.address, account1.address)
            .then(async ({ tokenIds_, positions_, withdrawables_ }) => {
                expect(tokenIds_).to.deep.equal([nft1, nft2, nft3]);

                expect(positions_.length).to.equal(3);
                expect(positions_[0]).to.deep.equal((await XDEFIDistribution.positionOf(nft1)));
                expect(positions_[1]).to.deep.equal((await XDEFIDistribution.positionOf(nft2)));
                expect(positions_[2]).to.deep.equal((await XDEFIDistribution.positionOf(nft3)));

                expect(withdrawables_.map(x => x.toString())).to.deep.equal([toWei(1270, '270270270270270270', 0), toWei(1324, '324324324324324324', 0), toWei(1405, '405405405405405405', 0)]);
            });

        // Position 1 unlocks
        await (await XDEFIDistribution.connect(account1).unlock(nft1, account1.address)).wait();

        // Get all data for account 1's positions.
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal(3);
        expect(await XDEFIDistributionHelper.getAllTokensForAccount(XDEFIDistribution.address, account1.address)).to.deep.equal([nft1, nft2, nft3]);

        await XDEFIDistributionHelper.getAllLockedPositionsForAccount(XDEFIDistribution.address, account1.address)
            .then(async ({ tokenIds_, positions_, withdrawables_ }) => {
                expect(tokenIds_).to.deep.equal([nft2, nft3]);

                expect(positions_.length).to.equal(2);
                expect(positions_[0]).to.deep.equal((await XDEFIDistribution.positionOf(nft2)));
                expect(positions_[1]).to.deep.equal((await XDEFIDistribution.positionOf(nft3)));

                expect(withdrawables_.map(x => x.toString())).to.deep.equal([toWei(1324, '324324324324324324', 0), toWei(1405, '405405405405405405', 0)]);
            });

        // Position 2 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account1).unlock(nft2, account1.address)).wait();

        // Get all data for account 1's positions.
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal(3);
        expect(await XDEFIDistributionHelper.getAllTokensForAccount(XDEFIDistribution.address, account1.address)).to.deep.equal([nft1, nft2, nft3]);

        await XDEFIDistributionHelper.getAllLockedPositionsForAccount(XDEFIDistribution.address, account1.address)
            .then(async ({ tokenIds_, positions_, withdrawables_ }) => {
                expect(tokenIds_).to.deep.equal([nft3]);

                expect(positions_.length).to.equal(1);
                expect(positions_[0]).to.deep.equal((await XDEFIDistribution.positionOf(nft3)));

                expect(withdrawables_.map(x => x.toString())).to.deep.equal([toWei(1405, '405405405405405405', 0)]);
            });

        // Position 3 unlocks
        await hre.ethers.provider.send('evm_increaseTime', [86400]);
        await (await XDEFIDistribution.connect(account1).unlock(nft3, account1.address)).wait();

        // Get all data for account 1's positions.
        expect(await XDEFIDistribution.balanceOf(account1.address)).to.equal(3);
        expect(await XDEFIDistributionHelper.getAllTokensForAccount(XDEFIDistribution.address, account1.address)).to.deep.equal([nft1, nft2, nft3]);

        await XDEFIDistributionHelper.getAllLockedPositionsForAccount(XDEFIDistribution.address, account1.address)
            .then(async ({ tokenIds_, positions_, withdrawables_ }) => {
                expect(tokenIds_).to.deep.equal([]);

                expect(positions_.length).to.equal(0);

                expect(withdrawables_.map(x => x.toString())).to.deep.equal([]);
            });
    });
});
