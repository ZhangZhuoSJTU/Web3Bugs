import { expect } from "chai";
import { deployments, getNamedAccounts, ethers } from "hardhat";
import Exceptions from "./library/Exceptions";
import { withSigner } from "./library/Helpers";

describe("YearnVaultFactory", () => {
    beforeEach(async () => {
        await deployments.fixture();
    });

    describe("#deployVault", () => {
        it("deploys new Yearn vault", async () => {
            const yearnVaultGovernance = await deployments.get(
                "YearnVaultGovernance"
            );
            const { weth, wbtc } = await getNamedAccounts();
            const tokens = [weth, wbtc].map((t) => t.toLowerCase()).sort();
            await withSigner(yearnVaultGovernance.address, async (signer) => {
                const factory = await ethers.getContract("YearnVaultFactory");
                await factory.connect(signer).deployVault(tokens, []);
            });
        });

        describe("when called not by governance", () => {
            it("reverts", async () => {
                const { weth, wbtc, deployer } = await getNamedAccounts();
                const tokens = [weth, wbtc].map((t) => t.toLowerCase()).sort();
                await expect(
                    deployments.execute(
                        "YearnVaultFactory",
                        { from: deployer, autoMine: true },
                        "deployVault",
                        tokens,
                        []
                    )
                ).to.be.revertedWith(
                    Exceptions.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE
                );
            });
        });
    });
});
