import { Signer } from "ethers";

import DeployLibraries from "./deployLibraries";
import DeployMocks from "./deployMocks";
import DeployModules from "./deployModules";
import DeployCoreContracts from "./deployCoreContracts";
import DeployExternalContracts from "./deployExternal";
import DeployAdapters from "./deployAdapters";
import DeployViewers from "./deployViewers";
import DeployProduct from "./deployProduct";
import DeployOracles from "./deployOracles";

export default class DeployHelper {
  public libraries: DeployLibraries;
  public mocks: DeployMocks;
  public modules: DeployModules;
  public core: DeployCoreContracts;
  public external: DeployExternalContracts;
  public adapters: DeployAdapters;
  public viewers: DeployViewers;
  public product: DeployProduct;
  public oracles: DeployOracles;

  constructor(deployerSigner: Signer) {
    this.libraries = new DeployLibraries(deployerSigner);
    this.mocks = new DeployMocks(deployerSigner);
    this.modules = new DeployModules(deployerSigner);
    this.core = new DeployCoreContracts(deployerSigner);
    this.external = new DeployExternalContracts(deployerSigner);
    this.adapters = new DeployAdapters(deployerSigner);
    this.viewers = new DeployViewers(deployerSigner);
    this.product = new DeployProduct(deployerSigner);
    this.oracles = new DeployOracles(deployerSigner);
  }
}
