
@@ocaml.warning("-32")
open ContractHelpers
type t = {address: Ethers.ethAddress}
let contractName = "TokenFactory"

let at: Ethers.ethAddress => JsPromise.t<t> = contractAddress =>
  attachToContract(contractName, ~contractAddress)->Obj.magic

let make: (~longShort: Ethers.ethAddress,) => JsPromise.t<t> = (~longShort,) =>
    deployContract1(contractName, longShort,)->Obj.magic


  type dEFAULT_ADMIN_ROLEReturn = bytes32
  @send
  external dEFAULT_ADMIN_ROLE: (
    t,
  ) => JsPromise.t<dEFAULT_ADMIN_ROLEReturn> = "DEFAULT_ADMIN_ROLE"

  type mINTER_ROLEReturn = bytes32
  @send
  external mINTER_ROLE: (
    t,
  ) => JsPromise.t<mINTER_ROLEReturn> = "MINTER_ROLE"

  type pAUSER_ROLEReturn = bytes32
  @send
  external pAUSER_ROLE: (
    t,
  ) => JsPromise.t<pAUSER_ROLEReturn> = "PAUSER_ROLE"

  @send
  external createSyntheticToken: (
    t,~syntheticName: string,~syntheticSymbol: string,~staker: Ethers.ethAddress,~marketIndex: int,~isLong: bool,
  ) => JsPromise.t<transaction> = "createSyntheticToken"

    type createSyntheticTokenReturn = Ethers.ethAddress
    @send @scope("callStatic")
    external createSyntheticTokenCall: (
      t,~syntheticName: string,~syntheticSymbol: string,~staker: Ethers.ethAddress,~marketIndex: int,~isLong: bool,
    ) => JsPromise.t<createSyntheticTokenReturn> = "createSyntheticToken"

  type longShortReturn = Ethers.ethAddress
  @send
  external longShort: (
    t,
  ) => JsPromise.t<longShortReturn> = "longShort"



