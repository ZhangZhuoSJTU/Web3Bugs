type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: FloatToken.t => Js.Promise.t<t> = "smockit"

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

let mockAllowanceToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.allowance.will.return.with([_param0])")
}

type allowanceCall = {
  owner: Ethers.ethAddress,
  spender: Ethers.ethAddress,
}

let allowanceCalls: t => array<allowanceCall> = _r => {
  let array = %raw("_r.smocked.allowance.calls")
  array->Array.map(((owner, spender)) => {
    {
      owner: owner,
      spender: spender,
    }
  })
}

let mockApproveToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.approve.will.return.with([_param0])")
}

type approveCall = {
  spender: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
}

let approveCalls: t => array<approveCall> = _r => {
  let array = %raw("_r.smocked.approve.calls")
  array->Array.map(((spender, amount)) => {
    {
      spender: spender,
      amount: amount,
    }
  })
}

let mockBalanceOfToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.balanceOf.will.return.with([_param0])")
}

type balanceOfCall = {account: Ethers.ethAddress}

let balanceOfCalls: t => array<balanceOfCall> = _r => {
  let array = %raw("_r.smocked.balanceOf.calls")
  array->Array.map(_m => {
    let account = _m->Array.getUnsafe(0)

    {
      account: account,
    }
  })
}

let mockBurnToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.burn.will.return()")
}

type burnCall = {amount: Ethers.BigNumber.t}

let burnCalls: t => array<burnCall> = _r => {
  let array = %raw("_r.smocked.burn.calls")
  array->Array.map(_m => {
    let amount = _m->Array.getUnsafe(0)

    {
      amount: amount,
    }
  })
}

let mockBurnFromToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.burnFrom.will.return()")
}

type burnFromCall = {
  account: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
}

let burnFromCalls: t => array<burnFromCall> = _r => {
  let array = %raw("_r.smocked.burnFrom.calls")
  array->Array.map(((account, amount)) => {
    {
      account: account,
      amount: amount,
    }
  })
}

let mockDecimalsToReturn: (t, int) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.decimals.will.return.with([_param0])")
}

type decimalsCall

let decimalsCalls: t => array<decimalsCall> = _r => {
  let array = %raw("_r.smocked.decimals.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockDecreaseAllowanceToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.decreaseAllowance.will.return.with([_param0])")
}

type decreaseAllowanceCall = {
  spender: Ethers.ethAddress,
  subtractedValue: Ethers.BigNumber.t,
}

let decreaseAllowanceCalls: t => array<decreaseAllowanceCall> = _r => {
  let array = %raw("_r.smocked.decreaseAllowance.calls")
  array->Array.map(((spender, subtractedValue)) => {
    {
      spender: spender,
      subtractedValue: subtractedValue,
    }
  })
}

let mockGetRoleAdminToReturn: (t, string) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.getRoleAdmin.will.return.with([_param0])")
}

type getRoleAdminCall = {role: string}

let getRoleAdminCalls: t => array<getRoleAdminCall> = _r => {
  let array = %raw("_r.smocked.getRoleAdmin.calls")
  array->Array.map(_m => {
    let role = _m->Array.getUnsafe(0)

    {
      role: role,
    }
  })
}

let mockGetRoleMemberToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.getRoleMember.will.return.with([_param0])")
}

type getRoleMemberCall = {
  role: string,
  index: Ethers.BigNumber.t,
}

let getRoleMemberCalls: t => array<getRoleMemberCall> = _r => {
  let array = %raw("_r.smocked.getRoleMember.calls")
  array->Array.map(((role, index)) => {
    {
      role: role,
      index: index,
    }
  })
}

let mockGetRoleMemberCountToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.getRoleMemberCount.will.return.with([_param0])")
}

type getRoleMemberCountCall = {role: string}

let getRoleMemberCountCalls: t => array<getRoleMemberCountCall> = _r => {
  let array = %raw("_r.smocked.getRoleMemberCount.calls")
  array->Array.map(_m => {
    let role = _m->Array.getUnsafe(0)

    {
      role: role,
    }
  })
}

let mockGrantRoleToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.grantRole.will.return()")
}

type grantRoleCall = {
  role: string,
  account: Ethers.ethAddress,
}

let grantRoleCalls: t => array<grantRoleCall> = _r => {
  let array = %raw("_r.smocked.grantRole.calls")
  array->Array.map(((role, account)) => {
    {
      role: role,
      account: account,
    }
  })
}

let mockHasRoleToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.hasRole.will.return.with([_param0])")
}

type hasRoleCall = {
  role: string,
  account: Ethers.ethAddress,
}

let hasRoleCalls: t => array<hasRoleCall> = _r => {
  let array = %raw("_r.smocked.hasRole.calls")
  array->Array.map(((role, account)) => {
    {
      role: role,
      account: account,
    }
  })
}

let mockIncreaseAllowanceToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.increaseAllowance.will.return.with([_param0])")
}

