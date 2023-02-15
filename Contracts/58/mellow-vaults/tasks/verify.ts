import { Contract } from "@ethersproject/contracts";
import { writeFileSync } from "fs";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Agent } from "http";
import { fromPairs } from "ramda";

task("verify-vaults", "Verifies deployed vault contracts")
    .addVariadicPositionalParam("nfts", "NFTs of the vaults to verify")
    .setAction(async ({ nfts }, hre) => {
        for (const nft of nfts) {
            await verifyVault(hre, nft);
        }
    });

async function verifyVault(hre: HardhatRuntimeEnvironment, nft: number) {
    const { deployments, getNamedAccounts } = hre;
    const { log, execute, read, get, getArtifact } = deployments;
    const { deployer } = await getNamedAccounts();
    const governanceNames = [
        "AaveVaultGovernance",
        "UniV3VaultGovernance",
        "ERC20VaultGovernance",
        "GatewayVaultGovernance",
        "LpIssuerGovernance",
    ];
    const governanceList = [];
    for (const name of governanceNames) {
        const governance = await get(name);
        governanceList.push([governance.address.toLowerCase(), name]);
    }
    const governances = fromPairs(governanceList as any) as {
        [key: string]: string;
    };
    const address = await read("VaultRegistry", "vaultForNft", nft);
    if (address === hre.ethers.constants.AddressZero) {
        console.log(`Vault with nft ${nft} doesn't exist`);
        return;
    }
    const vaultAtrifact = await getArtifact("Vault");
    const erc721Artifact = await getArtifact("ERC721");
    const vault = new Contract(address, vaultAtrifact.abi, hre.ethers.provider);
    const erc721 = new Contract(
        address,
        erc721Artifact.abi,
        hre.ethers.provider
    );
    const governanceAddress = await vault.vaultGovernance();
    const vaultTokens = await vault.vaultTokens();
    const args = [governanceAddress, vaultTokens];
    try {
        args.push(await erc721.name());
        args.push(await erc721.symbol());
    } catch {}
    const governance = governances[governanceAddress.toLowerCase()];
    const contractName = governance.replace("Governance", "");
    if (contractName == "UniV3Vault") {
        args.push(3000);
        // const art = await getArtifact("UniV3Vault");
        // const ctr = new Contract(address, art.abi, hre.ethers.provider);
        // const pool = await ctr.pool();
    }
    writeFileSync("/tmp/args", `module.exports = ${JSON.stringify(args)}`);
    console.log(
        `Verifying ${contractName} at address ${address} with args ${JSON.stringify(
            args,
            null,
            2
        )}`
    );
    try {
        await hre.run("verify", {
            constructorArgs: "/tmp/args",
            contract: `contracts/${contractName}.sol:${contractName}`,
            address,
        });
    } catch (e) {
        console.log((e as any).message);
    }
}
