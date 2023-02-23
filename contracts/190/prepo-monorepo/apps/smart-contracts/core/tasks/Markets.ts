// eslint-disable no-console
import { task } from 'hardhat/config'
import { types } from 'hardhat/config'
import { utils } from 'prepo-hardhat'
import { PrePO } from '../harnesses/PrePO'
import { PrePOMarket } from '../typechain'
import { fetchExistingPrePOMarketFactory } from '../helpers'

const { nowPlusMonths } = utils

task('create-market', 'create PrePOMarket from PrePOMarketFactory')
  .addParam('nameSuffix', 'suffix of market token name e.g. preSTRIPE 100-200 30-September 2021')
  .addParam('symbolSuffix', 'suffix of market token symbol e.g. preSTRIPE_100-200_30SEP21')
  .addOptionalParam(
    'governance',
    'address given special permissions, fees are sent to this address',
    '',
    types.string
  )
  .addOptionalParam(
    'floorPrice',
    "floor price for Long token position, ethers string e.g. '1' = 1 ether.",
    0.5,
    types.float
  )
  .addOptionalParam(
    'ceilingPrice',
    "ceiling price for Long token position, ethers string e.g. '1' = 1 ether.",
    1,
    types.float
  )
  .addOptionalParam(
    'floorValuation',
    'floor valuation of asset in billions of $ to 2 decimal places e.g. $123.45 billion = 12345',
    5000,
    types.int
  )
  .addOptionalParam(
    'ceilingValuation',
    'ceiling valuation of asset in billions of $ to 2 decimal places e.g. $123.45 billion = 12345',
    10000,
    types.int
  )
  .addOptionalParam(
    'mintingFee',
    'fee for minting long/short positions, 4 decimal place % value e.g. 1000000 = 100%, max is 5%',
    1000,
    types.int
  )
  .addOptionalParam(
    'redemptionFee',
    'fee for redeeming long/short positions, 4 decimal place % value e.g. 1000000 = 100%, max is 5%',
    1000,
    types.int
  )
  .addOptionalParam(
    'expiryTime',
    'market end time as a UNIX timestamp in seconds',
    nowPlusMonths(1),
    types.int
  )
  .setAction(async (args, { ethers, getChainId }) => {
    const prePO = await PrePO.Instance.init(await getChainId(), ethers)
    const deployer = (await ethers.getSigners())[0]
    console.log('Using Signer')
    console.log('  at', deployer.address)

    const governance = args.governance === '' ? deployer.address : args.governance
    const factory = await fetchExistingPrePOMarketFactory(prePO.chainId, ethers)
    const tx = await factory
      .connect(deployer)
      .createMarket(
        args.nameSuffix,
        args.symbolSuffix,
        governance,
        prePO.collateral.address,
        ethers.utils.parseEther(args.floorPrice.toString()),
        ethers.utils.parseEther(args.ceilingPrice.toString()),
        args.floorValuation,
        args.ceilingValuation,
        args.mintingFee,
        args.redemptionFee,
        args.expiryTime
      )
    await tx.wait()
    console.log('\n')
    console.log('Connected to PrePOMarketFactory')
    console.log('  at', factory.address)

    const filter = {
      address: factory.address,
      topics: [ethers.utils.id('MarketAdded(address,bytes32)')],
    }
    const events = await factory.queryFilter(filter, 'latest')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marketAddedEvent = events[0].args as any
    console.log('\n')
    console.log('Deployed PrePOMarket')
    console.log(' at', marketAddedEvent.market)
    console.log(' assigned hash', marketAddedEvent.longShortHash)
    console.log(' with the following parameters:')
    console.log(' governance:', governance)
    console.log(' floorLongPrice:', ethers.utils.parseEther(args.floorPrice.toString()).toString())
    console.log(
      ' ceilingLongPrice:',
      ethers.utils.parseEther(args.ceilingPrice.toString()).toString()
    )
    console.log(' floorValuation:', args.floorValuation)
    console.log(' ceilingValuation:', args.ceilingValuation)
    console.log(' mintingFee:', args.mintingFee)
    console.log(' redemptionFee:', args.redemptionFee)
    console.log(' expiryTime:', args.expiryTime)

    const newMarket = prePO.marketContractFactory.attach(marketAddedEvent.market) as PrePOMarket
    console.log('Long Token: ', await newMarket.getLongToken())
    console.log('Short Token: ', await newMarket.getShortToken())
  })
