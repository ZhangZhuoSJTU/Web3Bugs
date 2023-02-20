import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { log, execute, read, get } = deployments;
    const { deployer, admin, protocolTreasury, weth, wbtc, usdc } = await getNamedAccounts();
    const tokens = [weth, wbtc, usdc].map((t) => t.toLowerCase()).sort();
    const governances = [];
    for (const name of [
        "AaveVaultGovernance",
        "UniV3VaultGovernance",
        "ERC20VaultGovernance",
        "GatewayVaultGovernance",
        "LpIssuerGovernance",
        "YearnVaultGovernance",
    ]) {
        const governance = await get(name);
        if (
            await read(
                "ProtocolGovernance",
                "isVaultGovernance",
                governance.address
            )
        ) {
            continue;
        }
        governances.push(governance.address);
    }
    const currentGovernances = await read(
        "ProtocolGovernance",
        "vaultGovernances"
    );
    if (governances.length > 0 && currentGovernances.length == 0) {
        log(`Registering Governances in ProtocolGovernance`);
        await execute(
            "ProtocolGovernance",
            { from: deployer, log: true, autoMine: true },
            "setPendingVaultGovernancesAdd",
            governances
        );
        await execute(
            "ProtocolGovernance",
            { from: deployer, log: true, autoMine: true },
            "commitVaultGovernancesAdd"
        );
        log("Done");
    }

    const tokenWhitelist = await read("ProtocolGovernance", "tokenWhitelist");
    if (tokenWhitelist.length === 0) {
        await execute(
            "ProtocolGovernance",
            {
                from: deployer,
                log: true,
                autoMine: true,
            },
            "setPendingTokenWhitelistAdd",
            tokens
        );
        await execute(
            "ProtocolGovernance",
            {
                from: deployer,
                log: true,
                autoMine: true,
            },
            "commitTokenWhitelistAdd"
        );
    }

    const delay = await read("ProtocolGovernance", "governanceDelay");
    if (delay == 0) {
        const params = {
            permissionless: true,
            maxTokensPerVault: 10,
            governanceDelay: 86400,
            protocolTreasury,
        };
        log(`Setting ProtocolGovernance params`);
        log(JSON.stringify(params, null, 2));
        await execute(
            "ProtocolGovernance",
            { from: deployer, log: true, autoMine: true },
            "setPendingParams",
            params
        );
        await execute(
            "ProtocolGovernance",
            { from: deployer, log: true, autoMine: true },
            "commitParams"
        );
        log("Done");
    }

    const adminRole = await read("ProtocolGovernance", "ADMIN_ROLE");
    const deployerIsAdmin = await read(
        "ProtocolGovernance",
        "hasRole",
        adminRole,
        deployer
    );
    if (deployerIsAdmin) {
        await execute(
            "ProtocolGovernance",
            {
                from: deployer,
                autoMine: true,
            },
            "grantRole",
            adminRole,
            admin
        );
        await execute(
            "ProtocolGovernance",
            {
                from: deployer,
                autoMine: true,
            },
            "renounceRole",
            adminRole,
            deployer
        );
    }
};
export default func;
func.tags = ["ProtocolGovernance", "Vaults"];
