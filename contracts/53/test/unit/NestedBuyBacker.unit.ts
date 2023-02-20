import { Interface } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { appendDecimals } from "../helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { DummyRouter, FeeSplitter, MockERC20, NestedBuybacker, WETH9 } from "../../typechain";

describe("NestedBuybacker", () => {
    let alice: SignerWithAddress, bob: SignerWithAddress, communityReserve: SignerWithAddress;
    let feeSplitter: FeeSplitter, mockWETH: WETH9;
    let mockNST: MockERC20, mockUSDT: MockERC20;
    let dummyRouter: DummyRouter, buyBacker: NestedBuybacker;

    before(async () => {
        const signers = await ethers.getSigners();
        // All transactions will be sent from Alice unless explicity specified
        alice = signers[0];
        bob = signers[1];
        communityReserve = signers[2];
        mockNST = await deployMockToken("NST", "NST", alice);
        mockUSDT = await deployMockToken("Fake USDT", "TDUS", alice);
    });

    beforeEach(async () => {
        const wethFactory = await ethers.getContractFactory("WETH9");
        mockWETH = await wethFactory.deploy();

        const feeSplitterFactory = await ethers.getContractFactory("FeeSplitter");
        feeSplitter = await feeSplitterFactory.deploy([bob.address], [30], 20, mockWETH.address);

        const NestedBuybackerFactory = await ethers.getContractFactory("NestedBuybacker");
        buyBacker = await NestedBuybackerFactory.deploy(
            mockNST.address,
            communityReserve.address,
            feeSplitter.address,
            250,
        );

        await feeSplitter.setShareholders([bob.address, buyBacker.address], [30, 50]);

        // before each, empty the reserve NST balance
        await mockNST.connect(communityReserve).burn(await mockNST.balanceOf(communityReserve.address));

        const DummyRouterFactory = await ethers.getContractFactory("DummyRouter");
        dummyRouter = await DummyRouterFactory.deploy();
    });

    it("should revert with BURN_PART_TOO_HIGH", async () => {
        const NestedBuybackerFactory = await ethers.getContractFactory("NestedBuybacker");
        await expect(
            NestedBuybackerFactory.deploy(mockNST.address, communityReserve.address, feeSplitter.address, 1200),
        ).to.be.revertedWith("NestedBuybacker::constructor: Burn part to high");
    });

    it("sets the nested reserve address", async () => {
        expect(await buyBacker.nstReserve()).to.not.equal(bob.address);
        await buyBacker.setNestedReserve(bob.address);
        expect(await buyBacker.nstReserve()).to.equal(bob.address);
    });

    it("sets the fee splitter address", async () => {
        expect(await buyBacker.feeSplitter()).to.not.equal(bob.address);
        await buyBacker.setFeeSplitter(bob.address);
        expect(await buyBacker.feeSplitter()).to.equal(bob.address);
    });

    it("sends fees as token", async () => {
        await mockNST.transfer(dummyRouter.address, ethers.utils.parseEther("100000"));

        const abi = ["function dummyswapToken(address _inputToken, address _outputToken, uint256 _amount)"];
        const iface = new Interface(abi);
        const dataUSDT = iface.encodeFunctionData("dummyswapToken", [
            mockUSDT.address,
            mockNST.address,
            ethers.utils.parseEther("200"),
        ]);

        const dataWETH = iface.encodeFunctionData("dummyswapToken", [
            mockWETH.address,
            mockNST.address,
            ethers.utils.parseEther("10"),
        ]);

        // send 16WETH to the fee splitter so that buybacker gets 10WETH (62.5%)
        await mockWETH.deposit({ value: appendDecimals(16) });
        await mockWETH.approve(feeSplitter.address, appendDecimals(16));
        await feeSplitter.sendFees(mockWETH.address, appendDecimals(16));
        // also try sending token directly to buybacker (instead of using FeeSplitter)
        await mockUSDT.transfer(buyBacker.address, ethers.utils.parseEther("200"));

        await buyBacker.triggerForToken(dataUSDT, dummyRouter.address, mockUSDT.address);

        // we bought 200 NST. Nested reserve should get 75% of that.
        expect(await mockNST.balanceOf(communityReserve.address)).to.equal(appendDecimals(150));

        await buyBacker.triggerForToken(dataWETH, dummyRouter.address, mockWETH.address);

        // we bought 10 WETH. Nested reserve should get 75% of that.
        expect(await mockNST.balanceOf(communityReserve.address)).to.equal(
            appendDecimals(150).add(ethers.utils.parseEther("7.5")),
        );

        expect(await mockWETH.balanceOf(buyBacker.address)).to.equal(ethers.constants.Zero);
        expect(await mockNST.balanceOf(buyBacker.address)).to.equal(ethers.constants.Zero);
        expect(await mockUSDT.balanceOf(buyBacker.address)).to.equal(ethers.constants.Zero);
    });

    it("updates the burn percentage", async () => {
        await buyBacker.setBurnPart(100);
        expect(await buyBacker.burnPercentage()).to.equal(100);
    });

    const deployMockToken = async (name: string, symbol: string, owner: SignerWithAddress) => {
        const TokenFactory = await ethers.getContractFactory("MockERC20");
        return TokenFactory.connect(owner).deploy(name, symbol, ethers.utils.parseEther("1000000"));
    };
});
