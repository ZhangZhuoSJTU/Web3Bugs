import { getETHSpentOnGas } from "../helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { FeeSplitter, MockERC20, WETH9 } from "../../typechain";

describe("Fee Splitter", () => {
    let alice: SignerWithAddress, bob: SignerWithAddress, wallet3: SignerWithAddress, feeTo: SignerWithAddress;
    let ERC20Mocks!: [MockERC20, MockERC20, MockERC20];
    let mockWETH: WETH9;
    let feeSplitter: FeeSplitter;

    before(async () => {
        const signers = await ethers.getSigners();
        // All transactions will be sent from Alice unless explicity specified
        alice = signers[0];
        bob = signers[1];
        wallet3 = signers[2];
        feeTo = signers[2];
    });

    beforeEach(async () => {
        const FeeSplitterFactory = await ethers.getContractFactory("FeeSplitter");

        ERC20Mocks = await Promise.all([
            deployMockToken("Mock1", "MOCK1", alice),
            deployMockToken("Mock2", "MOCK2", alice),
            deployMockToken("Mock3", "MOCK3", alice),
        ]);
        const MockWETHFactory = await ethers.getContractFactory("WETH9");
        mockWETH = await MockWETHFactory.deploy();

        feeSplitter = await FeeSplitterFactory.deploy(
            [alice.address, bob.address],
            [5000, 3000],
            2000,
            mockWETH.address,
        );
    });

    it("tests getter functions", async () => {
        const amount = ethers.utils.parseEther("5");
        await mockWETH.approve(feeSplitter.address, amount);
        mockWETH.deposit({ value: amount });
        await feeSplitter.sendFees(mockWETH.address, amount);
        expect(await feeSplitter.totalShares(mockWETH.address)).to.equal(amount);
        expect(await feeSplitter.shares(alice.address, mockWETH.address)).to.equal(amount.mul(5000).div(8000));
        expect(await feeSplitter.totalReleased(mockWETH.address)).to.equal(0);
        expect(await feeSplitter.royaltiesWeight()).to.equal(2000);
        expect(await feeSplitter.released(alice.address, mockWETH.address)).to.equal(0);
    });

    it("should revert when calling findShareholder", async () => {
        await expect(feeSplitter.findShareholder(feeSplitter.address)).to.be.revertedWith("FeeSplitter: NOT_FOUND");
    });

    it("should revert when calling setShareholders", async () => {
        await expect(feeSplitter.setShareholders([alice.address, bob.address], [100])).to.be.revertedWith(
            "FeeSplitter: ARRAY_LENGTHS_ERR",
        );
    });

    it("should fail when sending ETH to FeeSplitter", async () => {
        await expect(
            alice.sendTransaction({
                to: feeSplitter.address,
                value: 1,
            }),
        ).to.be.revertedWith("FeeSplitter: ETH_SENDER_NOT_WETH");
    });

    it("releases fees as ETH", async () => {
        const amount = ethers.utils.parseEther("5");
        await mockWETH.approve(feeSplitter.address, amount);
        mockWETH.deposit({ value: amount });
        await feeSplitter.sendFees(mockWETH.address, amount);
        const balanceBobBefore = await bob.getBalance();
        const tx = await feeSplitter.connect(bob).releaseETH();
        const spentOnGas = await getETHSpentOnGas(tx);
        const balanceBobAfter = await bob.getBalance();
        const amountReleased = amount.mul(3000).div(8000);
        expect(balanceBobAfter.sub(balanceBobBefore)).to.equal(amountReleased.sub(spentOnGas));

        expect(await feeSplitter.totalReleased(mockWETH.address)).to.equal(amountReleased);
        expect(await feeSplitter.released(bob.address, mockWETH.address)).to.equal(amountReleased);
    });

    describe("ERC20 tokens fees", () => {
        it("should revert because no payment is due", async () => {
            const token = ERC20Mocks[0];
            const release = () => feeSplitter.connect(bob).releaseToken(token.address);
            await expect(release()).to.be.revertedWith("FeeSplitter: NO_PAYMENT_DUE");
        });

        it("retrieves split token fees", async () => {
            const amount1 = ethers.utils.parseEther("3");
            const amount2 = ethers.utils.parseEther("5");

            await ERC20Mocks[0].approve(feeSplitter.address, amount1.add(amount2));
            await feeSplitter.sendFees(ERC20Mocks[0].address, amount1);
            await feeSplitter.sendFeesWithRoyalties(wallet3.address, ERC20Mocks[0].address, amount2);

            const token = ERC20Mocks[0];
            await feeSplitter.connect(bob).releaseToken(token.address);
            const balanceBob = await token.balanceOf(bob.address);
            const balanceAliceBefore = await token.balanceOf(alice.address);
            await feeSplitter.releaseToken(token.address);
            const balanceAliceAfter = await token.balanceOf(alice.address);
            // Why 4.375? Alice has 5000 shares, we had two payments of 3 (no royalties) and 5 (has royalties). 0.625*3+0.5*5=4.375
            expect(balanceAliceAfter.sub(balanceAliceBefore)).to.equal(ethers.utils.parseEther("4.375"));
            // Bob can claim 37.5% of the fees. Same computation as aboove
            expect(balanceBob).to.equal(ethers.utils.parseEther("2.625"));
        });

        it("claims fees as NFT owner", async () => {
            const token = ERC20Mocks[0];
            const amount = ethers.utils.parseEther("6");
            await token.approve(feeSplitter.address, amount);
            await feeSplitter.sendFeesWithRoyalties(wallet3.address, token.address, amount);

            await feeSplitter.connect(wallet3).releaseToken(token.address);
            const balanceWallet3 = await token.balanceOf(wallet3.address);
            // wallet3 can claim 20% of the fees. 6 * 0.2
            expect(balanceWallet3).to.equal(ethers.utils.parseEther("1.2"));
        });

        it("releases fees for a list of tokens", async () => {
            const amount = ethers.utils.parseEther("3");
            await ERC20Mocks[0].approve(feeSplitter.address, amount);
            await ERC20Mocks[1].approve(feeSplitter.address, amount);
            await ERC20Mocks[2].approve(feeSplitter.address, amount);
            await feeSplitter.sendFees(ERC20Mocks[0].address, amount);
            await feeSplitter.sendFees(ERC20Mocks[1].address, amount);
            await feeSplitter.sendFees(ERC20Mocks[2].address, amount);
            await feeSplitter.connect(bob).releaseTokens(ERC20Mocks.map(c => c.address));

            // 1.125 = 3 * 37.5%
            expect(await ERC20Mocks[0].balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1.125"));
            expect(await ERC20Mocks[1].balanceOf(bob.address)).to.equal(ethers.utils.parseEther("1.125"));
        });
    });

    describe("Changing weights", () => {
        it("should revert because sum of weights is zero", async () => {
            await feeSplitter.setRoyaltiesWeight(0);
            await feeSplitter.updateShareholder(0, 0);
            await expect(feeSplitter.updateShareholder(1, 0)).to.be.revertedWith("FeeSplitter: TOTAL_WEIGHTS_ZERO");
        });

        it("should revert when adding a shareholder with a weight of zero", async () => {
            await expect(feeSplitter.setShareholders([bob.address], [0])).to.be.revertedWith(
                "FeeSplitter: ZERO_WEIGHT",
            );
        });

        it("should revert if account index invalid", async () => {
            await expect(feeSplitter.updateShareholder(10, 10)).to.be.revertedWith(
                "FeeSplitter: INVALID_ACCOUNT_INDEX",
            );
        });

        it("updates the weights for fees distribution", async () => {
            await feeSplitter.setRoyaltiesWeight(3000);
            const bobIndex = await feeSplitter.findShareholder(bob.address);
            await feeSplitter.updateShareholder(bobIndex, 8000);
            await feeSplitter.updateShareholder(0, 2000);
            await clearBalance(bob, ERC20Mocks[0]);
            await clearBalance(wallet3, ERC20Mocks[0]);

            const releaseBob = () => feeSplitter.connect(bob).releaseToken(ERC20Mocks[0].address);

            await sendFees("5", wallet3.address);
            await sendFees("1");
            await sendFees("12", wallet3.address);

            await releaseBob();

            const bobBalance = await ERC20Mocks[0].balanceOf(bob.address);
            const toEther = (n: number) => ethers.utils.parseEther(n.toString());
            const totalWeights = await feeSplitter.totalWeights();
            expect(totalWeights).to.equal(13000);
            // calculate expected bob's balance by manually adding fees for each transaction above
            const expectedBalance = toEther(5)
                .mul(8000)
                .div(totalWeights)
                .add(toEther(1).mul(8000).div(10000))
                .add(toEther(12).mul(8000).div(totalWeights));
            expect(bobBalance).to.equal(expectedBalance.add(1)); // adding 1 because of a rounding difference between js and solidity
        });
    });

    const deployMockToken = async (name: string, symbol: string, owner: SignerWithAddress) => {
        const TokenFactory = await ethers.getContractFactory("MockERC20");
        return TokenFactory.connect(owner).deploy(name, symbol, ethers.utils.parseEther("1000000"));
    };

    const sendFees = async (amountEther: string, royaltiesTarget?: string) => {
        const token = ERC20Mocks[0];
        const amount = ethers.utils.parseEther(amountEther);
        await token.approve(feeSplitter.address, amount);
        if (royaltiesTarget) await feeSplitter.sendFeesWithRoyalties(royaltiesTarget, token.address, amount);
        else await feeSplitter.sendFees(token.address, amount);
    };

    const clearBalance = async (account: SignerWithAddress, token: MockERC20) => {
        const balance = await token.balanceOf(account.address);
        return token.connect(account).burn(balance);
    };
});
