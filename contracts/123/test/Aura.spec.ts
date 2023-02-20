import hre, { ethers } from "hardhat";
import { BigNumberish, Signer } from "ethers";
import { expect } from "chai";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4 } from "../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { Booster, VoterProxy, AuraToken, AuraMinter } from "../types/generated";
import { DEAD_ADDRESS, simpleToExactAmount, ZERO_ADDRESS } from "../test-utils";
import { impersonateAccount } from "../test-utils/fork";
import { Account } from "types";

const EMISSIONS_MAX_SUPPLY = 50000000;
const EMISSIONS_INIT_SUPPLY = 50000000;

describe("AuraToken", () => {
    let accounts: Signer[];
    let booster: Booster;
    let cvx: AuraToken;
    let minter: AuraMinter;
    let mocks: DeployMocksResult;
    let voterProxy: VoterProxy;
    let deployer: Signer;
    let alice: Signer;
    let aliceAddress: string;
    let aliceInitialCvxBalance: BigNumberish;
    let operatorAccount: Account;

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

        booster = contracts.booster;
        cvx = contracts.cvx;
        voterProxy = contracts.voterProxy;
        minter = contracts.minter;

        aliceInitialCvxBalance = await cvx.balanceOf(aliceAddress);
        operatorAccount = await impersonateAccount(booster.address);
    });

    it("initial configuration is correct", async () => {
        expect(await cvx.name()).to.equal(mocks.namingConfig.cvxName);
        expect(await cvx.symbol()).to.equal(mocks.namingConfig.cvxSymbol);
        expect(await cvx.operator()).to.equal(booster.address);
        expect(await cvx.vecrvProxy()).to.equal(voterProxy.address);
        // Expects to be pre-mined with 50 m tokens. (as per deployment script)
        expect(await cvx.totalSupply()).to.eq(simpleToExactAmount(EMISSIONS_INIT_SUPPLY));
        expect(await cvx.EMISSIONS_MAX_SUPPLY()).to.equal(simpleToExactAmount(EMISSIONS_MAX_SUPPLY));
        expect(await cvx.reductionPerCliff()).to.equal(simpleToExactAmount(EMISSIONS_MAX_SUPPLY).div(500));
    });
    describe("@method AuraToken.init fails if ", async () => {
        it("caller is not the operator", async () => {
            await expect(cvx.connect(deployer).init(DEAD_ADDRESS, 0, DEAD_ADDRESS)).to.revertedWith("Only operator");
        });
        it("called more than once", async () => {
            await expect(cvx.init(DEAD_ADDRESS, 0, DEAD_ADDRESS)).to.revertedWith("Only operator");
        });
        it("wrong amount of tokens", async () => {
            await expect(cvx.init(DEAD_ADDRESS, 0, DEAD_ADDRESS)).to.revertedWith("Only operator");
        });
        it("wrong minter address", async () => {
            await expect(cvx.init(DEAD_ADDRESS, 0, DEAD_ADDRESS)).to.revertedWith("Only operator");
        });
    });

    it("@method AuraToken.updateOperator sets new operator", async () => {
        const previousOperator = await cvx.operator();
        const tx = cvx.connect(deployer).updateOperator();
        await expect(tx).to.emit(cvx, "OperatorChanged").withArgs(previousOperator, booster.address);
    });
    it("@method AuraToken.mint does not mint if sender is not the operator", async () => {
        const beforeBalance = await cvx.balanceOf(aliceAddress);
        const beforeTotalSupply = await cvx.totalSupply();
        await cvx.mint(aliceAddress, 1000);
        const afterBalance = await cvx.balanceOf(aliceAddress);
        const afterTotalSupply = await cvx.totalSupply();
        expect(beforeBalance, "balance does not change").to.eq(afterBalance);
        expect(beforeTotalSupply, "total supply does not change").to.eq(afterTotalSupply);
    });
    it("@method AuraToken.minterMint fails if minter is not the caller", async () => {
        await expect(cvx.connect(alice).minterMint(aliceAddress, simpleToExactAmount(1))).to.revertedWith(
            "Only minter",
        );
    });
    it("@method AuraToken.mint mints per BAL yearly schedule ", async () => {
        const beforeTotalSupply = await cvx.totalSupply();
        // Year 1 - BAL emissions
        let tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(4536428.571, 18));
        await expect(tx).to.emit(cvx, "Transfer").withArgs(
            ZERO_ADDRESS,
            aliceAddress,
            simpleToExactAmount(17692071.4269, 18), // 17.6m
        );

        // Year 2 - BAL emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(3814666.524, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(11520292.90248, 18)); // 11.5m

        // Year 3 - BAL emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(3207739.405, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(7826884.1482, 18)); // 7.8m

        // Year 4 - BAL emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(2697376.567, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(5529621.96235, 18)); // 5.5m

        // Year 5 - BAL emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(2268214.286, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(4023812.143364, 18)); // 4m

        // Year 6 - BAL emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(1907333.262, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(3002142.554388, 18)); // 3m

        // Year 7 - BAL emissions
        tx = await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(1603869.703, 18));
        await expect(tx)
            .to.emit(cvx, "Transfer")
            .withArgs(ZERO_ADDRESS, aliceAddress, simpleToExactAmount(405174.862318, 18)); // 0.405m

        const afterBalance = await cvx.balanceOf(aliceAddress);
        const afterTotalSupply = await cvx.totalSupply();

        expect(aliceInitialCvxBalance, "balance does change").to.lt(afterBalance);
        expect(beforeTotalSupply, "total supply does change").to.lt(afterTotalSupply);
        expect(afterTotalSupply, "max supply reached").to.eq(
            simpleToExactAmount(EMISSIONS_MAX_SUPPLY + EMISSIONS_INIT_SUPPLY),
        );
    });
    it("@method AuraToken.minterMint mints additional AURA", async () => {
        // It should mint via minter
        const amount = simpleToExactAmount(100);
        const minterAccount = await impersonateAccount(minter.address);
        const tx = await cvx.connect(minterAccount.signer).minterMint(aliceAddress, amount);
        await expect(tx).to.emit(cvx, "Transfer").withArgs(ZERO_ADDRESS, aliceAddress, amount);
    });
    it("@method AuraToken.mint does not mint additional AURA", async () => {
        // it should does not to mint more tokens via scheduled mints as the max amount has been reached previously,
        const totalSupply = await cvx.totalSupply();
        await cvx.connect(operatorAccount.signer).mint(aliceAddress, simpleToExactAmount(1, 18));
        await expect(await cvx.totalSupply()).to.eq(totalSupply);
    });
});
