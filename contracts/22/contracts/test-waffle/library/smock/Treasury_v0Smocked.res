type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: Treasury_v0.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

let mockAdminToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.admin.will.return.with([_param0])")
}

type adminCall

let adminCalls: t => array<adminCall> = _r => {
  let array = %raw("_r.smocked.admin.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockChangeAdminToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeAdmin.will.return()")
}

type changeAdminCall = {admin: Ethers.ethAddress}

let changeAdminCalls: t => array<changeAdminCall> = _r => {
  let array = %raw("_r.smocked.changeAdmin.calls")
  array->Array.map(_m => {
    let admin = _m->Array.getUnsafe(0)

    {
      admin: admin,
    }
  })
}

let mockInitializeToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.initialize.will.return()")
}

type initializeCall = {admin: Ethers.ethAddress}

let initializeCalls: t => array<initializeCall> = _r => {
  let array = %raw("_r.smocked.initialize.calls")
  array->Array.map(_m => {
    let admin = _m->Array.getUnsafe(0)

    {
      admin: admin,
    }
  })
}
