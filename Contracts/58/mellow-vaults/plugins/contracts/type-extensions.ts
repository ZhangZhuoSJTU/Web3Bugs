import type { Contract } from "ethers";
import { CONTRACTS } from "./constants";

export type ExternalContractName = typeof CONTRACTS[number];

declare module "hardhat/types/runtime" {
    interface HardhatRuntimeEnvironment {
        getExternalContract: (
            nameOrAddress: ExternalContractName | string
        ) => Promise<Contract>;
        externalContracts: typeof CONTRACTS;
    }
}
