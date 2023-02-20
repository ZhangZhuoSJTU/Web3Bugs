import {
    Account,
    assertBNClose,
    BN,
    deployContract,
    increaseTime,
    impersonateAccount,
    mUSD,
    logTxDetails,
    ONE_DAY,
    ONE_WEEK,
    ONE_MIN,
    simpleToExactAmount,
} from "@mstable/protocol"
import { ERC20, ERC20__factory, Masset, Masset__factory, ISavingsContractV2, ISavingsContractV2__factory } from "@mstable/protocol"
import { expect } from "chai"
import { LogDescription } from "ethers/lib/utils"
import { ethers, network } from "hardhat"
import { MStableYieldSource__factory } from "types/pooltogether/factories/MStableYieldSource__factory"
import { MultipleWinners__factory } from "types/pooltogether/factories/MultipleWinners__factory"
import { PoolWithMultipleWinnersBuilder__factory } from "types/pooltogether/factories/PoolWithMultipleWinnersBuilder__factory"
import { PrizePool__factory } from "types/pooltogether/factories/PrizePool__factory"
import { RNGBlockhash__factory } from "types/pooltogether/factories/RNGBlockhash__factory"
import { MStableYieldSource, MultipleWinners, PrizePool, RNGBlockhash } from "types/pooltogether/index"

const governorAddress = "0xF6FF1F7FCEB2cE6d26687EaaB5988b445d0b94a2"
const deployerAddress = "0xb81473f20818225302b8fffb905b53d58a793d84"
const ethWhaleAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
const mUsdWhale1Address = "0x3aD1D5CFCF9169Da73C23D85d5f2Bf53bC9d39dF"
const mUsdWhale2Address = "0x2079C29Be9c8095042edB95f293B5b510203d6cE"
const mUsdWhale3Address = "0x6595732468A241312bc307F327bA0D64F02b3c20"
const savingsManagerAddress = "0x9781C4E9B9cc6Ac18405891DF20Ad3566FB6B301"

const PoolWithMultipleWinnersBuilderAddress = "0xD1e536939F637Fc12f29C304c406377c9f77E28c"
const RNGBlockhashAddress = "0xb1D89477d1b505C261bab6e73f08fA834544CD21"

