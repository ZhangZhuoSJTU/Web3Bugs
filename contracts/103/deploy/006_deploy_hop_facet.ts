import { ethers, network } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { addOrReplaceFacets } from '../utils/diamond'
import config from '../config/hop'
import { utils } from 'ethers'

type Token = 'USDC' | 'USDT' | 'MATIC' | 'DAI'
interface BridgeConfig {
  token: string | undefined
  ammWrapper: string | undefined
  bridge: string | undefined
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const tokens: string[] = []
  const configs: BridgeConfig[] = []

  const bridgeConfig = config[network.name]

  Object.keys(bridgeConfig).map((k) => {
    if (k === 'chainId') return
    tokens.push(<Token>k)
    configs.push({
      token: bridgeConfig[<Token>k]?.token,
      bridge: bridgeConfig[<Token>k]?.bridge,
      ammWrapper: bridgeConfig[<Token>k]?.ammWrapper,
    })
  })

  await deploy('HopFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })

  const hopFacet = await ethers.getContract('HopFacet')

  const diamond = await ethers.getContract('LiFiDiamond')

  const ABI = [
    'function initHop(string[],tuple(address token,address bridge,address ammWrapper)[],uint256)',
  ]
  const iface = new utils.Interface(ABI)

  const initData = iface.encodeFunctionData('initHop', [
    tokens,
    configs,
    bridgeConfig.chainId,
  ])

  await addOrReplaceFacets(
    [hopFacet],
    diamond.address,
    hopFacet.address,
    initData
  )
}
export default func
func.id = 'deploy_hop_facet'
func.tags = ['DeployHopFacet']
func.dependencies = [
  'InitialFacets',
  'LiFiDiamond',
  'InitFacets',
  'DeployDexManagerFacet',
]
