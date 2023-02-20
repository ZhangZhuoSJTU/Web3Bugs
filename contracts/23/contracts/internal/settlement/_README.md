# Settlement

Notional portfolio assets have maturities which makes them different from most ERC20 assets. fCash assets will settle at their designated maturity date and liquidity tokens settle every quarter along with their respective market. Settling assets is triggered automatically when accounts transact and determined by the `nextSettleTime` timestamp in their account context. Triggering of settlement is determined in `SettleAssetsExternal.sol` and the `mustSettleAssets.

## Settling fCash

fCash is denominated in underlying amounts but settled into **asset cash**. This means that an account with 1000 fDAI (fCash in DAI) will receive 1000 DAI worth of cDAI at maturity, given the settlement rate for that maturity. We store a single settlement rate for every maturity in a currency, guaranteeing that all fCash of the same maturity converts to asset cash at the same exchange rate. This ensures that the system always has equal positive and negative asset cash.

## Settling Liquidity Tokens

Liquidity tokens always settle at 90 day intervals when markets settle. Liquidity tokens are a claim on asset cash and fCash held in a market. A liquidity token, therefore, settles to those two components -- a positive asset cash balance and a net residual fCash position (most liquidity providers will have a negative fCash position as this is the default when providing liquidity). In addition, markets must be updated to account for the settled liquidity tokens.

The net residual fCash position does not necessarily settle at the same time as the liquidity token. A liquidity token in a 1 year market which is settled after the market closes at 9 months, will have a residual fCash asset with 9 months until maturity. This is called an **idiosyncratic fCash asset** or **ifCash** for short. This asset will stay in the liquidity provider's portfolio until it matures or is traded away.

## Settling Bitmap Assets

Bitmap portfolios can only have fCash assets so that reduces some complexity in settlement. However, due to the different **time chunks** updating the assets bitmap does require some specialized math and bitwise operations.

These are the relevant data objects:

- 256 bit ifCash bitmap: each bit signifies the presence of ifCash at the corresponding date
- Next Settle Time: set to the UTC midnight date of the first bit
- mapping(maturity => int): a mapping between maturities and the notional ifCash value held at that maturity.

The bitmap is broken down into four **time chunks** as follows (1-indexed, inclusive):

Define `t = blockTime - (blockTime % 86400)` (current day, midnight utc)

- Bit 1 to 90: `t + bitNum * 1 day`
- Bit 91 to 135: `t + 90 days - (t mod 6 days) + (bitNum - 90) * 6 days`
- Bit 136 to 195: `t + 360 days - (t mod 30 days) + (bitNum - 135) * 30 days`
- Bit 196 to 256: `t + 2160 days - (t mod 90 days) + (bitNum - 195) * 90 days`

The max relative day for each block is:

- Max Day Block: `t + 90`
- Max Days of Week Block: `t + 90 - 0 + (135 - 90) * 6 = t + 360`
- Max Days of Month Block: `t + 360 - 0 + (195 - 135) * 30 = t + 2160`
- Max Days of Quarter Block: `t + 2160 - 0 + (256 - 195) * 90 = t + 7650`

#### From Maturity to Bit Number

```syntax=python
def getBitNumFromMaturity(blockTimeUTC0, maturity):
    offset = maturity - blockTimeUTC0
    t = blockTimeUTC0 / SECONDS_IN_DAY
    require(offset > 0)

    if offset <= 90:
        return offset
    if offset <= 360:
        return 90 + math.floor((n - 90) / 6)
    if offset <= 2160:
        return 135 + math.floor((n - 360) / 30)
    if offset <= 7650:
        return 195 + math.floor((n - 2160) / 90)
```

#### From Bit Number to Maturity

```syntax=python
def getMaturityFromBitNum(blockTimeUTC0, bitNum):
    if bitNum <= 90:
        return blockTimeUTC0 + bitNum days
    if bitNum <= 135:
        return blockTimeUTC0 + 90 days + (bitNum - 90) * 6 days
    if bitNum <= 195:
        return blockTimeUTC0 + 360 days + (bitNum - 135) * 30 days
    if bitNum <= 256
        return blockTimeUTC0 + 2160 days + (bitNum - 195) * 90 days
```

### Mapping on Roll Down

As assets roll down from higher time chunks to lower time chunks, we must ensure that they can be mapped to an existing bit number. Since all the time chunks are factors of each other, we know that the dates in higher time chunks will be contained in lower chunks.

If `ac = bc mod mc` then `a = b mod m`, therefore all of these are equal:

- `d = t mod 1`
- `d * 6 = t * 6 mod 6`
- `((d * 6) * 5) = ((t * 6) * 5) mod (6 * 5)`
- `d * 30 = t * 30 mod 30`
- `(d * 30) * 3 = (t * 30) * 3 mod (30 * 3)`
- `d * 90 = t * 90 mod 90`

The algorithm for settling bitmapped portfolios is:

- Get the bit number that represents the new first bit at the current block time, call this `lastSettleBit = getBitNumFromMaturity(nextSettleTime, blockTimeUTC0)`. The bits from the first bit to `lastSettleBit` represent (inclusive) represent the bits that need to be settled if assets exist.
- Scan each time chunk in [1, `lastSettleBit`] as defined above and settle fCash to asset cash. Delete mappings accordingly.
- As time progresses, bits from higher time chunks need to be remapped to lower time chunks. We cannot simply shift the bits because the time chunks are of different sizes. Remapping is as follows:
  - If a time chunk has been completely settled (i.e. `lastSettleBit > maxBitOffset`) then there is no need to remap, all bits are already set to zero.
  - Set the beginning of the bit remapping to the first bit that needs to be remapped, this is `remapBitOffset = max(lastSettleBit, firstBitOfTimeChunk)`
  - For the bit range [`remapBitOffset`, `maxBitOffset`], calculate the amount of time that has passed between settlements and convert this into bits that need to be shifted in that time chunk
    - `totalTimePassed = getMaturityFromBitNum(nextSettleTime, remapBitOffset) - getMaturityFromBitNum(blockTimeUTC0, remapBitOffset)`
    - `bitsToShiftInTimeChunk = totalTimePassed / timeChunkTimeLength`
  - Next, scan through the bits of the time chunk from [1, `bitsToShiftInTimeChunk`] and for each bit that is set calculate its new bit number given the new block time (`newBitNum = getBitNumFromMaturity(blockTimeUTC0, maturity)`)
  - Set `newBitNum` in the lower time chunk.
