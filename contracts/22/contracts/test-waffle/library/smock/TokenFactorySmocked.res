type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: TokenFactory.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

let mockDEFAULT_ADMIN_ROLEToReturn: (t, string) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.DEFAULT_ADMIN_ROLE.will.return.with([_param0])")
}

type dEFAULT_ADMIN_ROLECall

let dEFAULT_ADMIN_ROLECalls: t => array<dEFAULT_ADMIN_ROLECall> = _r => {
  let array = %raw("_r.smocked.DEFAULT_ADMIN_ROLE.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockMINTER_ROLEToReturn: (t, string) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.MINTER_ROLE.will.return.with([_param0])")
}

type mINTER_ROLECall

let mINTER_ROLECalls: t => array<mINTER_ROLECall> = _r => {
  let array = %raw("_r.smocked.MINTER_ROLE.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockPAUSER_ROLEToReturn: (t, string) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.PAUSER_ROLE.will.return.with([_param0])")
}

type pAUSER_ROLECall

let pAUSER_ROLECalls: t => array<pAUSER_ROLECall> = _r => {
  let array = %raw("_r.smocked.PAUSER_ROLE.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockCreateSyntheticTokenToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.createSyntheticToken.will.return.with([_param0])")
}

type createSyntheticTokenCall = {
  syntheticName: string,
  syntheticSymbol: string,
  staker: Ethers.ethAddress,
  marketIndex: int,
  isLong: bool,
}

let createSyntheticTokenCalls: t => array<createSyntheticTokenCall> = _r => {
  let array = %raw("_r.smocked.createSyntheticToken.calls")
  array->Array.map(((syntheticName, syntheticSymbol, staker, marketIndex, isLong)) => {
    {
      syntheticName: syntheticName,
      syntheticSymbol: syntheticSymbol,
      staker: staker,
      marketIndex: marketIndex,
      isLong: isLong,
    }
  })
}

let mockLongShortToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.longShort.will.return.with([_param0])")
}

type longShortCall

let longShortCalls: t => array<longShortCall> = _r => {
  let array = %raw("_r.smocked.longShort.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}
