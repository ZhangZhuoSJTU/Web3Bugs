import * as MintMath from '../../libraries/LiquidityMath'
import { constructorFixture, Fixture, mintMathCalleeGivenAssetFixture, mintMathCalleeGivenNewFixture, newLiquidityFixture } from '../../shared/Fixtures'
import * as fc from 'fast-check'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers, waffle } from 'hardhat'
import { now, setTime } from '../../shared/Helper'
import * as LiquidityFilter from '../../filters/Liquidity'
import * as LiquidityMath from '../../libraries/LiquidityMath'
import { expect } from '../../shared/Expect'

const { loadFixture } = waffle

let maturity = 0n
let signers: SignerWithAddress[] = []

const MAXUINT112: bigint = 2n ** 112n
async function fixture(): Promise<Fixture> {
  maturity = (await now()) + 31536000n
  signers = await ethers.getSigners()

  const constructor = await constructorFixture(1n << 255n, 1n << 255n, maturity, signers[0])
 
  return constructor
}
describe('Mint Math Given New', () => {


    it('Succeeded', async () => {
      const { maturity } = await loadFixture(fixture)
      let currentTime = await now()
  
      await fc.assert(
        fc.asyncProperty(
          fc.record({
                  assetIn: fc.bigUintN(112),
                  debtIn: fc.bigUintN(112),
                  collateralIn: fc.bigUintN(112),
                }).filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)).noShrink(),
          async (data) => {
            const success = async () => {
              const constructor = await loadFixture(fixture)
              await setTime(Number(currentTime + 5000n))

              const mintMath = await mintMathCalleeGivenNewFixture(constructor,signers[0],data)

              return mintMath
  
            }
            const [yIncrease, zIncrease] = (await loadFixture(success)).map((x)=>x.toBigInt())
            mintMathNewProperties(data,currentTime+5_000n,maturity,yIncrease,zIncrease);
          }),
        { skipAllAfterTimeLimit: 50000, numRuns: 10 }
        )   
  
      }).timeout(100000)
    })

    describe('Mint Math Given Asset', () => {
      it('Succeeded', async () => {
        const { maturity, assetToken, collateralToken } = await loadFixture(fixture)
        let currentTime = await now()
    
        await fc.assert(
          fc.asyncProperty(
            fc
              .record({
                newLiquidityParams: fc
                  .record({
                    assetIn: fc.bigUintN(112),
                    debtIn: fc.bigUintN(112),
                    collateralIn: fc.bigUintN(112),
                  })
                  .filter((x) => LiquidityFilter.newLiquiditySuccess(x, currentTime + 5_000n, maturity)),
                addLiquidityParams: fc.record({
                  assetIn: fc.bigUintN(112),
                  minLiquidity: fc.bigUintN(256),
                  maxDebt: fc.bigUintN(112),
                  maxCollateral: fc.bigUintN(112),
                }),
              })
              .filter((x) => LiquidityFilter.addLiquiditySuccess(x, currentTime + 5_000n, currentTime + 10_000n, maturity)),
            async (data) => {
              const success = async () => {
                const constructor = await loadFixture(fixture)
                await setTime(Number(currentTime + 5000n))
                const newLiquidity = await newLiquidityFixture(constructor, signers[0], data.newLiquidityParams)
                await setTime(Number(currentTime + 10000n))
                const mintMathGivenAdd = await mintMathCalleeGivenAssetFixture(newLiquidity, signers[0], data.addLiquidityParams)
                return mintMathGivenAdd
              }

              const [yIncrease,zIncrease] = (await loadFixture(success)).map((x)=>x.toBigInt())
    
              await mintMathGivenAssetProperties(data, currentTime,maturity, yIncrease,zIncrease)
            }
          ),
          { skipAllAfterTimeLimit: 50000, numRuns: 10 }
        )
      }).timeout(100000)
    })

    function mintMathNewProperties(
      data: {
        assetIn: bigint
        debtIn: bigint
        collateralIn: bigint
      },
      currentTime: bigint,
      maturity: bigint,
      yIncrease: bigint,
      zIncrease: bigint
    ) {
      const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
        data.assetIn,
        data.debtIn,
        data.collateralIn,
        currentTime,
        maturity
      )
      expect(yIncrease).equalBigInt(yIncreaseNewLiquidity)
      expect(zIncrease).equalBigInt(zIncreaseNewLiquidity)
    }
    
    async function mintMathGivenAssetProperties(
      data: {
        newLiquidityParams: {
          assetIn: bigint
          debtIn: bigint
          collateralIn: bigint
        }
        addLiquidityParams: {
          assetIn: bigint
          minLiquidity: bigint
          maxDebt: bigint
          maxCollateral: bigint
        }
      },
      currentTime: bigint,
      maturity:bigint,
      yIncrease: bigint,
      zIncrease:bigint
    ) {
      const { yIncreaseNewLiquidity, zIncreaseNewLiquidity } = LiquidityMath.getYandZIncreaseNewLiquidity(
        data.newLiquidityParams.assetIn,
        data.newLiquidityParams.debtIn,
        data.newLiquidityParams.collateralIn,
        currentTime + 5_000n,
        maturity
      )
    
      const state = {
        x: data.newLiquidityParams.assetIn,
        y: yIncreaseNewLiquidity,
        z: zIncreaseNewLiquidity,
      }
      const { yIncreaseAddLiquidity, zIncreaseAddLiquidity } = LiquidityMath.getYandZIncreaseAddLiquidity(
        state,
        data.addLiquidityParams.assetIn
      )
      expect(yIncrease).equalBigInt(yIncreaseAddLiquidity)
      expect(zIncrease).equalBigInt(zIncreaseAddLiquidity)
    }