import { task, types } from "hardhat/config"
import { getSigner, deployContract, logTxDetails, ONE_DAY, ONE_WEEK, simpleToExactAmount, tokens } from "@mstable/protocol"
import { PrizePool__factory } from "types/pooltogether/factories/PrizePool__factory"
import { MStableYieldSource__factory } from "types/pooltogether/factories/MStableYieldSource__factory"
import { PoolWithMultipleWinnersBuilder__factory } from "types/pooltogether/factories/PoolWithMultipleWinnersBuilder__factory"

const PoolWithMultipleWinnersBuilderAddress = "0xD1e536939F637Fc12f29C304c406377c9f77E28c"
const RNGBlockhash = "0xb1D89477d1b505C261bab6e73f08fA834544CD21"

task("deploy-prize-pool", "Deploys a PoolTogether Prize Pool for a mAsset")
    .addOptionalParam("speed", "Defender Relayer speed param: 'safeLow' | 'average' | 'fast' | 'fastest'", "average", types.string)
    .addParam("masset", "Token symbol of themAsset. eg mUSD or mBTC", undefined, types.string, false)
    .setAction(async (taskArgs, hre) => {
        const { ethers } = hre
        const signer = await getSigner(hre.network.name, ethers, taskArgs.speed)

        const mAsset = tokens.find((t) => t.symbol === taskArgs.masset)
        if (!mAsset?.savings) {
            console.error(`Failed to find saving contract for mAsset with token symbol ${taskArgs.masset}`)
            process.exit(1)
        }

        const mStableYieldSource = await deployContract(new MStableYieldSource__factory(signer), "MStableYieldSource", [mAsset.savings])

        const yieldSourcePrizePoolConfig = {
            yieldSource: mStableYieldSource.address,
            maxExitFeeMantissa: simpleToExactAmount("0.1"),
            maxTimelockDuration: 365 * 24 * 3600,
        }

        const block = await ethers.provider.getBlock("latest")

        const multipleWinnersConfig = {
            rngService: RNGBlockhash,
            prizePeriodStart: ONE_DAY.add(block.timestamp), // start in 1 day so there is time to test
            prizePeriodSeconds: ONE_WEEK,
            ticketName: `PoolTogether ${mAsset.symbol} Ticket (mStable)`,
            ticketSymbol: `P${mAsset.symbol}`,
            sponsorshipName: `PoolTogether ${mAsset.symbol} Sponsorship (mStable)`,
            sponsorshipSymbol: `S${mAsset.symbol}`,
            ticketCreditLimitMantissa: simpleToExactAmount("0.001"),
            ticketCreditRateMantissa: "166666666666666",
            numberOfWinners: 1,
            splitExternalErc20Awards: false,
        }

        const builder = PoolWithMultipleWinnersBuilder__factory.connect(PoolWithMultipleWinnersBuilderAddress, signer)

        const tx = await builder.createYieldSourceMultipleWinners(yieldSourcePrizePoolConfig, multipleWinnersConfig, 18)
        const receipt = await logTxDetails(tx, "createYieldSourceMultipleWinners")

        const event = receipt.events!.find((e) => e.event === "YieldSourcePrizePoolWithMultipleWinnersCreated")
        if (!event) {
            console.error(`Failed to find YieldSourcePrizePoolWithMultipleWinnersCreated event`)
            process.exit(1)
        }
        const prizePoolAddress = event.args![0]
        console.log(`Created Prize Pool  with address ${prizePoolAddress}`)
        const prizePool = PrizePool__factory.connect(prizePoolAddress, signer)
        const prizePoolTokens = await prizePool.tokens()
        console.log(`${multipleWinnersConfig.ticketName} (${multipleWinnersConfig.ticketSymbol}) address: ${prizePoolTokens[0]}`)
        console.log(`${multipleWinnersConfig.sponsorshipName} (${multipleWinnersConfig.sponsorshipSymbol}) address: ${prizePoolTokens[1]}`)
    })

module.exports = {}
