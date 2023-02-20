import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { Signer } from "ethers";
import { VaultGovernance, ProtocolGovernance } from "./library/Types";
import { Contract } from "@ethersproject/contracts";
import { deploySubVaultSystem } from "./library/Deployments";
import { sleep } from "./library/Helpers";

describe("ERC20VaultGovernance", () => {
    const tokensCount = 2;
    let deployer: Signer;
    let admin: Signer;
    let treasury: Signer;
    let anotherTreasury: Signer;
    let ERC20VaultGovernance: VaultGovernance;
    let protocolGovernance: ProtocolGovernance;
    let chiefTrader: Contract;
    let nftERC20: number;
    let deployment: Function;

    before(async () => {
        [deployer, admin, treasury, anotherTreasury] =
            await ethers.getSigners();
        deployment = deployments.createFixture(async () => {
            await deployments.fixture();
            ({
                protocolGovernance,
                ERC20VaultGovernance,
                nftERC20,
                chiefTrader,
            } = await deploySubVaultSystem({
                tokensCount: tokensCount,
                adminSigner: admin,
                treasury: await treasury.getAddress(),
                vaultOwner: await deployer.getAddress(),
            }));
        });
    });

    beforeEach(async () => {
        await deployment();
    });

    describe("constructor", () => {
        it("creates ERC20VaultGovernance", async () => {
            expect(
                await deployer.provider?.getCode(ERC20VaultGovernance.address)
            ).not.to.be.equal("0x");
        });
    });
});