context("PoolTogether Prize Pool", () => {
    let governor: Account
    let deployer: Account
    let ethWhale: Account
    let mUsdWhale1: Account
    let mUsdWhale2: Account
    let mUsdWhale3: Account
    let savingsManager: Account
    let mStableYieldSource: MStableYieldSource
    let mAsset: Masset
    let saving: ISavingsContractV2
    let savingERC20: ERC20
    let prizePool: PrizePool
    let controlToken: ERC20
    let sponsorToken: ERC20
    let prizeStrategy: MultipleWinners
    let rngBlockhash: RNGBlockhash

    before("reset block number", async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.NODE_URL,
                        blockNumber: 12656800,
                    },
                },
            ],
        })
        deployer = await impersonateAccount(deployerAddress)
        governor = await impersonateAccount(governorAddress)
        ethWhale = await impersonateAccount(ethWhaleAddress)
        mUsdWhale1 = await impersonateAccount(mUsdWhale1Address)
        mUsdWhale2 = await impersonateAccount(mUsdWhale2Address)
        mUsdWhale3 = await impersonateAccount(mUsdWhale3Address)
        savingsManager = await impersonateAccount(savingsManagerAddress)
        // Give the Savings Manager contract 10 Ether
        await network.provider.request({
            method: "hardhat_setBalance",
            params: [savingsManager.address, simpleToExactAmount(10).toHexString()],
        })

        mAsset = await Masset__factory.connect(mUSD.address, mUsdWhale1.signer)
        saving = await ISavingsContractV2__factory.connect(mUSD.savings!, mUsdWhale1.signer)
        savingERC20 = await ERC20__factory.connect(mUSD.savings!, mUsdWhale1.signer)

        rngBlockhash = RNGBlockhash__factory.connect(RNGBlockhashAddress, mUsdWhale1.signer)

        // mUSD Whale 3 transfers 100k mUSD to the Savings Manager
        await mAsset.connect(mUsdWhale3.signer).transfer(savingsManager.address, simpleToExactAmount(100000))
    })
    it("Test connectivity", async () => {
        const currentBlock = await ethers.provider.getBlockNumber()
        console.log(`Current block ${currentBlock}`)
        const startEther = await deployer.signer.getBalance()
        console.log(`Deployer ${deployerAddress} has ${startEther} Ether`)
    })
    it("Deploy mUSD Prize Pool", async () => {
        mStableYieldSource = await deployContract<MStableYieldSource>(
            new MStableYieldSource__factory(deployer.signer),
            "MStableYieldSource",
            [mUSD.savings],
        )

        const yieldSourcePrizePoolConfig = {
            yieldSource: mStableYieldSource.address,
            maxExitFeeMantissa: simpleToExactAmount("0.1"),
            maxTimelockDuration: 365 * 24 * 3600,
        }

        const block = await ethers.provider.getBlock("latest")

        const multipleWinnersConfig = {
            rngService: RNGBlockhashAddress,
            prizePeriodStart: ONE_DAY.add(block.timestamp), // start in 1 day so there is time to test
            prizePeriodSeconds: ONE_WEEK,
            ticketName: `PoolTogether ${mUSD.symbol} Ticket (mStable)`,
            ticketSymbol: `P${mUSD.symbol}`,
            sponsorshipName: `PoolTogether ${mUSD.symbol} Sponsorship (mStable)`,
            sponsorshipSymbol: `S${mUSD.symbol}`,
            ticketCreditLimitMantissa: simpleToExactAmount("0.001"),
            ticketCreditRateMantissa: "166666666666666",
            numberOfWinners: 1,
            splitExternalErc20Awards: false,
        }

        const builder = PoolWithMultipleWinnersBuilder__factory.connect(PoolWithMultipleWinnersBuilderAddress, mUsdWhale1.signer)

        const tx = await builder.createYieldSourceMultipleWinners(yieldSourcePrizePoolConfig, multipleWinnersConfig, 18)
        const receipt = await logTxDetails(tx, "createYieldSourceMultipleWinners")

        const event = receipt.events!.find((e: any) => e.event === "YieldSourcePrizePoolWithMultipleWinnersCreated")
        if (!event) {
            console.error(`Failed to find YieldSourcePrizePoolWithMultipleWinnersCreated event`)
            process.exit(1)
        }
        const prizePoolAddress = event.args![0]
        console.log(`Created Prize Pool  with address ${prizePoolAddress}`)
        prizePool = PrizePool__factory.connect(prizePoolAddress, mUsdWhale1.signer)

        const prizeStrategyAddress = await prizePool.prizeStrategy()
        prizeStrategy = MultipleWinners__factory.connect(prizeStrategyAddress, mUsdWhale1.signer)

        // Returns Sponsor and Control tokens
        const controlTokenAddress = await prizeStrategy.ticket()
        console.log(`${multipleWinnersConfig.ticketName} (${multipleWinnersConfig.ticketSymbol}) address: ${controlTokenAddress}`)
        const sponsorTokenAddress = await prizeStrategy.sponsorship()
        console.log(`${multipleWinnersConfig.sponsorshipName} (${multipleWinnersConfig.sponsorshipSymbol}) address: ${sponsorTokenAddress}`)

        controlToken = ERC20__factory.connect(controlTokenAddress, mUsdWhale1.signer)
        expect(await controlToken.symbol(), "Control token symbol initialized").to.eq("PmUSD")
        sponsorToken = ERC20__factory.connect(sponsorTokenAddress, mUsdWhale1.signer)
        expect(await sponsorToken.symbol(), "Sponsor token symbol initialized").to.eq("SmUSD")
    })
    it("Move time ahead 2 days so period has started", async () => {
        await increaseTime(ONE_DAY.mul(2))
        expect(await prizePool.accountedBalance(), "prize pool accountedBalance after 1 day").to.eq(0)
        expect(await prizePool.awardBalance(), "prize pool awardBalance after 1 day").to.eq(0)
    })
    // transfer ownership to governor
    const firstDepositAmount = simpleToExactAmount(200000)
    it("mUSD whale 1 deposits into pool", async () => {
        const musdBalanceBefore = await mAsset.balanceOf(mUsdWhale1Address)
        const savingUnderlyingBalanceBefore = await saving.balanceOfUnderlying(mStableYieldSource.address)
        expect(savingUnderlyingBalanceBefore).to.eq(0)
        const savingCreditBalanceBefore = await savingERC20.balanceOf(mStableYieldSource.address)
        expect(savingCreditBalanceBefore).to.eq(0)
        expect(await prizePool.callStatic.balance(), "prize pool has balance before").to.eq(0)

        expect(await prizePool.callStatic.balanceOfCredit(mUsdWhale1Address, controlToken.address)).to.eq(0)
        expect(await prizePool.callStatic.balanceOfCredit(mUsdWhale1Address, sponsorToken.address)).to.eq(0)

        await mAsset.approve(prizePool.address, firstDepositAmount)
        await prizePool.depositTo(mUsdWhale1.address, firstDepositAmount, controlToken.address, mUsdWhale1.address)

        expect(await mAsset.balanceOf(mUsdWhale1Address), "whale 1 balance after").to.eq(musdBalanceBefore.sub(firstDepositAmount))
        expect(await saving.balanceOfUnderlying(mStableYieldSource.address), "savings underlying balance after").to.eq(
            savingUnderlyingBalanceBefore.add(firstDepositAmount),
        )
        const exchangeRate = await saving.exchangeRate()
        expect(await savingERC20.balanceOf(mStableYieldSource.address), "savings credit balance after").to.eq(
            // imUSD = mUSD * 1e18 / exchange rate
            savingCreditBalanceBefore.add(firstDepositAmount.mul(simpleToExactAmount(1, 18)).div(exchangeRate)).add(1),
        )

        expect(await controlToken.balanceOf(mUsdWhale1Address), "mUSD Whale control balance after").to.eq(firstDepositAmount)
        expect(await sponsorToken.balanceOf(mUsdWhale1Address), "mUSD Whale sponsor balance after").to.eq(0)
        // expect(
        //     await prizePool.callStatic.balanceOfCredit(mUsdWhale1Address, controlToken.address),
        //     "balanceOfCredit mUSD whale control after",
        // ).to.eq(firstDepositAmount)
        expect(
            await prizePool.callStatic.balanceOfCredit(mUsdWhale1Address, sponsorToken.address),
            "balanceOfCredit mUSD whale sponsor after",
        ).to.eq(0)

        expect(await prizePool.accountedBalance(), "prize pool accountedBalance after").to.eq(firstDepositAmount)
        expect(await prizePool.awardBalance(), "prize pool awardBalance after").to.eq(0)
        expect(await prizePool.callStatic.balance(), "prize pool balance after").to.eq(firstDepositAmount)
    })
    let interestAmount: BN
    it("deposit interest into imUSD savings contract", async () => {
        const exchangeRateBefore = await saving.exchangeRate()
        const savingsCreditsBefore = await savingERC20.totalSupply()
        // mUSD = imUSD * exchange rate / 1e18
        const savingsUnderlyingBefore = await saving.creditsToUnderlying(savingsCreditsBefore)
        // Deposit 0.1% of the total supply for the week = 5.2 APY
        interestAmount = savingsUnderlyingBefore.div(1000)

        // Simulate collecting fees and depositing the fee from the Savings Manager to the savings contract (imUSD)
        await saving.connect(savingsManager.signer).depositInterest(interestAmount)

        expect(await controlToken.balanceOf(mUsdWhale1Address), "mUSD Whale control balance").to.eq(firstDepositAmount)
        const savingsCreditsAfter = await savingERC20.totalSupply()
        expect(savingsCreditsAfter, "no change in savings credits").to.eq(savingsCreditsBefore)

        expect(await saving.exchangeRate(), "savings exchange rate increased").to.gt(exchangeRateBefore)
        const savingsUnderlyingAfter = await saving.creditsToUnderlying(savingsCreditsAfter)
        assertBNClose(savingsUnderlyingAfter, savingsUnderlyingBefore.add(interestAmount), 200000000, "total underlying after increase")
        assertBNClose(savingsUnderlyingAfter, savingsUnderlyingBefore.mul(1001).div(1000), 2000000000, "total underlying after percentage")

        expect(await saving.balanceOfUnderlying(mStableYieldSource.address), "yield source has more mUSD").to.gt(firstDepositAmount)
        // accountedBalance calls _tokenTotalSupply() = time lock + reserve + control + sponsor total supplies
        expect(await prizePool.timelockTotalSupply(), "timelockTotalSupply").to.eq(0)
        expect(await prizePool.reserveTotalSupply(), "reserveTotalSupply").to.eq(0)
        expect(await controlToken.totalSupply(), "controlToken totalSupply").to.eq(firstDepositAmount)
        expect(await sponsorToken.totalSupply(), "sponsorToken totalSupply").to.eq(0)
        expect(await prizePool.accountedBalance(), "pool accountedBalance after 1 day").to.eq(firstDepositAmount)
        expect(await prizePool.awardBalance(), "pool awardBalance after 1 day").to.eq(0)

        await prizePool.captureAwardBalance()

        expect(await prizePool.accountedBalance(), "pool accountedBalance after capture award").to.eq(firstDepositAmount)
        // award = 0.1% of deposits
        const awardBalanceExpected = firstDepositAmount.div(1000)
        assertBNClose(await prizePool.awardBalance(), awardBalanceExpected, 2000000, "pool awardBalance after capture award")
        // Seconds since deposit * credit rate with a max of the credit limit
        // expect(await prizePool.callStatic.balanceOfCredit(mUsdWhale1Address, controlToken.address), "Whale 1 pool credits").to.eq(
        //     ,
        // )
    })
    const secondDepositAmount = simpleToExactAmount(20000)
    it("mUSD whale 2 deposits into pool", async () => {
        expect(await mAsset.balanceOf(mUsdWhale2Address), "mUSD Whale 2 has enough mUSD").to.gt(secondDepositAmount)
        await mAsset.connect(mUsdWhale2.signer).approve(prizePool.address, secondDepositAmount)
        await prizePool
            .connect(mUsdWhale2.signer)
            .depositTo(mUsdWhale2.address, secondDepositAmount, controlToken.address, mUsdWhale2.address)

        expect(await controlToken.balanceOf(mUsdWhale2Address), "mUSD Whale control balance after").to.eq(secondDepositAmount)
        expect(await controlToken.totalSupply(), "total supply control after").to.eq(firstDepositAmount.add(secondDepositAmount))
        expect(await prizePool.accountedBalance(), "prize pool accountedBalance after").to.eq(firstDepositAmount.add(secondDepositAmount))
    })
    it("Move time ahead 6 days", async () => {
        await increaseTime(ONE_DAY.mul(6).add(ONE_MIN))
        const whale1MusdBalanceBefore = await mAsset.balanceOf(mUsdWhale1Address)
        expect(await controlToken.balanceOf(mUsdWhale1Address), "Whale 1 control balance before").to.eq(firstDepositAmount)
        expect(await controlToken.balanceOf(mUsdWhale2Address), "Whale 2 control balance before").to.eq(secondDepositAmount)
        expect(await prizePool.accountedBalance(), "prize pool accountedBalance before").to.eq(firstDepositAmount.add(secondDepositAmount))
        expect(await controlToken.totalSupply(), "total supply control before").to.eq(firstDepositAmount.add(secondDepositAmount))
        const lastRngRequestIdBefore = await prizeStrategy.getLastRngRequestId()
        expect(lastRngRequestIdBefore, "lastRngRequestId before").to.eq(0)
        expect(await prizeStrategy.isRngTimedOut(), "RNG not timed out before start").to.be.false
        const rngRequestTimeout = await prizeStrategy.rngRequestTimeout()
        expect(rngRequestTimeout, "rngRequestTimeout 30 minutes").to.eq(ONE_MIN.mul(30))
        const blockNumberBefore = await ethers.provider.getBlockNumber()
        const blockBefore = await ethers.provider.getBlock(blockNumberBefore)
        expect(await prizeStrategy.prizePeriodEndAt(), "prize period has ended").to.lt(blockBefore.timestamp)

        const startAtBefore = await prizeStrategy.prizePeriodStartedAt()
        const endAtBefore = await prizeStrategy.prizePeriodEndAt()
        const remainingSecondsBefore = await prizeStrategy.prizePeriodRemainingSeconds()
        const periodSeconds = await prizeStrategy.prizePeriodSeconds()

        expect(await prizeStrategy.isRngRequested(), "isRngRequested before start").to.be.false
        expect(await prizeStrategy.isRngCompleted(), "isRngCompleted before start").to.be.true
        expect(await prizeStrategy.isRngTimedOut(), "RNG not timed out before start").to.be.false
        expect(await prizeStrategy.canStartAward(), "canStartAward before start").to.be.true

        // Start award of prize
        const startTx = await prizeStrategy.startAward()
        const blockNumberAfter = await ethers.provider.getBlockNumber()
        expect(blockNumberAfter, "block numbers").to.gt(blockNumberBefore)
        const lastRngRequestIdAfter = await prizeStrategy.getLastRngRequestId()

        expect(lastRngRequestIdAfter, "lastRngRequestId after").to.gt(0)
        expect(await prizeStrategy.isRngRequested(), "isRngRequested after start").to.be.true
        expect(await prizeStrategy.isRngCompleted(), "isRngCompleted after start").to.be.false
        expect(await prizeStrategy.isRngTimedOut(), "RNG not timed out after start").to.be.false
        expect(await prizeStrategy.canCompleteAward(), "canCompleteAward after start").to.be.false

        // do this twice as completeAward() needs to be 2 blocks after startAward()
        await increaseTime(ONE_MIN)
        await increaseTime(ONE_MIN)

        expect(await prizeStrategy.isRngRequested(), "isRngRequested before complete").to.be.true
        expect(await prizeStrategy.isRngCompleted(), "isRngCompleted before complete").to.be.true
        expect(await prizeStrategy.isRngTimedOut(), "RNG not timed out before complete").to.be.false
        expect(await prizeStrategy.canCompleteAward(), "canCompleteAward before complete").to.be.true

        expect(await controlToken.totalSupply(), "Control token supply before complete").to.eq(firstDepositAmount.add(secondDepositAmount))
        expect(await sponsorToken.totalSupply(), "Sponsor token supply before complete").to.eq(0)

        // Complete award of prize
        const tx = await prizeStrategy.completeAward()
        const receipt = await tx.wait()
        const completeAwardEvents = receipt.logs.reduce((array: LogDescription[], log) => {
            try {
                array.push(prizePool.interface.parseLog(log))
                // eslint-disable-next-line no-empty
            } catch (e) {}
            return array
        }, [])
        const awardEvent = completeAwardEvents.find((e) => e.name === "Awarded")!
        expect(awardEvent, "Awarded event").to.exist

        expect(await prizeStrategy.isRngRequested(), "isRngRequested after complete").to.be.false
        expect(await prizeStrategy.isRngCompleted(), "isRngCompleted after complete").to.be.true
        expect(await prizeStrategy.isRngTimedOut(), "RNG not timed out before complete").to.be.false

        console.log(`Winner ${awardEvent.args.winner}, amount ${awardEvent.args.amount}`)
        expect(awardEvent.args.winner, "winner").to.eq(mUsdWhale1Address)
        // 0.1% interest was only paid after the first deposit so the second deposit missed earning the 0.1% interest
        // expect(awardEvent.args.amount, "winner amount").to.eq(firstDepositAmount.div(1000))
        assertBNClose(awardEvent.args.amount, firstDepositAmount.div(1000), 2000000000000000, "winner amount")
        expect(await controlToken.balanceOf(mUsdWhale2Address), "Whale 2 control balance after").to.eq(secondDepositAmount)
        expect(await controlToken.balanceOf(mUsdWhale1Address), "Whale 1 control balance after").to.eq(
            firstDepositAmount.add(awardEvent.args.amount),
        )
        expect(await mAsset.balanceOf(mUsdWhale1Address), "Winner mUSD balance doesn't change").to.eq(whale1MusdBalanceBefore)
        expect(await prizePool.awardBalance(), "prize pool awardBalance after").to.eq(0)
    })
    it("Whale 1 withdraw deposit and some winnings", async () => {
        const whale1ControlBalanceBefore = await controlToken.balanceOf(mUsdWhale1Address)
        // Leaving only 100 mUSD in the pool
        const withdrawAmount = await whale1ControlBalanceBefore.sub(simpleToExactAmount(100))
        await prizePool.withdrawInstantlyFrom(mUsdWhale1Address, withdrawAmount, controlToken.address, 0)
        expect(await controlToken.balanceOf(mUsdWhale1Address), "whale 1 balance after").to.eq(simpleToExactAmount(100))
    })
    it("Award a second prize", async () => {
        await saving.connect(savingsManager.signer).depositInterest(simpleToExactAmount(11000))
        await increaseTime(ONE_DAY.mul(7).add(ONE_MIN))
        await prizeStrategy.startAward()
        await increaseTime(ONE_MIN)
        await increaseTime(ONE_MIN)
        const tx = await prizeStrategy.completeAward()

        const receipt = await tx.wait()
        const completeAwardEvents = receipt.logs.reduce((array: LogDescription[], log) => {
            try {
                array.push(prizePool.interface.parseLog(log))
                // eslint-disable-next-line no-empty
            } catch (e) {}
            return array
        }, [])
        const awardEvent = completeAwardEvents.find((e) => e.name === "Awarded")!
        expect(awardEvent, "Awarded event").to.exist
        expect(awardEvent.args.winner, "winner").to.eq(mUsdWhale2Address)
    })
    it("Whale 2 withdraws all", async () => {
        const whale2ControlBalanceBefore = await controlToken.balanceOf(mUsdWhale2Address)
        await prizePool
            .connect(mUsdWhale2.signer)
            .withdrawInstantlyFrom(mUsdWhale2Address, whale2ControlBalanceBefore, controlToken.address, 0)
        expect(await controlToken.balanceOf(mUsdWhale2Address), "whale 2 balance after").to.eq(0)
    })
    it("sponsor deposit", async () => {
        const savingsCreditBefore = await savingERC20.totalSupply()
        expect(await sponsorToken.balanceOf(mUsdWhale1Address), "Whale 1 sponsor balance before").to.eq(0)

        const sponsorAmount = simpleToExactAmount(100000)
        await mAsset.approve(prizePool.address, sponsorAmount)
        await prizePool.depositTo(mUsdWhale1Address, sponsorAmount, sponsorToken.address, mUsdWhale1Address)

        expect(await savingERC20.totalSupply()).to.gt(savingsCreditBefore)
        expect(await sponsorToken.balanceOf(mUsdWhale1Address), "Whale 1 sponsor balance after").to.eq(sponsorAmount)
    })
    it("sponsor withdraw", async () => {
        await prizePool.withdrawInstantlyFrom(mUsdWhale1Address, simpleToExactAmount(90000), sponsorToken.address, mUsdWhale1Address)
        expect(await sponsorToken.balanceOf(mUsdWhale1Address), "Whale 1 sponsor balance after").to.eq(simpleToExactAmount(10000))
    })
})
