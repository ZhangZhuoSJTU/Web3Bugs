import chai, { expect } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { ethers, run, network } from "hardhat";
import { Signer, constants, utils, Contract, BytesLike } from "ethers";
import EthSingleTokenJoinArtifact from "../artifacts/contracts/singleJoinExit/EthSingleTokenJoin.sol/EthSingleTokenJoin.json";
import BasketFacetArtifact from "../artifacts/contracts/facets/Basket/BasketFacet.sol/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/contracts/facets/ERC20/ERC20Facet.sol/ERC20Facet.json";
import MockTokenArtifact from "../artifacts/contracts/test/MockToken.sol/MockToken.json";
import MockNativeTokenArtifact from "../artifacts/contracts/test/MockNativeToken.sol/MockNativeToken.json";
import MockPangolinRouterArtifact from "../artifacts/contracts/test/MockPangolinRouter.sol/MockPangolinRouter.json";
import { ERC20Facet, BasketFacet, DiamondFactoryContract, MockToken, MockPangolinRouter, MockNativeToken } from "../typechain";
import { IExperiPie__factory as IExperiPieFactory } from "../typechain/factories/IExperiPie__factory";
import { IExperiPie } from "../typechain/IExperiPie";
import { EthSingleTokenJoin } from "../typechain/EthSingleTokenJoin";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";

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
            
            const totalSupplyBefore = await experiPie.totalSupply();
            const userBalancesBefore = await getBalances(account);
            const pieBalancesBefore = await getBalances(experiPie.address);


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

            const totalSupplyAfter = await experiPie.totalSupply();
            const userBalancesAfter = await getBalances(account);
            const pieBalancesAfter = await getBalances(experiPie.address);
            
            const expectedTokenAmount = pieBalancesBefore.t0.mul(mintAmount).div(totalSupplyBefore);
            calcTokenFor.amounts.forEach(amount => {
                expect(amount).to.be.eq(expectedTokenAmount)
            });

            expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount));

            // Verify user balances
            expect(userBalancesAfter.pie).to.eq(userBalancesBefore.pie.add(mintAmount));
            expect(userBalancesBefore.eth).to.eq(userBalancesAfter.eth.add(inputAmount.div(testTokens.length + 1).mul(testTokens.length)).add(txReq.gasPrice.mul(tx.gasUsed)));
            
            
            // Verify pie balances
            expect(pieBalancesAfter.t0).to.eq(pieBalancesBefore.t0.add(expectedTokenAmount));
            expect(pieBalancesAfter.t1).to.eq(pieBalancesBefore.t1.add(expectedTokenAmount));
            expect(pieBalancesAfter.t2).to.eq(pieBalancesBefore.t2.add(expectedTokenAmount));
        });

    });
})

export async function setupBasket(signers: Signer[], mockedPangolinRouter: MockPangolinRouter, account: string, mockWavax: MockNativeToken, experiPie: IExperiPie, testTokens: MockToken[]) {
    const diamondFactory = (await run("deploy-diamond-factory")) as DiamondFactoryContract;

    const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
    const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as ERC20Facet;
    mockedPangolinRouter = (await deployContract(signers[0], MockPangolinRouterArtifact)) as MockPangolinRouter;

    await diamondFactory.deployNewDiamond(
        account,
        [
            {
                action: FacetCutAction.Add,
                facetAddress: basketFacet.address,
                functionSelectors: getSelectors(basketFacet)
            },
            {
                action: FacetCutAction.Add,
                facetAddress: erc20Facet.address,
                functionSelectors: getSelectors(erc20Facet)
            }
        ]
    );
    mockWavax = await (deployContract(signers[0], MockNativeTokenArtifact, ["Mock", "Mock"])) as MockNativeToken;
    const experiPieAddress = await diamondFactory.diamonds(0);
    experiPie = IExperiPieFactory.connect(experiPieAddress, signers[0]);

    for (let i = 0; i < 3; i++) {
        const token = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;
        await token.mint(parseEther("1000"), account);
        testTokens.push(token);
    }
    return { mockedPangolinRouter, mockWavax, experiPie };
}
