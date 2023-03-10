import chai, { expect } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { ethers, run, network } from "hardhat";
import { Signer, constants, utils, Contract, BytesLike, BigNumber } from "ethers";
import EthSingleTokenJoinArtifact from "../artifacts/contracts/singleJoinExit/EthSingleTokenJoin.sol/EthSingleTokenJoin.json";
import SingleNativeTokenExitArtifact from "../artifacts/contracts/singleJoinExit/SingleNativeTokenExit.sol/SingleNativeTokenExit.json";

import { MockToken, MockPangolinRouter, MockNativeToken } from "../typechain";
import { IExperiPie } from "../typechain/IExperiPie";
import { EthSingleTokenJoin } from "../typechain/EthSingleTokenJoin";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";
import { setupBasket } from "./ethSingleTokenJoin";
import { SingleNativeTokenExit } from "../typechain/SingleNativeTokenExit";

chai.use(solidity);

const FacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2,
};

function getSelectors(contract: Contract) {
    const signatures: BytesLike[] = [];
    for (const key of Object.keys(contract.functions)) {
        signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
    }

    return signatures;
}
const referralCode = constants.Zero

describe("EthSingleTokenJoin", function () {
    this.timeout(300000000);

    let experiPie: IExperiPie;
    let singleTokenJoin: EthSingleTokenJoin;
    let singleNativeTokenExit: SingleNativeTokenExit;
    let account: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
    const testTokens: MockToken[] = [];
    let mockWavax: MockNativeToken;
    let mockedPangolinRouter: MockPangolinRouter;
    before(async () => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(network.provider);

        ({ mockedPangolinRouter, mockWavax, experiPie } = await setupBasket(signers, mockedPangolinRouter, account, mockWavax, experiPie, testTokens));
        singleTokenJoin = (await deployContract(signers[0], EthSingleTokenJoinArtifact, [mockWavax.address, mockedPangolinRouter.address])) as EthSingleTokenJoin;
        singleNativeTokenExit = (await deployContract(signers[0], SingleNativeTokenExitArtifact, [mockWavax.address, mockedPangolinRouter.address])) as SingleNativeTokenExit;

        await timeTraveler.snapshot();
    });

    beforeEach(async () => {
        await timeTraveler.revertSnapshot();
    });

    describe("Joining and exiting", async () => {
        beforeEach(async () => {
            for (let token of testTokens) {
                await token.approve(experiPie.address, constants.MaxUint256);
                await token.transfer(experiPie.address, parseEther("1000"));
                const account1 = await signers[1].getAddress();
                await token.mint(parseEther("1000"), account1);
                token.connect(signers[1]).approve(experiPie.address, constants.MaxUint256);
                await experiPie.addToken(token.address);
            }

            await experiPie.initialize(parseEther("1000"), "TEST", "TEST");
            await experiPie.setLock(constants.One);
            await experiPie.setCap(constants.MaxUint256);
        });

        const getBalances = async (address: string) => {
            return {
                t0: await testTokens[0].balanceOf(address),
                t1: await testTokens[1].balanceOf(address),
                t2: await testTokens[2].balanceOf(address),
                pie: await experiPie.balanceOf(address),
                eth: await ethers.provider.getBalance(address)
            }
        }

        it("Join pool with too much wavax as input token", async () => {
            const mintAmount = parseEther("1");

            const calcTokenFor = await experiPie.calcTokensForAmount(mintAmount);
            const inputToken = mockWavax;

            const outputToken = experiPie.address
            const inputAmount = parseEther("1000")
            await mockedPangolinRouter.setAmountIn(inputAmount.div(testTokens.length + 1))
            await mockedPangolinRouter.setAmountOut(mintAmount)
            


            const outputAmount = parseEther("1").toString()
            const block = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());

            const deadline = block.timestamp + 3000

            const parameterFroSingleJoin = {
                inputToken: inputToken.address,
                outputBasket: outputToken,
                inputAmount,
                outputAmount,
                deadline,
                referral: referralCode,
            }
            const txReq = await singleTokenJoin.joinTokenEth(parameterFroSingleJoin, {
                value: inputAmount.toHexString()
            });
            const tx = await (txReq).wait();


            await mockedPangolinRouter.setAmountIn('1')
            await mockedPangolinRouter.setAmountOut('10')


            await experiPie.approve(singleNativeTokenExit.address, constants.MaxUint256);

            const totalSupplyBefore = await experiPie.totalSupply();
            const userBalancesBefore = await getBalances(account);
            const pieBalancesBefore = await getBalances(experiPie.address);

            const exitTxReq = await singleNativeTokenExit.exitEth({
                inputBasket: outputToken,
                inputAmount: outputAmount,
                minAmount: 0,
                deadline,
                referral: referralCode
            })

            const exitTx = await exitTxReq.wait();

            const totalSupplyAfter = await experiPie.totalSupply();
            const userBalancesAfter = await getBalances(account);
            const pieBalancesAfter = await getBalances(experiPie.address);
            

            // Verify user balances
            expect(userBalancesAfter.eth).to.eq(userBalancesBefore.eth.add(BigNumber.from(outputAmount).mul(10).mul(testTokens.length)).sub(exitTxReq.gasPrice.mul(exitTx.gasUsed)));
        
        });

    });
})