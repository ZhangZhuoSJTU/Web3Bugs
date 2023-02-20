import { ethers, deployments } from "hardhat";
import { Signer } from "ethers";
import { ERC20, VaultFactory, VaultGovernance } from "./library/Types";
import {
    deployERC20Tokens,
    deployVaultGovernanceSystem,
} from "./library/Deployments";
import Exceptions from "./library/Exceptions";
import { expect } from "chai";

describe("LpIssuerFactory", () => {
    const tokensCount = 2;
    let deployer: Signer;
    let admin: Signer;
    let stranger: Signer;
    let treasury: Signer;
    let vaultGovernance: VaultGovernance;
    let vaultFactory: VaultFactory;
    let tokens: ERC20[];
    let deployment: Function;

    before(async () => {
        [deployer, admin, stranger, treasury] = await ethers.getSigners();
        deployment = deployments.createFixture(async () => {
            await deployments.fixture();
            ({
                ERC20VaultFactory: vaultFactory,
                ERC20VaultGovernance: vaultGovernance,
            } = await deployVaultGovernanceSystem({
                adminSigner: admin,
                treasury: await treasury.getAddress(),
            }));
            tokens = await deployERC20Tokens(tokensCount);
        });
    });

    beforeEach(async () => {
        await deployment();
    });

    describe("constructor", () => {
        it("creates LpIssuerFactory", async () => {
            expect(
                await deployer.provider?.getCode(vaultFactory.address)
            ).not.to.be.equal("0x");
        });
    });

    describe("vaultGovernance", () => {
        it("has correct vaultGovernance", async () => {
            expect(await vaultFactory.vaultGovernance()).to.equal(
                vaultGovernance.address
            );
        });
    });

    describe("deployVault", () => {
        describe("when called by stranger", () => {
            it("reverts", async () => {
                await expect(
                    vaultFactory.connect(stranger).deployVault(
                        tokens.map((token) => token.address),
                        []
                    )
                ).to.be.revertedWith(
                    Exceptions.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE
                );
            });
        });
    });
});