type increaseAllowanceCall = {
  spender: Ethers.ethAddress,
  addedValue: Ethers.BigNumber.t,
}

let increaseAllowanceCalls: t => array<increaseAllowanceCall> = _r => {
  let array = %raw("_r.smocked.increaseAllowance.calls")
  array->Array.map(((spender, addedValue)) => {
    {
      spender: spender,
      addedValue: addedValue,
    }
  })
}

let mockInitializeToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.initialize.will.return()")
}

type initializeCall = {
  name: string,
  symbol: string,
}

let initializeCalls: t => array<initializeCall> = _r => {
  let array = %raw("_r.smocked.initialize.calls")
  array->Array.map(((name, symbol)) => {
    {
      name: name,
      symbol: symbol,
    }
  })
}

let mockInitializeFloatTokenToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.initializeFloatToken.will.return()")
}

type initializeFloatTokenCall = {
  name: string,
  symbol: string,
  stakerAddress: Ethers.ethAddress,
}

let initializeFloatTokenCalls: t => array<initializeFloatTokenCall> = _r => {
  let array = %raw("_r.smocked.initializeFloatToken.calls")
  array->Array.map(((name, symbol, stakerAddress)) => {
    {
      name: name,
      symbol: symbol,
      stakerAddress: stakerAddress,
    }
  })
}

let mockMintToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.mint.will.return()")
}

type mintCall = {
  _to: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
}

let mintCalls: t => array<mintCall> = _r => {
  let array = %raw("_r.smocked.mint.calls")
  array->Array.map(((_to, amount)) => {
    {
      _to: _to,
      amount: amount,
    }
  })
}

let mockNameToReturn: (t, string) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.name.will.return.with([_param0])")
}

type nameCall

let nameCalls: t => array<nameCall> = _r => {
  let array = %raw("_r.smocked.name.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockPauseToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.pause.will.return()")
}

type pauseCall

let pauseCalls: t => array<pauseCall> = _r => {
  let array = %raw("_r.smocked.pause.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockPausedToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.paused.will.return.with([_param0])")
}

type pausedCall

let pausedCalls: t => array<pausedCall> = _r => {
  let array = %raw("_r.smocked.paused.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockRenounceRoleToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.renounceRole.will.return()")
}

type renounceRoleCall = {
  role: string,
  account: Ethers.ethAddress,
}

let renounceRoleCalls: t => array<renounceRoleCall> = _r => {
  let array = %raw("_r.smocked.renounceRole.calls")
  array->Array.map(((role, account)) => {
    {
      role: role,
      account: account,
    }
  })
}

let mockRevokeRoleToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.revokeRole.will.return()")
}

type revokeRoleCall = {
  role: string,
  account: Ethers.ethAddress,
}

let revokeRoleCalls: t => array<revokeRoleCall> = _r => {
  let array = %raw("_r.smocked.revokeRole.calls")
  array->Array.map(((role, account)) => {
    {
      role: role,
      account: account,
    }
  })
}

let mockSupportsInterfaceToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.supportsInterface.will.return.with([_param0])")
}

type supportsInterfaceCall = {interfaceId: string}

let supportsInterfaceCalls: t => array<supportsInterfaceCall> = _r => {
  let array = %raw("_r.smocked.supportsInterface.calls")
  array->Array.map(_m => {
    let interfaceId = _m->Array.getUnsafe(0)

    {
      interfaceId: interfaceId,
    }
  })
}

let mockSymbolToReturn: (t, string) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.symbol.will.return.with([_param0])")
}

type symbolCall

let symbolCalls: t => array<symbolCall> = _r => {
  let array = %raw("_r.smocked.symbol.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockTotalSupplyToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.totalSupply.will.return.with([_param0])")
}

type totalSupplyCall

let totalSupplyCalls: t => array<totalSupplyCall> = _r => {
  let array = %raw("_r.smocked.totalSupply.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockTransferToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.transfer.will.return.with([_param0])")
}

type transferCall = {
  recipient: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
}

let transferCalls: t => array<transferCall> = _r => {
  let array = %raw("_r.smocked.transfer.calls")
  array->Array.map(((recipient, amount)) => {
    {
      recipient: recipient,
      amount: amount,
    }
  })
}

let mockTransferFromToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.transferFrom.will.return.with([_param0])")
}

type transferFromCall = {
  sender: Ethers.ethAddress,
  recipient: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
}

let transferFromCalls: t => array<transferFromCall> = _r => {
  let array = %raw("_r.smocked.transferFrom.calls")
  array->Array.map(((sender, recipient, amount)) => {
    {
      sender: sender,
      recipient: recipient,
      amount: amount,
    }
  })
}

let mockUnpauseToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.unpause.will.return()")
}

type unpauseCall

let unpauseCalls: t => array<unpauseCall> = _r => {
  let array = %raw("_r.smocked.unpause.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}
