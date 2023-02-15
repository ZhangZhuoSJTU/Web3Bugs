import { run, ethers } from 'hardhat'
import { TimeswapFactory__factory } from '../../typechain'
import type { TestToken } from '../../typechain/TestToken'
import type { TimeswapConvenience as ConvenienceContract } from '../../typechain/TimeswapConvenience'
import type { TimeswapFactory as FactoryContract, TimeswapFactory } from '../../typechain/TimeswapFactory'
import type { WETH9 as WethContract } from '../../typechain/WETH9'
import { Convenience } from './Convenience'


export async function deploy(assetToken: TestToken, collateralToken: TestToken, maturity: bigint, factory?: TimeswapFactory) {
  const accounts = await ethers.getSigners()

  const nftSVG = await ethers.getContractFactory('NFTSVG')
  const nftSVGContract = await nftSVG.deploy()
  await nftSVGContract.deployTransaction.wait()

  const nftTokenURI = await ethers.getContractFactory('NFTTokenURIScaffold', {
    libraries: {
      NFTSVG: nftSVGContract.address,
    },
  })
  const nftTokenURIContract = await nftTokenURI.deploy()
  await nftTokenURIContract.deployTransaction.wait()

  const deployLibraryContractAddresses: string[] = []


  const deployLiquidity = await ethers.getContractFactory('DeployLiquidity')
  
  const deployLiquidityContract = await deployLiquidity.deploy()
  await deployLiquidityContract.deployTransaction.wait()
  deployLibraryContractAddresses.push(deployLiquidityContract.address)


  const deployBonds = await ethers.getContractFactory('DeployBonds')
  
  const deployBondsContract = await deployBonds.deploy()
  await deployBondsContract.deployTransaction.wait()
  deployLibraryContractAddresses.push(deployBondsContract.address)


  const deployInsurances = await ethers.getContractFactory('DeployInsurances')
  
  const deployInsurancesContract = await deployInsurances.deploy()
  await deployInsurancesContract.deployTransaction.wait()
  deployLibraryContractAddresses.push(deployInsurancesContract.address)
  
  const deployCollateralizedDebt = await ethers.getContractFactory('DeployCollateralizedDebt', {
    libraries: {
      NFTTokenURIScaffold: nftTokenURIContract.address,
    },
  })
  const deployCollateralizedDebtContract = await deployCollateralizedDebt.deploy()
  await deployCollateralizedDebtContract.deployTransaction.wait()
  deployLibraryContractAddresses.push(deployCollateralizedDebtContract.address)

  const libraryNames1 = ['Borrow', 'Lend', 'Mint']
  const libraryContractAddresses1: string[] = []

  for (const library of libraryNames1) {
    const name = await ethers.getContractFactory(library,{libraries: {
      DeployLiquidity: deployLibraryContractAddresses[0],
      DeployBonds: deployLibraryContractAddresses[1],
      DeployInsurances: deployLibraryContractAddresses[2],
      DeployCollateralizedDebt: deployLibraryContractAddresses[3],
    }})
    const contract = await name.deploy()
    await contract.deployTransaction.wait()
    libraryContractAddresses1.push(contract.address)
  }

  const libraryNames2 = ['Burn', 'Pay', 'Withdraw']
  const libraryContractAddresses2: string[] = []

  for (const library of libraryNames2) {
    const name = await ethers.getContractFactory(library)
    const contract = await name.deploy()
    await contract.deployTransaction.wait()
    libraryContractAddresses2.push(contract.address)
  }


  const Convenience = await ethers.getContractFactory('TimeswapConvenience', {
    libraries: {
      Borrow: libraryContractAddresses1[0],
      DeployLiquidity: deployLibraryContractAddresses[0],
      DeployBonds: deployLibraryContractAddresses[1],
      DeployInsurances: deployLibraryContractAddresses[2],
      DeployCollateralizedDebt: deployLibraryContractAddresses[3],
      Lend: libraryContractAddresses1[1],
      Mint: libraryContractAddresses1[2],
      Burn: libraryContractAddresses2[0],
      Pay: libraryContractAddresses2[1],
      Withdraw: libraryContractAddresses2[2],
    },
  })
  const WETH9 = await ethers.getContractFactory('WETH9')

  const TimeswapMathFactory = await ethers.getContractFactory('TimeswapMath')
  const TimeswapMath = await TimeswapMathFactory.deploy()

  await TimeswapMath.deployTransaction.wait()
  const Factory = await ethers.getContractFactory('TimeswapFactory', {
    libraries: {
      TimeswapMath: TimeswapMath.address
    }
  })
  let factoryContract
  if (factory!=undefined){
    factoryContract = factory
  }
  else{
    factoryContract = (await Factory.deploy( accounts[0].address,100, 50) as TimeswapFactory)
    await factoryContract.deployTransaction.wait()
  }

  const wethContract = (await WETH9.deploy()) as WethContract
  await wethContract.deployTransaction.wait()
  

const convenienceContract = (await Convenience.deploy(
  factoryContract.address,
  wethContract.address
)) as ConvenienceContract
await convenienceContract.deployTransaction.wait()
const deployedContracts = {
  factory: factoryContract,
  convenience: convenienceContract,
  weth: wethContract,
}
return deployedContracts
}
