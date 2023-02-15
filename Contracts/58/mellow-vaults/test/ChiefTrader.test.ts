import { expect } from "chai";
import { deployments, getNamedAccounts, ethers } from "hardhat";
import { ChiefTrader } from "./types/ChiefTrader";
import { UniV3Trader } from "./types/UniV3Trader";
import { ProtocolGovernance } from "./types/ProtocolGovernance";
import { withSigner, encodeToBytes } from "./library/Helpers";

describe("ChiefTrader", () => {
    let admin: string;
    let deployer: string;
    let stranger: string;
    let chiefTrader: ChiefTrader;
    let uniV3Trader: UniV3Trader;
    let protocolGovernance: ProtocolGovernance;
    let deploymentFixture: Function;

    before(async () => {
        ({ deployer, stranger, admin } = await getNamedAccounts());
        deploymentFixture = deployments.createFixture(async () => {
            await deployments.fixture();
            const { get } = deployments;
            chiefTrader = await ethers.getContractAt(
                "ChiefTrader",
                (
                    await get("ChiefTrader")
                ).address
            );
            uniV3Trader = await ethers.getContractAt(
                "UniV3Trader",
                (
                    await get("UniV3Trader")
                ).address
            );
            protocolGovernance = await ethers.getContractAt(
                "ProtocolGovernance",
                (
                    await get("ProtocolGovernance")
                ).address
            );
        });
    });

    beforeEach(async () => {
        await deploymentFixture();
    });

    describe("#protocolGovernance", () => {
        it("returns correct initial protocol governance address", async () => {
            expect(await chiefTrader.protocolGovernance()).to.equal(
                protocolGovernance.address
            );
        });
    });

    describe("#traders", () => {
        xit("returns correct initial registered traders", async () => {
            expect(await chiefTrader.traders()).to.deep.equal([
                uniV3Trader.address,
            ]);
        });
    });

    describe("#tradersCount", () => {
        xit("returns correct initial traders count", async () => {
            expect(await chiefTrader.tradersCount()).to.equal(1);
        });
    });

    describe("#addTrader", () => {
        describe("when interfaces do not match", () => {
            it("reverts", async () => {
                await expect(
                    chiefTrader.addTrader(
                        (
                            await ethers.getContract("ProtocolGovernance")
                        ).address
                    )
                ).to.be.reverted;
            });
        });

        describe("when trying to add itself", () => {
            it("reverts", async () => {
                withSigner(admin, async (signer) => {
                    await expect(
                        chiefTrader
                            .connect(signer)
                            .addTrader(chiefTrader.address)
                    ).to.be.revertedWith("RE");
                });
            });
        });

        describe("when called not by protocol admin", () => {
            it("reverts", async () => {
                withSigner(stranger, async (signer) => {
                    await expect(
                        chiefTrader
                            .connect(signer)
                            .addTrader(uniV3Trader.address)
                    ).to.be.revertedWith("PA");
                });
            });
        });

        describe("happy case", () => {
            xit("adds new trader", async () => {
                withSigner(admin, async (signer) => {
                    const { uniswapV3Router } = await getNamedAccounts();
                    let newTrader = await (
                        await ethers.getContractFactory("UniV3Trader")
                    ).deploy(uniswapV3Router);
                    await chiefTrader
                        .connect(signer)
                        .addTrader(newTrader.address);
                    expect(await chiefTrader.traders()).to.deep.equal([
                        uniV3Trader.address,
                        newTrader.address,
                    ]);
                    expect(await chiefTrader.tradersCount()).to.equal(2);
                });
            });
        });
    });
});
