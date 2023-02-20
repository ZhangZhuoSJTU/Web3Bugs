import hre, { ethers } from "hardhat";
import { BigNumber as BN, Signer } from "ethers";
import { expect } from "chai";
import {
    deployPhase1,
    deployPhase2,
    deployPhase3,
    deployPhase4,
    SystemDeployed,
    MultisigConfig,
} from "../scripts/deploySystem";
import { deployMocks, DeployMocksResult, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import {
    BalLiquidityProvider,
    MockERC20__factory,
    MockERC20,
    MockBalancerPoolToken__factory,
    MockBalancerVault__factory,
    BalLiquidityProvider__factory,
} from "../types/generated";
import { JoinPoolRequestStruct } from "../types/generated/BalLiquidityProvider";
import { simpleToExactAmount, ZERO_ADDRESS, ZERO_KEY } from "../test-utils";
import { impersonateAccount } from "../test-utils/fork";
import { Account } from "types";

describe("BalLiquidityProvider", () => {
    let accounts: Signer[];
    let contracts: SystemDeployed;
    let mocks: DeployMocksResult;
    let deployer: Signer;
    let alice: Signer;
    let daoAccount: Account;
    let multisigs: MultisigConfig;
    let startTokenContract: MockERC20;
    let pairTokenContract: MockERC20;

    let balLiquidityProvider: BalLiquidityProvider;

    /* -- Declare shared functions -- */

    const setup = async () => {
        accounts = await ethers.getSigners();

        deployer = accounts[0];
        alice = accounts[1];

        mocks = await deployMocks(hre, deployer);
        multisigs = await getMockMultisigs(accounts[1], accounts[2], accounts[3]);
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
        const protocolDAO = await impersonateAccount(multisigs.daoMultisig);
        await phase3.poolManager.connect(protocolDAO.signer).setProtectPool(false);
        contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        // Setup test contract.
        balLiquidityProvider = contracts.balLiquidityProvider;
        startTokenContract = new MockERC20__factory(deployer).attach(await balLiquidityProvider.startToken());
        pairTokenContract = new MockERC20__factory(deployer).attach(await balLiquidityProvider.pairToken());
        daoAccount = await impersonateAccount(multisigs.treasuryMultisig);
    };

    before("init contract", async () => {
        await setup();
    });
    describe("constructor", async () => {
        it("should properly store valid arguments", async () => {
            expect(await balLiquidityProvider.startToken(), "startToken").to.eq(contracts.cvx.address);
            expect(await balLiquidityProvider.pairToken(), "pairToken").to.eq(mocks.addresses.weth);
            expect(await balLiquidityProvider.minPairAmount(), "minPairAmount").to.eq(simpleToExactAmount(375));
            expect(await balLiquidityProvider.dao(), "dao").to.eq(multisigs.treasuryMultisig);
            expect(await balLiquidityProvider.bVault(), "bVault").to.eq(mocks.addresses.balancerVault);
        });
        it("initial liquidity", async () => {
            const startTokenBalance = await startTokenContract.balanceOf(balLiquidityProvider.address);
            const pairTokenBalance = await pairTokenContract.balanceOf(balLiquidityProvider.address);
            expect(startTokenBalance, "initial start token liquidity").to.eq(simpleToExactAmount(2800000));
            expect(pairTokenBalance, "initial pair token ").to.eq(0);
        });
    });

    describe("@method provideLiquidity", async () => {
        let joinPoolRequest: JoinPoolRequestStruct;
        let poolTokens = [];
        let poolId = "";
        beforeEach(async () => {
            poolId = contracts.pool8020Bpt.poolId;
            poolTokens = [await balLiquidityProvider.startToken(), await balLiquidityProvider.pairToken()];
            const startTokenBalance = await startTokenContract.balanceOf(balLiquidityProvider.address);
            const pairTokenBalance = await pairTokenContract.balanceOf(balLiquidityProvider.address);
            const initialBalances = [startTokenBalance, pairTokenBalance];

            joinPoolRequest = {
                assets: poolTokens,
                maxAmountsIn: initialBalances,
                userData: ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]"], [0, initialBalances]),
                fromInternalBalance: false,
            };
        });
        it("fails if sender is not authorized ", async () => {
            await expect(
                balLiquidityProvider.connect(alice).provideLiquidity(poolId, joinPoolRequest),
                "unauthorized",
            ).to.be.revertedWith("!auth");
        });
        it("fails if the request is invalid", async () => {
            joinPoolRequest.assets = [await balLiquidityProvider.startToken()];
            await expect(
                balLiquidityProvider.connect(deployer).provideLiquidity(poolId, joinPoolRequest),
                "invalid request",
            ).to.be.revertedWith("!valid");

            joinPoolRequest.assets = poolTokens;
            joinPoolRequest.maxAmountsIn = [simpleToExactAmount(80, 16)];
            await expect(
                balLiquidityProvider.connect(deployer).provideLiquidity(poolId, joinPoolRequest),
                "invalid request",
            ).to.be.revertedWith("!valid");
        });
        it("fails if the current balance is greater than the min pair amount", async () => {
            // Given pair token balance is greater than min pair amount
            const pairTokenBalance = await pairTokenContract.balanceOf(balLiquidityProvider.address);
            const minPairAmount = await balLiquidityProvider.minPairAmount();
            expect(pairTokenBalance, "pairTokenBalance").to.lte(minPairAmount);
            // When
            await expect(
                balLiquidityProvider.connect(deployer).provideLiquidity(poolId, joinPoolRequest),
                "fails due to ",
            ).to.be.revertedWith("!minLiq");
        });
        it("fails if it provides a different pair of assets", async () => {
            const assetsBefore = [...joinPoolRequest.assets];
            joinPoolRequest.assets[0] = mocks.bal.address;
            // Send some WETH to the liquidity provider to make sure it has enough to cover the request.
            await mocks.weth
                .connect(deployer)
                .transfer(balLiquidityProvider.address, (await balLiquidityProvider.minPairAmount()).add(1));
            expect(await mocks.weth.balanceOf(balLiquidityProvider.address)).to.gt(
                await balLiquidityProvider.minPairAmount(),
            );
            // When
            await expect(
                balLiquidityProvider.connect(deployer).provideLiquidity(poolId, joinPoolRequest),
                "invalid assets",
            ).to.be.revertedWith("!asset");
            // Given
            joinPoolRequest.assets = [...assetsBefore];
            joinPoolRequest.assets[1] = mocks.bal.address;
            // When
            await expect(
                balLiquidityProvider.connect(deployer).provideLiquidity(poolId, joinPoolRequest),
                "invalid assets",
            ).to.be.revertedWith("!asset");
        });
        it("fails if current balance is not equal to the max amount in", async () => {
            // Given
            const startTokenBalance = await startTokenContract.balanceOf(balLiquidityProvider.address);
            // set a wrong max amount in start token.
            joinPoolRequest.maxAmountsIn = [simpleToExactAmount(123), simpleToExactAmount(123)];
            expect(startTokenBalance, "initial start token balance").to.not.eq(joinPoolRequest.maxAmountsIn[0]);
            // When
            await expect(
                balLiquidityProvider.connect(deployer).provideLiquidity(poolId, joinPoolRequest),
                "start token balance does not match",
            ).to.be.revertedWith("!bal");
        });
        it("fails if target pool is already initialized", async () => {
            // Given
            const [poolAddress] = await mocks.balancerVault.getPool(poolId);
            const pool = await new MockERC20__factory(deployer).attach(poolAddress);
            const totalSupply = await pool.totalSupply();
            expect(totalSupply, "total supply").to.not.eq(0);
            // When
            await expect(
                balLiquidityProvider.connect(deployer).provideLiquidity(poolId, joinPoolRequest),
                "pool has been initialized",
            ).to.be.revertedWith("!init");
        });
        it("provideLiquidity to a new pool", async () => {
            // Given a new pool with no liquidity
            const stContract = mocks.bal;
            const ptContract = mocks.weth;
            const poolContract = await new MockBalancerPoolToken__factory(deployer).deploy(
                18,
                await deployer.getAddress(),
                simpleToExactAmount(0),
            );
            await poolContract.setPrice(simpleToExactAmount(1));

            const mockBalancerVault = await new MockBalancerVault__factory(deployer).deploy(poolContract.address);
            const mockBalLiquidityProvider = await new BalLiquidityProvider__factory(deployer).deploy(
                stContract.address,
                ptContract.address,
                0,
                multisigs.daoMultisig,
                mockBalancerVault.address,
            );
            await stContract.connect(deployer).transfer(mockBalLiquidityProvider.address, simpleToExactAmount(100));
            await ptContract.connect(deployer).transfer(mockBalLiquidityProvider.address, simpleToExactAmount(100));

            const tokens = [stContract.address, ptContract.address];
            const initialBalances = [
                await stContract.balanceOf(mockBalLiquidityProvider.address),
                await ptContract.balanceOf(mockBalLiquidityProvider.address),
            ];
            const pool = { address: poolContract.address, poolId: ZERO_KEY, tokens, initialBalances };

            const joinPoolRequest = {
                assets: pool.tokens,
                maxAmountsIn: pool.initialBalances,
                userData: ethers.utils.defaultAbiCoder.encode(
                    ["uint256", "uint256[]"],
                    [0, pool.initialBalances as BN[]],
                ),
                fromInternalBalance: false,
            };

            expect(await poolContract.balanceOf(multisigs.daoMultisig), "dap pool token balance").to.eq(0);
            expect(await poolContract.totalSupply(), "pool total supply").to.eq(0);

            // When it provides liquidity
            const tx = await mockBalLiquidityProvider.provideLiquidity(pool.poolId, joinPoolRequest);
            // Verify events, storage change, balance, etc.
            await expect(tx)
                .to.emit(mockBalLiquidityProvider, "LiquidityProvided")
                .withArgs(joinPoolRequest.maxAmountsIn, simpleToExactAmount(100));
            expect(await poolContract.balanceOf(multisigs.daoMultisig), "dap pool token balance").to.eq(
                simpleToExactAmount(100),
            );
            expect(await poolContract.totalSupply(), "pool total supply").to.eq(simpleToExactAmount(100));
        });
    });
    describe("@method changeMinPairAmount", async () => {
        it("should update the min pair amount", async () => {
            // Given
            const oldMinPairAmount = await balLiquidityProvider.minPairAmount();
            const newMinPairAmount = simpleToExactAmount(1);
            // When
            const tx = await balLiquidityProvider.connect(daoAccount.signer).changeMinPairAmount(newMinPairAmount);
            // Verify events, storage change, balance, etc.
            await expect(tx)
                .to.emit(balLiquidityProvider, "MinPairAmountChanged")
                .withArgs(oldMinPairAmount, newMinPairAmount);
            expect(await balLiquidityProvider.minPairAmount(), "minPairAmount").to.eq(newMinPairAmount);
        });
        it("fails if sender is not authorized ", async () => {
            await expect(
                balLiquidityProvider.connect(alice).changeMinPairAmount(0),
                "not authorized",
            ).to.be.revertedWith("!auth");
        });
    });
    describe("@method rescueToken", async () => {
        it("should rescue tokens from the contract", async () => {
            const wethBalance = await mocks.weth.balanceOf(balLiquidityProvider.address);
            expect(wethBalance, "weth balance").to.gt(0);
            await balLiquidityProvider.connect(deployer).rescueToken(mocks.weth.address);
            // Verify events, storage change, balance, etc.
            expect(await mocks.weth.balanceOf(balLiquidityProvider.address), "weth balance").to.eq(0);
            expect(await mocks.weth.balanceOf(daoAccount.address), "weth balance").to.eq(wethBalance);
        });
        it("fails if sender is not authorized ", async () => {
            await expect(
                balLiquidityProvider.connect(alice).rescueToken(ZERO_ADDRESS),
                "not authorized",
            ).to.be.revertedWith("!auth");
        });
    });
});
