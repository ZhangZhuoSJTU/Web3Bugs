
@@ocaml.warning("-32")
open ContractHelpers
type t = {address: Ethers.ethAddress}
let contractName = "SyntheticToken"

let at: Ethers.ethAddress => JsPromise.t<t> = contractAddress =>
  attachToContract(contractName, ~contractAddress)->Obj.magic

let make: (~name: string,~symbol: string,~longShort: Ethers.ethAddress,~staker: Ethers.ethAddress,~marketIndex: int,~isLong: bool,) => JsPromise.t<t> = (~name,~symbol,~longShort,~staker,~marketIndex,~isLong,) =>
    deployContract6(contractName, name,symbol,longShort,staker,marketIndex,isLong,)->Obj.magic


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

  type allowanceReturn = Ethers.BigNumber.t
  @send
  external allowance: (
    t,~owner: Ethers.ethAddress,~spender: Ethers.ethAddress,
  ) => JsPromise.t<allowanceReturn> = "allowance"

  @send
  external approve: (
    t,~spender: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "approve"

    type approveReturn = bool
    @send @scope("callStatic")
    external approveCall: (
      t,~spender: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
    ) => JsPromise.t<approveReturn> = "approve"

  type balanceOfReturn = Ethers.BigNumber.t
  @send
  external balanceOf: (
    t,~account: Ethers.ethAddress,
  ) => JsPromise.t<balanceOfReturn> = "balanceOf"

  @send
  external burn: (
    t,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "burn"

  @send
  external burnFrom: (
    t,~account: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "burnFrom"

  type decimalsReturn = int
  @send
  external decimals: (
    t,
  ) => JsPromise.t<decimalsReturn> = "decimals"

  @send
  external decreaseAllowance: (
    t,~spender: Ethers.ethAddress,~subtractedValue: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "decreaseAllowance"

    type decreaseAllowanceReturn = bool
    @send @scope("callStatic")
    external decreaseAllowanceCall: (
      t,~spender: Ethers.ethAddress,~subtractedValue: Ethers.BigNumber.t,
    ) => JsPromise.t<decreaseAllowanceReturn> = "decreaseAllowance"

  type getRoleAdminReturn = bytes32
  @send
  external getRoleAdmin: (
    t,~role: bytes32,
  ) => JsPromise.t<getRoleAdminReturn> = "getRoleAdmin"

  type getRoleMemberReturn = Ethers.ethAddress
  @send
  external getRoleMember: (
    t,~role: bytes32,~index: Ethers.BigNumber.t,
  ) => JsPromise.t<getRoleMemberReturn> = "getRoleMember"

  type getRoleMemberCountReturn = Ethers.BigNumber.t
  @send
  external getRoleMemberCount: (
    t,~role: bytes32,
  ) => JsPromise.t<getRoleMemberCountReturn> = "getRoleMemberCount"

  @send
  external grantRole: (
    t,~role: bytes32,~account: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "grantRole"

  type hasRoleReturn = bool
  @send
  external hasRole: (
    t,~role: bytes32,~account: Ethers.ethAddress,
  ) => JsPromise.t<hasRoleReturn> = "hasRole"

  @send
  external increaseAllowance: (
    t,~spender: Ethers.ethAddress,~addedValue: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "increaseAllowance"

    type increaseAllowanceReturn = bool
    @send @scope("callStatic")
    external increaseAllowanceCall: (
      t,~spender: Ethers.ethAddress,~addedValue: Ethers.BigNumber.t,
    ) => JsPromise.t<increaseAllowanceReturn> = "increaseAllowance"

  type isLongReturn = bool
  @send
  external isLong: (
    t,
  ) => JsPromise.t<isLongReturn> = "isLong"

  type longShortReturn = Ethers.ethAddress
  @send
  external longShort: (
    t,
  ) => JsPromise.t<longShortReturn> = "longShort"

  type marketIndexReturn = int
  @send
  external marketIndex: (
    t,
  ) => JsPromise.t<marketIndexReturn> = "marketIndex"

  @send
  external mint: (
    t,~_to: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "mint"

  type nameReturn = string
  @send
  external name: (
    t,
  ) => JsPromise.t<nameReturn> = "name"

  @send
  external pause: (
    t,
  ) => JsPromise.t<transaction> = "pause"

  type pausedReturn = bool
  @send
  external paused: (
    t,
  ) => JsPromise.t<pausedReturn> = "paused"

  @send
  external renounceRole: (
    t,~role: bytes32,~account: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "renounceRole"

  @send
  external revokeRole: (
    t,~role: bytes32,~account: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "revokeRole"

  @send
  external stake: (
    t,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "stake"

  type stakerReturn = Ethers.ethAddress
  @send
  external staker: (
    t,
  ) => JsPromise.t<stakerReturn> = "staker"

  type supportsInterfaceReturn = bool
  @send
  external supportsInterface: (
    t,~interfaceId: bytes4,
  ) => JsPromise.t<supportsInterfaceReturn> = "supportsInterface"

  type symbolReturn = string
  @send
  external symbol: (
    t,
  ) => JsPromise.t<symbolReturn> = "symbol"

  type totalSupplyReturn = Ethers.BigNumber.t
  @send
  external totalSupply: (
    t,
  ) => JsPromise.t<totalSupplyReturn> = "totalSupply"

  @send
  external transfer: (
    t,~recipient: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "transfer"

    type transferReturn = bool
    @send @scope("callStatic")
    external transferCall: (
      t,~recipient: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
    ) => JsPromise.t<transferReturn> = "transfer"

  @send
  external transferFrom: (
    t,~sender: Ethers.ethAddress,~recipient: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "transferFrom"

    type transferFromReturn = bool
    @send @scope("callStatic")
    external transferFromCall: (
      t,~sender: Ethers.ethAddress,~recipient: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
    ) => JsPromise.t<transferFromReturn> = "transferFrom"

  @send
  external unpause: (
    t,
  ) => JsPromise.t<transaction> = "unpause"



