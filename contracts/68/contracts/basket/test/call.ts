import chai, { expect } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { ethers, run, network } from "hardhat";
import { Signer, constants, BigNumber, utils, Contract, BytesLike } from "ethers";

import BasketFacetArtifact from "../artifacts/contracts/facets/Basket/BasketFacet.sol/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/contracts/facets/ERC20/ERC20Facet.sol/ERC20Facet.json";
import CallFacetArtifact from "../artifacts/contracts/facets/Call/CallFacet.sol/CallFacet.json";
import MockTokenArtifact from "../artifacts/contracts/test/MockToken.sol/MockToken.json";
import { ERC20Facet, BasketFacet, CallFacet, DiamondFactoryContract, MockToken } from "../typechain";
import { IExperiPie__factory as IExperiPieFactory } from "../typechain/factories/IExperiPie__factory";
import { IExperiPie } from "../typechain/IExperiPie";
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

describe("CallFacet", function () {
    this.timeout(300000000);

    let experiPie: IExperiPie;
    let account: string;
    let signers: Signer[];
    let timeTraveler: TimeTraveler;
    const testTokens: MockToken[] = [];

    before(async () => {
        signers = await ethers.getSigners();
        account = await signers[0].getAddress();
        timeTraveler = new TimeTraveler(network.provider);

        const diamondFactory = (await run("deploy-diamond-factory")) as DiamondFactoryContract;

        const basketFacet = (await deployContract(signers[0], BasketFacetArtifact)) as BasketFacet;
        const erc20Facet = (await deployContract(signers[0], Erc20FacetArtifact)) as ERC20Facet;
        const callFacet = (await deployContract(signers[0], CallFacetArtifact)) as CallFacet;

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
                },
                {
                    action: FacetCutAction.Add,
                    facetAddress: callFacet.address,
                    functionSelectors: getSelectors(callFacet)
                }
            ]
        )

        const experiPieAddress = await diamondFactory.diamonds(0);
        experiPie = IExperiPieFactory.connect(experiPieAddress, signers[0]);

        for (let i = 0; i < 3; i++) {
            const token = await (deployContract(signers[0], MockTokenArtifact, ["Mock", "Mock"])) as MockToken;
            await token.mint(parseEther("1000000"), account);
            testTokens.push(token);
        }

        await timeTraveler.snapshot();
    });

    beforeEach(async () => {
        await timeTraveler.revertSnapshot();
    });

    describe("Call test", async () => {
        it("Test lock call", async () => {
            const lockBlock = (await ethers.provider.getBlockNumber()) + 100;

            const call = await experiPie.populateTransaction.setLock(lockBlock);

            await experiPie.call(
                [call.to],
                [call.data],
                [0]
            );

            const lockBlockValue = await experiPie.getLockBlock();
            const lock = await experiPie.getLock();
            expect(lockBlockValue).to.eq(lockBlock);
            expect(lock).to.be.true;
        });
        it("Send contract ether", async () => {
            let ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq("0");

            await signers[0].sendTransaction({ to: experiPie.address, value: parseEther("10") });

            ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq(parseEther("10"));

            const user = await signers[4].getAddress();

            const userBalanceBefore = await ethers.provider.getBalance(user);

            await experiPie.call([user], ["0x00"], [parseEther("9")]);

            ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq(parseEther("1"));


            const userBalanceAfter = await ethers.provider.getBalance(user);

            const difference = userBalanceAfter.sub(userBalanceBefore);
            expect(difference).to.eq(parseEther("9"));
        });
        it("Sending ether while not having enough balance should throw an error", async () => {
            let ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq("0");

            await signers[0].sendTransaction({ to: experiPie.address, value: parseEther("10") });

            ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq(parseEther("10"));

            const user = await signers[4].getAddress();

            await expect(experiPie.call([user], ["0x00"], [parseEther("10.1")])).to.be.revertedWith("ETH_BALANCE_TOO_LOW");
        });
        it("Send contract erc20 token", async () => {
            let balance = await testTokens[0].balanceOf(experiPie.address);
            expect(balance).to.eq(0);

            await testTokens[0].transfer(experiPie.address, parseEther("1000"));

            balance = await testTokens[0].balanceOf(experiPie.address);
            expect(balance).to.eq(parseEther("1000"));

            const call = await testTokens[0].populateTransaction.transfer(account, parseEther("800"));

            await experiPie.call(
                [call.to],
                [call.data],
                [0]
            );

            balance = await testTokens[0].balanceOf(experiPie.address);
            expect(balance).to.eq(parseEther("200"));
        });
        it("Lock + send ether + send erc20", async () => {
            const latestBlock = await ethers.provider.getBlockNumber();

            await experiPie.setLock(latestBlock - 1);
            await signers[0].sendTransaction({ to: experiPie.address, value: parseEther("1") });

            const token = testTokens[0];

            await token.transfer(experiPie.address, parseEther("200"));

            const balance = await token.balanceOf(experiPie.address);
            expect(balance).to.eq(parseEther("200"));

            const calls: any[] = [];

            const lockCall = await experiPie.populateTransaction.setLock(latestBlock + 100);
            lockCall.value = constants.Zero;
            const tokenCall = await token.populateTransaction.transfer(account, parseEther("200"));
            tokenCall.value = constants.Zero;
            const etherCall = { to: constants.AddressZero, value: parseEther("1"), data: "0x00" };

            await experiPie.call(
                [lockCall.to, tokenCall.to, etherCall.to],
                [lockCall.data, tokenCall.data, etherCall.data],
                [lockCall.value, tokenCall.value, etherCall.value],
            )

            const lock = await experiPie.getLock();
            expect(lock).to.be.true;
            const ether = await ethers.provider.getBalance(experiPie.address);
            expect(ether).to.eq(0);
            const balanceAfter = await token.balanceOf(experiPie.address);
            expect(balanceAfter).to.eq("0");
        });
    });

    describe("Access to call function", async () => {
        it("Owner should be able to call", async () => {
            const call = await experiPie.populateTransaction.setLock(1337);

            await experiPie.call(
                [call.to],
                [call.data],
                [0]
            );

            const lockBlock = await experiPie.getLockBlock();
            expect(lockBlock).to.eq(1337);
        });
        it("Whitelisted caller should be able to call", async () => {
            const call = await experiPie.populateTransaction.setLock(1337);

            await experiPie.addCaller(await signers[1].getAddress());

            await experiPie.connect(signers[1]).call(
                [call.to],
                [call.data],
                [0]
            );

            const lockBlock = await experiPie.getLockBlock();
            expect(lockBlock).to.eq(1337);
        });
        it("Non privileged user should not be able to call", async () => {
            const call = await experiPie.populateTransaction.setLock(1337);

            await expect(experiPie.connect(signers[1]).call(
                [call.to],
                [call.data],
                [0]
            )).to.be.revertedWith("NOT_ALLOWED");
        });
    });

    describe("Adding and removal of callers", async () => {

        const PLACE_HOLDER_1 = "0x0000000000000000000000000000000000000001";
        const PLACE_HOLDER_2 = "0x0000000000000000000000000000000000000002";
        const PLACE_HOLDER_3 = "0x000000000000000000000000000000000000aaaa";

        it("Adding a caller should work", async () => {
            await experiPie.addCaller(PLACE_HOLDER_1);

            const canCall = await experiPie.canCall(PLACE_HOLDER_1);
            const callers = await experiPie.getCallers();

            expect(canCall).to.be.true;
            expect(callers.length).to.eq(1);
            expect(callers[0]).to.eq(PLACE_HOLDER_1);
        });
        it("Adding multiple callers should work", async () => {
            await experiPie.addCaller(PLACE_HOLDER_1);
            await experiPie.addCaller(PLACE_HOLDER_2);

            const canCall1 = await experiPie.canCall(PLACE_HOLDER_1);
            const canCall2 = await experiPie.canCall(PLACE_HOLDER_2);
            const callers = await experiPie.getCallers();

            expect(canCall1).to.be.true;
            expect(canCall2).to.be.true;
            expect(callers.length).to.eq(2);
            expect(callers[0]).to.eq(PLACE_HOLDER_1);
            expect(callers[1]).to.eq(PLACE_HOLDER_2);
        });
        it("Adding a caller from a non owner should fail", async () => {
            await expect(experiPie.connect(signers[1]).addCaller(PLACE_HOLDER_1)).to.be.revertedWith("NOT_ALLOWED");
        });
        it("Adding more than 50 callers should fail", async () => {
            for (let i = 0; i < 50; i++) {
                const address = utils.hexZeroPad([i + 1], 20);
                await experiPie.addCaller(address);
            }

            await expect(experiPie.addCaller(PLACE_HOLDER_3)).to.be.revertedWith("TOO_MANY_CALLERS");
        });
        it("Adding the zero address as caller should fail", async () => {
            await expect(experiPie.addCaller(constants.AddressZero)).to.be.revertedWith("INVALID_CALLER");
        });
        it("Removing a caller should work", async () => {
            await experiPie.addCaller(PLACE_HOLDER_1);
            await experiPie.removeCaller(PLACE_HOLDER_1);

            const canCall = await experiPie.canCall(PLACE_HOLDER_1);
            const callers = await experiPie.getCallers();

            expect(canCall).to.be.false;
            expect(callers.length).to.eq(0);
        });
        it("Removing a caller from a non owner should fail", async () => {
            await experiPie.addCaller(PLACE_HOLDER_1);
            await expect(experiPie.connect(signers[1]).removeCaller(PLACE_HOLDER_1)).to.be.revertedWith("NOT_ALLOWED");
        });
        it("Removing one of multiple callers should work", async () => {
            await experiPie.addCaller(PLACE_HOLDER_1);
            await experiPie.addCaller(PLACE_HOLDER_2);
            await experiPie.removeCaller(PLACE_HOLDER_1);

            const canCall1 = await experiPie.canCall(PLACE_HOLDER_1);
            const canCall2 = await experiPie.canCall(PLACE_HOLDER_2);
            const callers = await experiPie.getCallers();

            expect(canCall1).to.be.false;
            expect(canCall2).to.be.true;
            expect(callers[0]).to.eq(PLACE_HOLDER_2);
            expect(callers.length).to.eq(1);
        });
    });
});