import { extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { any, equals } from "ramda";
import { CONTRACTS } from "./constants";
import "./type-extensions";
import { ExternalContractName } from "./type-extensions";

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
    hre.getExternalContract = async (
        nameOrAddress: ExternalContractName | string
    ) => {
        const name = await resolveName(hre, nameOrAddress);
        if (!name) {
            throw `External contract ${nameOrAddress} not found`;
        }
        const address = (await hre.getNamedAccounts())[name];
        const abi = require(`./abi/${name}.abi.json`);
        return await hre.ethers.getContractAt(abi, address);
    };
    hre.externalContracts = CONTRACTS;
});

async function resolveName(
    hre: HardhatRuntimeEnvironment,
    nameOrAddress: ExternalContractName | string
): Promise<ExternalContractName | undefined> {
    if (!hre.ethers.utils.isAddress(nameOrAddress)) {
        if (!any(equals(nameOrAddress), CONTRACTS)) {
            return undefined;
        }
        return nameOrAddress as ExternalContractName;
    }
    const namedAccs = await hre.getNamedAccounts();
    for (const name in namedAccs) {
        if (namedAccs[name].toLowerCase() === nameOrAddress.toLowerCase()) {
            return name as ExternalContractName;
        }
    }
}
