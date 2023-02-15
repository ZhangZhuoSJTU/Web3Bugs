type contractFactory
type t

type bytes4
type bytes32
type transaction = unit // TODO: make this better

@val @scope("ethers")
external getContractFactory: string => JsPromise.t<contractFactory> = "getContractFactory"
@send
external attachAtAddress: (contractFactory, ~contractAddress: Ethers.ethAddress) => JsPromise.t<t> =
  "attach"
@send external deploy: contractFactory => JsPromise.t<t> = "deploy"
@send external deploy1: (contractFactory, 'a) => JsPromise.t<t> = "deploy"
@send external deploy2: (contractFactory, 'a, 'b) => JsPromise.t<t> = "deploy"
@send external deploy3: (contractFactory, 'a, 'b, 'c) => JsPromise.t<t> = "deploy"
@send external deploy4: (contractFactory, 'a, 'b, 'c, 'd) => JsPromise.t<t> = "deploy"
@send external deploy5: (contractFactory, 'a, 'b, 'c, 'd, 'e) => JsPromise.t<t> = "deploy"
@send external deploy6: (contractFactory, 'a, 'b, 'c, 'd, 'e, 'f) => JsPromise.t<t> = "deploy"
@send external deploy7: (contractFactory, 'a, 'b, 'c, 'd, 'e, 'f, 'g) => JsPromise.t<t> = "deploy"
@send
external deploy8: (contractFactory, 'a, 'b, 'c, 'd, 'e, 'f, 'g, 'h) => JsPromise.t<t> = "deploy"

@send external deployed: t => JsPromise.t<unit> = "deployed"

let attachToContract = (contractName, ~contractAddress) => {
  getContractFactory(contractName)->JsPromise.then(attachAtAddress(~contractAddress))
}
let deployContract0 = contractName => {
  getContractFactory(contractName)->JsPromise.then(deploy)->JsPromise.then(deployed)
}
let deployContract1 = (contractName, firstParam) => {
  getContractFactory(contractName)->JsPromise.then(deploy1(_, firstParam))->JsPromise.then(deployed)
}
let deployContract2 = (contractName, firstParam, secondParam) => {
  getContractFactory(contractName)
  ->JsPromise.then(deploy2(_, firstParam, secondParam))
  ->JsPromise.then(deployed)
}
let deployContract3 = (contractName, firstParam, secondParam, thirdParam) => {
  getContractFactory(contractName)
  ->JsPromise.then(deploy3(_, firstParam, secondParam, thirdParam))
  ->JsPromise.then(deployed)
}
let deployContract4 = (contractName, firstParam, secondParam, thirdParam, fourthParam) => {
  getContractFactory(contractName)
  ->JsPromise.then(deploy4(_, firstParam, secondParam, thirdParam, fourthParam))
  ->JsPromise.then(deployed)
}
let deployContract5 = (
  contractName,
  firstParam,
  secondParam,
  thirdParam,
  fourthParam,
  fifthParam,
) => {
  getContractFactory(contractName)
  ->JsPromise.then(deploy5(_, firstParam, secondParam, thirdParam, fourthParam, fifthParam))
  ->JsPromise.then(deployed)
}
let deployContract6 = (
  contractName,
  firstParam,
  secondParam,
  thirdParam,
  fourthParam,
  fifthParam,
  sixthParam,
) => {
  getContractFactory(contractName)
  ->JsPromise.then(
    deploy6(_, firstParam, secondParam, thirdParam, fourthParam, fifthParam, sixthParam),
  )
  ->JsPromise.then(deployed)
}
let deployContract7 = (
  contractName,
  firstParam,
  secondParam,
  thirdParam,
  fourthParam,
  fifthParam,
  sixthParam,
  seventhParam,
) => {
  getContractFactory(contractName)
  ->JsPromise.then(
    deploy7(
      _,
      firstParam,
      secondParam,
      thirdParam,
      fourthParam,
      fifthParam,
      sixthParam,
      seventhParam,
    ),
  )
  ->JsPromise.then(deployed)
}

let deployContract8 = (
  contractName,
  firstParam,
  secondParam,
  thirdParam,
  fourthParam,
  fifthParam,
  sixthParam,
  seventhParam,
  eighthParam,
) => {
  getContractFactory(contractName)
  ->JsPromise.then(
    deploy8(
      _,
      firstParam,
      secondParam,
      thirdParam,
      fourthParam,
      fifthParam,
      sixthParam,
      seventhParam,
      eighthParam,
    ),
  )
  ->JsPromise.then(deployed)
}

@send external connect: ('contract, ~address: Ethers.Wallet.t) => 'contract = "connect"
