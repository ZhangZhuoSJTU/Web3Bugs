const fs = require('fs')
const n = require('eth-ens-namehash')
const envfile = require('envfile')
const sourcePath = './.env'
const packet = require('dns-packet')
const { utils, BigNumber: BN } = ethers
const { use, expect } = require('chai')
const { solidity } = require('ethereum-waffle')
const parsedFile = envfile.parse(fs.readFileSync('./.env'))

use(solidity)

const namehash = n.hash
const labelhash = (label) => utils.keccak256(utils.toUtf8Bytes(label))

function getOpenSeaUrl(contract, namehashedname){
  const tokenId = ethers.BigNumber.from(namehashedname).toString()
  return `https://testnets.opensea.io/assets/${contract}/${tokenId}`
}

async function main(a) {
    const [deployer] = await ethers.getSigners()
    const CAN_DO_EVERYTHING = 0
    const CANNOT_UNWRAP = 1
    const CANNOT_SET_RESOLVER = 8
    const firstAddress = deployer.address
    const {
      REGISTRY_ADDRESS:registryAddress,
      REGISTRAR_ADDRESS:registrarAddress,
      WRAPPER_ADDRESS:wrapperAddress,
      RESOLVER_ADDRESS:resolverAddress,
      SEED_NAME: name = 'wrappertest'
    } = parsedFile
    if(!(registryAddress && registrarAddress && wrapperAddress && resolverAddress)){
      throw('Set addresses on .env')
    } 
    console.log("Account balance:", (await deployer.getBalance()).toString())
    console.log({
      registryAddress,registrarAddress, wrapperAddress, resolverAddress,firstAddress, name
    })
    const EnsRegistry = await (await ethers.getContractFactory("ENSRegistry")).attach(registryAddress)
    const BaseRegistrar = await (await ethers.getContractFactory("BaseRegistrarImplementation")).attach(registrarAddress)
    const NameWrapper = await (await ethers.getContractFactory("NameWrapper")).attach(wrapperAddress)
    const Resolver = await (await ethers.getContractFactory("PublicResolver")).attach(resolverAddress)
    const domain = `${name}.eth`
    const namehashedname = namehash(domain)
    
    await (await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)).wait()
    await (await EnsRegistry.setApprovalForAll(NameWrapper.address, true)).wait()
    await (await NameWrapper.wrapETH2LD(name, firstAddress, CAN_DO_EVERYTHING)).wait()
    console.log(`Wrapped NFT for ${domain} is available at ${getOpenSeaUrl(NameWrapper.address, namehashedname)}`)
    await (await NameWrapper.setSubnodeOwnerAndWrap(namehash(`${name}.eth`), 'sub1', firstAddress, CAN_DO_EVERYTHING)).wait()
    await (await NameWrapper.setSubnodeOwnerAndWrap(namehash(`${name}.eth`), 'sub2', firstAddress, CAN_DO_EVERYTHING)).wait()
    await (await NameWrapper.setResolver(namehash(`sub2.${name}.eth`), resolverAddress)).wait()
    await (await Resolver.setText(namehash(`sub2.${name}.eth`), 'domains.ens.nft.image', 'https://i.imgur.com/JcZESMp.png')).wait()
    console.log(`Wrapped NFT for sub2.${name}.eth is available at ${getOpenSeaUrl(NameWrapper.address, namehash(`sub2.${name}.eth`))}`)
    await (await NameWrapper.burnFuses(namehash(`sub2.${name}.eth`),CANNOT_UNWRAP)).wait()
    await (await NameWrapper.burnFuses(namehash(`sub2.${name}.eth`),CANNOT_SET_RESOLVER)).wait()
    await (await NameWrapper.unwrap(namehash(`${name}.eth`), labelhash('sub1'), firstAddress)).wait()
  }
  
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
