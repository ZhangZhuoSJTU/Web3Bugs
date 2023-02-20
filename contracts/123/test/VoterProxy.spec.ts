import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4 } from "../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import {
    Booster,
    VoterProxy,
    MockVoteStorage,
    MockVoteStorage__factory,
    MockERC20,
    MockERC20__factory,
    ExtraRewardsDistributor,
    AuraLocker,
    AuraToken,
    BoosterOwner,
    PoolManagerSecondaryProxy,
    PoolManagerV3,
    ERC20__factory,
} from "../types/generated";
import { Signer } from "ethers";
import { hashMessage } from "@ethersproject/hash";
import { version } from "@snapshot-labs/snapshot.js/src/constants.json";
import { deployContract } from "../tasks/utils";
import { increaseTime, increaseTimeTo } from "../test-utils/time";
import { simpleToExactAmount } from "../test-utils/math";
import { ZERO_ADDRESS, ZERO } from "../test-utils/constants";
import { impersonateAccount } from "../test-utils/fork";

const eip1271MagicValue = "0x1626ba7e";

const data = {
    version,
    timestamp: (Date.now() / 1e3).toFixed(),
    space: "balancer.eth",
    type: "single-choice",
    payload: {
        proposal: "0x21ea31e896ec5b5a49a3653e51e787ee834aaf953263144ab936ed756f36609f",
        choice: 1,
        metadata: JSON.stringify({}),
    },
};

const msg = JSON.stringify(data);
const hash = hashMessage(msg);
const invalidHash = hashMessage(JSON.stringify({ ...data, version: "faux" }));

