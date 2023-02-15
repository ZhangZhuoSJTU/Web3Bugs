import { Signer } from "ethers";

import { PerpV2LeverageModuleViewer } from "../contracts";
import { ProtocolViewer } from "../contracts";

import { PerpV2LeverageModuleViewer__factory } from "../../typechain/factories/PerpV2LeverageModuleViewer__factory";
import { ProtocolViewer__factory } from "../../typechain/factories/ProtocolViewer__factory";
import { Address } from "@utils/types";

export default class DeployViewers {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployProtocolViewer(): Promise<ProtocolViewer> {
    return await new ProtocolViewer__factory(this._deployerSigner).deploy();
  }

  public async deployPerpV2LeverageModuleViewer(
    perpModule: Address,
    perpAccountBalance: Address,
    perpClearingHouseConfig: Address,
    vQuoteToken: Address
  ): Promise<PerpV2LeverageModuleViewer> {
    return await new PerpV2LeverageModuleViewer__factory(this._deployerSigner).deploy(
      perpModule,
      perpAccountBalance,
      perpClearingHouseConfig,
      vQuoteToken
    );
  }
}