import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { Signer } from "ethers";
import {
    ERC20,
    VaultFactory,
    VaultGovernance,
    ProtocolGovernance,
} from "./library/Types";
import { deployERC20Tokens, deploySubVaultSystem } from "./library/Deployments";
import { setTokenWhitelist } from "./library/Helpers";
import Exceptions from "./library/Exceptions";

describe("AaveVaultFactory", () => {
    const tokensCount = 2;
    let deployer: Signer;
    let admin: Signer;
    let stranger: Signer;
    let treasury: Signer;
    let vaultGovernance: VaultGovernance;
    let vaultFactory: VaultFactory;
    let tokens: ERC20[];
    let deployment: Function;
    let protocolGovernance: ProtocolGovernance;

    before(async () => {
        [deployer, admin, stranger, treasury] = await ethers.getSigners();
        deployment = deployments.createFixture(async () => {
            tokens = await deployERC20Tokens(tokensCount);
            await deployments.fixture();
            ({
                AaveVaultFactory: vaultFactory,
                AaveVaultGovernance: vaultGovernance,
                protocolGovernance,
            } = await deploySubVaultSystem({
                tokensCount: 2,
                adminSigner: admin,
                vaultOwner: await deployer.getAddress(),
                treasury: await treasury.getAddress(),
                dontUseTestSetup: true,
            }));
        });
    });

    beforeEach(async () => {
        await deployment();
    });

    describe("constructor", () => {
        it("creates AaveVaultFactory", async () => {
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
                await setTokenWhitelist(protocolGovernance, tokens, admin);
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
