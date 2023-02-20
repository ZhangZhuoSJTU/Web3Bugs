import { Signer } from 'ethers';

import DeployCoreContracts from './deployCoreContracts';
import DeployMockContracts from './deployMockContracts';
import DeployPoolContracts from './deployPoolContract';
import DeployHelperContracts from './deployHelperContracts';

export default class DeployHelper {
    public core: DeployCoreContracts;
    public mock: DeployMockContracts;
    public pool: DeployPoolContracts;
    public helper: DeployHelperContracts;

    constructor(deployerSigner: Signer) {
        this.core = new DeployCoreContracts(deployerSigner);
        this.mock = new DeployMockContracts(deployerSigner);
        this.pool = new DeployPoolContracts(deployerSigner);
        this.helper = new DeployHelperContracts(deployerSigner);
    }
}
