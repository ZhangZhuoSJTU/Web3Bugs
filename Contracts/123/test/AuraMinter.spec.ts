import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4 } from "../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { AuraToken, AuraMinter } from "../types/generated";
import { simpleToExactAmount, getTimestamp, increaseTime, ONE_WEEK } from "../test-utils";

describe("AuraMinter", () => {
    let accounts: Signer[];
    let cvx: AuraToken;
    let minter: AuraMinter;
    let mocks: DeployMocksResult;
    let deployer: Signer;
    let alice: Signer;
    let aliceAddress: string;

    before(async () => {
        accounts = await ethers.getSigners();

        deployer = accounts[0];
        mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();
        const phase1 = await deployPhase1(hre, deployer, mocks.addresses);
        const phase2 = await deployPhase2(
            hre,
            deployer,
            phase1,
            distro,
            multisigs,
            mocks.namingConfig,
            mocks.addresses,
        );
        const phase3 = await deployPhase3(hre, deployer, phase2, multisigs, mocks.addresses);
        await phase3.poolManager.setProtectPool(false);
        const contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        cvx = contracts.cvx;
        minter = contracts.minter;
    });

    it("initial configuration is correct", async () => {
        expect(await minter.aura()).to.equal(cvx.address);
        expect(await minter.inflationProtectionTime()).to.gt((await getTimestamp()).add(ONE_WEEK.mul(155)));
        expect(await minter.inflationProtectionTime()).to.lt((await getTimestamp()).add(ONE_WEEK.mul(157)));
        expect(await minter.owner()).to.equal(await deployer.getAddress());
    });
    describe("@method AuraMinter.mint fails if", async () => {
        it("sender is not the dao", async () => {
            await expect(minter.connect(alice).mint(aliceAddress, simpleToExactAmount(1))).to.revertedWith(
                "Ownable: caller is not the owner",
            );
        });
        it("inflation protection time has not expired", async () => {
            await expect(minter.connect(deployer).mint(aliceAddress, simpleToExactAmount(1))).to.revertedWith(
                "Inflation protected for now",
            );
        });
    });

    describe("@method AuraMinter.mint mints when", async () => {
        it("protects inflation up to 155", async () => {
            await increaseTime(ONE_WEEK.mul(155));
            await expect(minter.connect(deployer).mint(aliceAddress, simpleToExactAmount(1))).to.revertedWith(
                "Inflation protected for now",
            );
        });
        it("@method AuraMinter.mint mints tokens", async () => {
            await increaseTime(ONE_WEEK.mul(2));
            const beforeBalance = await cvx.balanceOf(aliceAddress);
            const beforeTotalSupply = await cvx.totalSupply();
            await minter.mint(aliceAddress, 1000);
            const afterBalance = await cvx.balanceOf(aliceAddress);
            const afterTotalSupply = await cvx.totalSupply();
            expect(beforeBalance, "balance increases").to.lt(afterBalance);
            expect(beforeTotalSupply, "total supply increases").to.lt(afterTotalSupply);
        });
    });
});
