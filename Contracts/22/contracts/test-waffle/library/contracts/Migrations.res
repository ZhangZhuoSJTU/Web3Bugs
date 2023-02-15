
@@ocaml.warning("-32")
open ContractHelpers
type t = {address: Ethers.ethAddress}
let contractName = "Migrations"

let at: Ethers.ethAddress => JsPromise.t<t> = contractAddress =>
  attachToContract(contractName, ~contractAddress)->Obj.magic

let make: () => JsPromise.t<t> = () =>
    deployContract0(contractName, )->Obj.magic


  type last_completed_migrationReturn = Ethers.BigNumber.t
  @send
  external last_completed_migration: (
    t,
  ) => JsPromise.t<last_completed_migrationReturn> = "last_completed_migration"

  type ownerReturn = Ethers.ethAddress
  @send
  external owner: (
    t,
  ) => JsPromise.t<ownerReturn> = "owner"

  @send
  external setCompleted: (
    t,~completed: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setCompleted"

  @send
  external upgrade: (
    t,~new_address: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "upgrade"



