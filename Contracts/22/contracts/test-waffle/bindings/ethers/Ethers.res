type ethAddressStr = string
type ethAddress

module Misc = {
  let unsafeToOption: (unit => 'a) => option<'a> = unsafeFunc => {
    try {
      unsafeFunc()->Some
    } catch {
    | Js.Exn.Error(_obj) => None
    }
  }
}

type txResult = {
  @dead("txResult.blockHash") blockHash: string,
  @dead("txResult.blockNumber") blockNumber: int,
  @dead("txResult.byzantium") byzantium: bool,
  @dead("txResult.confirmations") confirmations: int,
  // contractAddress: null,
  // cumulativeGasUsed: Object { _hex: "0x26063", … },
  // events: Array(4) [ {…}, {…}, {…}, … ],
  @dead("txResult.from") from: ethAddress,
  // gasUsed: Object { _hex: "0x26063", … },
  // logs: Array(4) [ {…}, {…}, {…}, … ],
  // logsBloom: "0x00200000000000008000000000000000000020000001000000000000400020000000000000002000000000000000000000000002800010000000008000000000000000000000000000000008000000000040000000000000000000000000000000000000020000014000000000000800024000000000000000000010000000000000000000000000000000000000000000008000000000000000000000000200000008000000000000000000000000000000000800000000000000000000000000001002000000000000000000000000000000000000000020000000040020000000000000000080000000000000000000000000000000080000000000200000"
  @dead("txResult.status") status: int,
  @dead("txResult._to") _to: ethAddress,
  transactionHash: string,
  @dead("txResult.transactionIndex") transactionIndex: int,
}
type txHash = string
type txSubmitted = {
  hash: txHash,
  wait: (. unit) => JsPromise.t<txResult>,
}
type txError = {
  @dead("txError.code") code: int, // -32000 = always failing tx ;  4001 = Rejected by signer.
  message: string,
  @dead("txError.stack") stack: option<string>,
}

type abi

let makeAbi = (abiArray: array<string>): abi => abiArray->Obj.magic

type ethersBigNumber

module BigNumber = {
  type t = ethersBigNumber

  @scope("ethers.BigNumber") @val
  external fromUnsafe: string => t = "from"
  @scope("ethers.BigNumber") @val
  external fromInt: int => t = "from"

  @send external add: (t, t) => t = "add"
  @send external sub: (t, t) => t = "sub"
  @send external mul: (t, t) => t = "mul"
  @send external div: (t, t) => t = "div"
  @send external mod: (t, t) => t = "mod"
  @send external pow: (t, t) => t = "pow"
  @send external abs: t => t = "abs"

  @send external gt: (t, t) => bool = "gt"
  @send external gte: (t, t) => bool = "gte"
  @send external lt: (t, t) => bool = "lt"
  @send external lte: (t, t) => bool = "lte"
  @send external eq: (t, t) => bool = "eq"

  @send external toString: t => string = "toString"

  @send external toNumber: t => int = "toNumber"
  @send external toNumberFloat: t => float = "toNumber"
}

type providerType

@send
external waitForTransaction: (providerType, string) => JsPromise.t<txResult> = "waitForTransaction"

type walletType = {address: ethAddress, provider: providerType}

module Wallet = {
  type t = walletType

  @new @scope("ethers")
  external makePrivKeyWallet: (string, providerType) => t = "Wallet"

  @val @scope(("ethers", "Wallet"))
  external createRandom: unit => t = "createRandom"

  type rawSignature
  @send
  external signMessage: (t, string) => JsPromise.t<rawSignature> = "signMessage"
}

@val @scope("ethers")
external getSigners: unit => JsPromise.t<array<Wallet.t>> = "getSigners"

module Providers = {
  type t = providerType

  @new @scope("ethers") @scope("providers")
  external makeProvider: string => t = "JsonRpcProvider"

  @send external getBalance: (t, ethAddress) => JsPromise.t<option<BigNumber.t>> = "getBalance"
  @send
  external getSigner: (t, ethAddress) => option<Wallet.t> = "getSigner"
}

type providerOrSigner =
  | Provider(Providers.t)
  | Signer(Wallet.t)

module Contract = {
  type t

  type txOptions = {
    @live gasLimit: option<string>,
    @live value: BigNumber.t,
  }

  type tx = {
    hash: txHash,
    wait: (. unit) => JsPromise.t<txResult>,
  }

  @new @scope("ethers")
  external getContractSigner: (ethAddress, abi, Wallet.t) => t = "Contract"
  @new @scope("ethers")
  external getContractProvider: (ethAddress, abi, Providers.t) => t = "Contract"

  let make: (ethAddress, abi, providerOrSigner) => t = (address, abi, providerSigner) => {
    switch providerSigner {
    | Provider(provider) => getContractProvider(address, abi, provider)
    | Signer(signer) => getContractSigner(address, abi, signer)
    }
  }
}

module Utils = {
  type ethUnit = [
    | #wei
    | #kwei
    | #mwei
    | #gwei
    | #microether
    | #milliether
    | #ether
    | #kether
    | #mether
    | #geher
    | #tether
  ]
  @scope("ethers.utils") @val
  external parseUnitsUnsafe: (. string, ethUnit) => BigNumber.t = "parseUnits"
  let parseUnits = (~amount, ~unit) => Misc.unsafeToOption(() => parseUnitsUnsafe(. amount, unit))

  let parseEther = (~amount) => parseUnits(~amount, ~unit=#ether)
  let parseEtherUnsafe = (~amount) => parseUnitsUnsafe(. amount, #ether)

  @scope("ethers.utils") @val
  external getAddressUnsafe: string => ethAddress = "getAddress"
  let getAddress: string => option<ethAddress> = addressString =>
    Misc.unsafeToOption(() => getAddressUnsafe(addressString))

  @scope("ethers.utils") @val
  external formatUnits: (. BigNumber.t, ethUnit) => string = "formatUnits"

  let formatEther = formatUnits(. _, #ether)

  let formatEtherToPrecision = (number, digits) => {
    let digitMultiplier = Js.Math.pow_float(~base=10.0, ~exp=digits->Float.fromInt)
    number
    ->formatEther
    ->Float.fromString
    ->Option.getExn
    ->(x => x *. digitMultiplier)
    ->Js.Math.floor_float
    ->(x => x /. digitMultiplier)
    ->Float.toString
  }

  let ethAdrToStr: ethAddress => string = Obj.magic
  let ethAdrToLowerStr: ethAddress => string = address =>
    address->ethAdrToStr->Js.String.toLowerCase
}