describe("VoterProxy", () => {
    let accounts: Signer[];
    let voterProxy: VoterProxy;
    let booster: Booster;
    let extraRewardsDistributor: ExtraRewardsDistributor;
    let mocks: DeployMocksResult;
    let auraLocker: AuraLocker;
    let cvx: AuraToken;
    let poolManagerSecondaryProxy: PoolManagerSecondaryProxy;
    let boosterOwner: BoosterOwner;
    let poolManager: PoolManagerV3;

    let deployer: Signer;
    let deployerAddress: string;
    let daoMultisig: Signer;

    before(async () => {
        accounts = await ethers.getSigners();

        deployer = accounts[0];
        deployerAddress = await deployer.getAddress();

        mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[1], accounts[2], accounts[3]);
        daoMultisig = await ethers.getSigner(multisigs.daoMultisig);
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
        await phase3.poolManager.connect(daoMultisig).setProtectPool(false);
        const contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        voterProxy = contracts.voterProxy;
        booster = contracts.booster;
        extraRewardsDistributor = contracts.extraRewardsDistributor;
        auraLocker = contracts.cvxLocker;
        cvx = contracts.cvx;
        boosterOwner = contracts.boosterOwner;
        poolManagerSecondaryProxy = contracts.poolManagerSecondaryProxy;
        poolManager = contracts.poolManager;

        const operatorAccount = await impersonateAccount(contracts.booster.address);
        await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await contracts.cvx
            .connect(operatorAccount.signer)
            .transfer(await deployer.getAddress(), simpleToExactAmount(1000));
    });

    describe("validates vote hash from Snapshot Hub", async () => {
        it("with a valid hash", async () => {
            const sig = await deployer.signMessage(msg);
            let tx = await booster.connect(daoMultisig).setVote(hash, true);
            await expect(tx).to.emit(voterProxy, "VoteSet").withArgs(hash, true);

            let isValid = await voterProxy.isValidSignature(hash, sig);
            expect(isValid).to.equal(eip1271MagicValue);

            tx = await booster.connect(daoMultisig).setVote(hash, false);
            await expect(tx).to.emit(voterProxy, "VoteSet").withArgs(hash, false);
            isValid = await voterProxy.isValidSignature(invalidHash, sig);
            expect(isValid).to.equal("0xffffffff");
        });

        it("with an invalid hash", async () => {
            const sig = await deployer.signMessage(msg);
            const tx = await booster.connect(daoMultisig).setVote(hash, true);
            await expect(tx).to.emit(voterProxy, "VoteSet").withArgs(hash, true);
            const isValid = await voterProxy.isValidSignature(invalidHash, sig);
            expect(isValid).to.equal("0xffffffff");
        });
    });

    describe("generate message hash from vote", () => {
        let mockVoteStorage: MockVoteStorage;

        before(async () => {
            mockVoteStorage = await deployContract<MockVoteStorage>(
                hre,
                new MockVoteStorage__factory(deployer),
                "MockVoteStorage",
                [],
                {},
                false,
            );
        });

        it("generates a valid hash", async () => {
            const tx = await mockVoteStorage.setProposal(
                data.payload.choice,
                data.timestamp,
                data.version,
                data.payload.proposal,
                data.space,
                data.type,
            );

            await tx.wait();
            const hashResult = await mockVoteStorage.hash(data.payload.proposal);

            expect(hash).to.equal(hashResult);
        });
    });

    describe("when not authorised", () => {
        it("can not call release", async () => {
            const eoa = accounts[5];
            const tx = voterProxy.connect(eoa).release();
            await expect(tx).to.revertedWith("!auth");
        });
        it("can not call setRewardDeposit", async () => {
            const eoa = accounts[5];
            const eoaAddress = await eoa.getAddress();
            const tx = voterProxy.connect(eoa).setRewardDeposit(await deployer.getAddress(), eoaAddress);
            await expect(tx).to.revertedWith("!auth");
        });
        it("can not call setSystemConfig", async () => {
            const eoa = accounts[5];
            const tx = voterProxy.connect(eoa).setSystemConfig(ZERO_ADDRESS, ZERO_ADDRESS);
            await expect(tx).to.revertedWith("!auth");
        });
        it("can not call withdraw", async () => {
            const eoa = accounts[5];
            const tx = voterProxy.connect(eoa)["withdraw(address)"](ZERO_ADDRESS);
            await expect(tx).to.revertedWith("!auth");
        });
    });

    describe("setting rewardDeposit", () => {
        it("allows owner to set reward deposit and withdrawer", async () => {
            expect(await voterProxy.withdrawer()).eq(ZERO_ADDRESS);
            expect(await voterProxy.rewardDeposit()).eq(ZERO_ADDRESS);
            await voterProxy
                .connect(daoMultisig)
                .setRewardDeposit(await daoMultisig.getAddress(), extraRewardsDistributor.address);
            expect(await voterProxy.withdrawer()).eq(await daoMultisig.getAddress());
            expect(await voterProxy.rewardDeposit()).eq(extraRewardsDistributor.address);
        });
    });

    describe("when withdrawing tokens", () => {
        it("can not withdraw protected tokens", async () => {
            let tx = voterProxy.connect(daoMultisig)["withdraw(address)"](mocks.crv.address);
            await expect(tx).to.revertedWith("protected");
            tx = voterProxy.connect(daoMultisig)["withdraw(address)"](mocks.crvBpt.address);
            await expect(tx).to.revertedWith("protected");
        });

        it("can withdraw unprotected tokens", async () => {
            const deployerAddress = await deployer.getAddress();
            const randomToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "RandomToken",
                ["randomToken", "randomToken", 18, deployerAddress, 10000000],
                {},
                false,
            );

            const balance = await randomToken.balanceOf(deployerAddress);
            await randomToken.transfer(voterProxy.address, balance);

            const cvxAmount = simpleToExactAmount(10);

            await cvx.approve(auraLocker.address, cvxAmount);
            await auraLocker.lock(deployerAddress, cvxAmount);
            await increaseTime(86400 * 7);

            await voterProxy.connect(daoMultisig)["withdraw(address)"](randomToken.address);
            const rewardDepositBalance = await randomToken.balanceOf(extraRewardsDistributor.address);
            expect(balance).eq(rewardDepositBalance);
        });
    });

    describe("setting setSystemConfig", () => {
        it("allows owner to set external system config", async () => {
            const eoa = accounts[6];
            const eoa7 = accounts[7];
            const eoaAddress = await eoa.getAddress();
            const eoaAddress7 = await eoa7.getAddress();
            await voterProxy.connect(daoMultisig).setSystemConfig(eoaAddress, eoaAddress7);
            expect(await voterProxy.gaugeController()).eq(eoaAddress);
            expect(await voterProxy.mintr()).eq(eoaAddress7);
        });
    });

    describe("when shutting down", async () => {
        it("call shutdown on the booster", async () => {
            // 1. shutdown pools via poolManagerProxy
            const poolLength = await booster.poolLength();
            for (let i = 0; i < Number(poolLength.toString()); i++) {
                await poolManager.connect(daoMultisig).shutdownPool(i);
            }

            // 2. shutdown system on poolManagerSecondaryProxy
            await poolManagerSecondaryProxy.connect(daoMultisig).shutdownSystem();

            // 3. shutdown system on booster owner
            await boosterOwner.connect(daoMultisig).shutdownSystem();
            const isShutdown = await booster.isShutdown();
            expect(isShutdown).eq(true);
        });

        it("update operator and depositor to EOA", async () => {
            await voterProxy.connect(daoMultisig).setDepositor(deployerAddress);
            const depositor = await voterProxy.depositor();
            expect(depositor).eq(deployerAddress);

            await voterProxy.connect(daoMultisig).setOperator(deployerAddress);
            const operator = await voterProxy.operator();
            expect(operator).eq(deployerAddress);
        });

        it("release CRV from lock", async () => {
            const expectedWithdraw = await mocks.votingEscrow.balanceOf(voterProxy.address);

            const balanceBefore = await mocks.crvBpt.balanceOf(voterProxy.address);
            const tx = voterProxy.release();
            await expect(tx).to.revertedWith("!unlocked");

            const unlocktime = await mocks.votingEscrow.lockTimes(voterProxy.address);
            await increaseTimeTo(unlocktime.add("1"));

            await voterProxy.release();
            const balanceAfter = await mocks.crvBpt.balanceOf(voterProxy.address);
            expect(balanceAfter.sub(balanceBefore)).eq(expectedWithdraw);
        });

        it("migrate tokens", async () => {
            const balance = await mocks.crvBpt.balanceOf(voterProxy.address);
            const receiverAcc = await accounts[7].getAddress();
            const data = mocks.crvBpt.interface.encodeFunctionData("transfer", [receiverAcc, balance]);
            await voterProxy.execute(mocks.crvBpt.address, "0", data);

            const newBalance = await mocks.crvBpt.balanceOf(voterProxy.address);
            expect(newBalance).eq(ZERO);

            const receiverAccBalance = await mocks.crvBpt.balanceOf(receiverAcc);
            expect(receiverAccBalance).eq(balance);
        });
    });
});
