/* eslint-disable no-console */
import { task, types } from 'hardhat/config'
import { parseEther, formatEther } from '@ethersproject/units'
import { PrePOMarket } from '../typechain'
import { getCollateralNeededForPosition, PrePO } from '../harnesses/PrePO'
import { sendTxAndWait } from '../helpers'

task('fund-position', 'fund user with collateral and purchase a long/short position')
  .addParam('market', 'address of PrePO market to fund position in')
  .addParam(
    'collateralAmount',
    "amount of collateral minted for the user, ethers string e.g. '1' = 1 ether."
  )
  .addParam(
    'positionAmount',
    "amount of Long/Short tokens minted for the user, ethers string e.g. '1' = 1 ether."
  )
  .addParam('minter', 'account to mint assets from')
  .addOptionalParam(
    'recipient',
    'account to receive minted assets, defaults to minter',
    '',
    types.string
  )
  .setAction(async (args, { ethers, getChainId }) => {
    const prePO = await PrePO.Instance.init(await getChainId(), ethers)
    const minter = await ethers.provider.getSigner(args.minter)
    const minterAddress = await minter.getAddress()
    const recipient =
      args.recipient === '' ? minter : await ethers.provider.getSigner(args.recipient)
    const recipientAddress = await recipient.getAddress()
    const market = prePO.marketContractFactory.attach(args.market) as PrePOMarket

    /** PRE-CALCULATIONS * */
    console.log('Calculating Collateral amounts needed...')
    const positionAmount = parseEther(args.positionAmount)
    const collateralNeededForPosition = await getCollateralNeededForPosition(market, positionAmount)
    console.log('Collateral to mint for position:', formatEther(collateralNeededForPosition))
    const totalCollateralNeeded = parseEther(args.collateralAmount).add(collateralNeededForPosition)
    console.log('Additional Collateral to mint:', args.collateralAmount)
    console.log('Total Collateral to mint:', formatEther(totalCollateralNeeded))
    console.log('Calculating BaseToken needed for both Collateral and position')
    const totalBaseTokenNeeded = await prePO.getBaseTokenNeededForShares(totalCollateralNeeded)
    console.log('Total BaseToken needed for shares:', formatEther(totalBaseTokenNeeded))

    /** BASETOKEN MINTING BY OWNER * */
    const minterBaseTokenBalanceBefore = await prePO.baseToken.balanceOf(minterAddress)
    if (totalBaseTokenNeeded.gt(minterBaseTokenBalanceBefore)) {
      console.log('Minting BaseToken...')
      if ((await prePO.baseToken.owner()) !== minterAddress) {
        throw new Error(`${minterAddress} cannot mint BaseToken at ${prePO.baseToken.address}`)
      }
      console.log(
        await prePO.baseToken.symbol(),
        'balance of minter before minting:',
        formatEther(minterBaseTokenBalanceBefore)
      )
      await sendTxAndWait(await prePO.baseToken.connect(minter).ownerMint(totalBaseTokenNeeded))
      console.log(
        await prePO.baseToken.symbol(),
        'balance of minter after minting:',
        formatEther(await prePO.baseToken.balanceOf(minterAddress))
      )
    }

    /** COLLATERAL VAULT CHECKS * */
    // TODO Need to add checks for if Collateral vault is at capacity.
    if (!(await prePO.collateral.getDepositsAllowed())) {
      throw new Error(
        `Collateral vault at ${prePO.collateral.address} has deposits currently disabled`
      )
    }

    /** COLLATERAL MINTING * */
    console.log('Minting Collateral amount...')
    await sendTxAndWait(
      await prePO.baseToken.connect(minter).approve(prePO.collateral.address, totalBaseTokenNeeded)
    )
    const minterBaseTokenBeforeMinting = await prePO.baseToken.balanceOf(minterAddress)
    console.log('Collateral ')
    await sendTxAndWait(await prePO.collateral.deposit(totalBaseTokenNeeded))
    const minterBaseTokenAfterMinting = await prePO.baseToken.balanceOf(minterAddress)
    console.log(
      'BaseToken spent minting Collateral:',
      formatEther(minterBaseTokenBeforeMinting.sub(minterBaseTokenAfterMinting))
    )

    /** LONG/SHORT MINTING * */
    const minterCollateralBeforeMinting = await prePO.collateral.balanceOf(minterAddress)
    if (positionAmount.gt(0)) {
      console.log('Minting Long Short position...')
      console.log('Expected Collateral to spend:', formatEther(collateralNeededForPosition))
      await sendTxAndWait(
        await prePO.collateral.connect(minter).approve(market.address, collateralNeededForPosition)
      )
      await sendTxAndWait(
        await market.connect(minter).mintLongShortTokens(collateralNeededForPosition)
      )
      const minterCollateralAfterMinting = await prePO.collateral.balanceOf(minterAddress)
      console.log(
        'Collateral spent minting position:',
        formatEther(minterCollateralBeforeMinting.sub(minterCollateralAfterMinting))
      )
    }

    /** TRANSFER TO USER(IF RECIPIENT IS NOT OWNER) * */
    const longToken = prePO.positionContractFactory.attach(await market.getLongToken())
    const shortToken = prePO.positionContractFactory.attach(await market.getShortToken())
    if (recipientAddress !== minterAddress) {
      // Transfer assets minted by the deployer to the user
      await sendTxAndWait(
        await prePO.collateral.connect(minter).transfer(recipientAddress, args.collateralAmount)
      )
      await sendTxAndWait(
        await longToken.connect(minter).transfer(recipientAddress, positionAmount)
      )
      await sendTxAndWait(
        await shortToken.connect(minter).transfer(recipientAddress, positionAmount)
      )
    }
    console.log(
      await prePO.baseToken.symbol(),
      'balance:',
      formatEther(await prePO.baseToken.balanceOf(recipientAddress))
    )
    console.log(
      await prePO.collateral.symbol(),
      'balance:',
      formatEther(await prePO.collateral.balanceOf(recipientAddress))
    )
    console.log(
      await longToken.symbol(),
      'balance:',
      formatEther(await longToken.balanceOf(recipientAddress))
    )
    console.log(
      await shortToken.symbol(),
      'balance:',
      formatEther(await shortToken.balanceOf(recipientAddress))
    )
  })

task('display-balances', 'display balances for an account')
  .addParam('market', 'address of market')
  .addOptionalParam('account', 'account to display market balances for', '', types.string)
  .setAction(async (args, { ethers, getChainId }) => {
    const prePO = await PrePO.Instance.init(await getChainId(), ethers)
    const market = prePO.marketContractFactory.attach(args.market) as PrePOMarket
    const longToken = prePO.positionContractFactory.attach(await market.getLongToken())
    const shortToken = prePO.positionContractFactory.attach(await market.getShortToken())
    console.log(
      await prePO.baseToken.symbol(),
      'balance:',
      formatEther(await prePO.baseToken.balanceOf(args.account))
    )
    console.log(
      await prePO.collateral.symbol(),
      'balance:',
      formatEther(await prePO.collateral.balanceOf(args.account))
    )
    console.log(
      await longToken.symbol(),
      'balance:',
      formatEther(await longToken.balanceOf(args.account))
    )
    console.log(
      await shortToken.symbol(),
      'balance:',
      formatEther(await shortToken.balanceOf(args.account))
    )
  })
