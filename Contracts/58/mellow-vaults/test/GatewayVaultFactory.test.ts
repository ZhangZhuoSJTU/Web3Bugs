import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { Signer } from "ethers";
import { VaultFactory } from "./library/Types";
import { deploySubVaultsXGatewayVaultSystem } from "./library/Deployments";
import Exceptions from "./library/Exceptions";

describe("GatewayVaultFactory", () => {
    let deployer: Signer;
    let admin: Signer;
    let stranger: Signer;
    let treasury: Signer;
    let strategy: Signer;
    let gatewayVaultFactory: VaultFactory;
    let deployment: Function;

    before(async () => {
        [deployer, admin, stranger, treasury, strategy] =
            await ethers.getSigners();
        deployment = deployments.createFixture(async () => {
            await deployments.fixture();
            ({ gatewayVaultFactory } = await deploySubVaultsXGatewayVaultSystem(
                {
                    adminSigner: admin,
                    treasury: await treasury.getAddress(),
                    vaultOwnerSigner: deployer,
                    strategy: await strategy.getAddress(),
                    dontUseTestSetup: true,
                }
            ));
        });
    });

    beforeEach(async () => {
        await deployment();
    });

    describe("constructor", () => {
        it("creates GatewayVaultFactory", async () => {
            expect(
                await deployer.provider?.getCode(gatewayVaultFactory.address)
            ).not.to.be.equal("0x");
        });
    });

    describe("deployVault", () => {
        describe("when called by stranger", () => {
            it("reverts", async () => {
                await expect(
                    gatewayVaultFactory.connect(stranger).deployVault([], [])
                ).to.be.revertedWith(
                    Exceptions.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE
                );
            });
        });
    });
});
