let valueChange = (~totalLockedLong, ~totalLockedShort, ~percentageChange) => {
  if totalLockedShort->Ethers.BigNumber.gte(totalLockedLong) {
    totalLockedLong
    ->Ethers.BigNumber.mul(percentageChange)
    ->Ethers.BigNumber.div(CONSTANTS.tenToThe18)
  } else {
    totalLockedShort
    ->Ethers.BigNumber.mul(percentageChange)
    ->Ethers.BigNumber.div(CONSTANTS.tenToThe18)
  }
}
type bothSides = {
  totalLockedLong: Ethers.BigNumber.t,
  totalLockedShort: Ethers.BigNumber.t,
}

let simulateMarketPriceChange = (~oldPrice, ~newPrice, ~totalLockedLong, ~totalLockedShort) => {
  switch (oldPrice, newPrice) {
  | (a, b) if a->Ethers.BigNumber.eq(b) => {
      totalLockedLong: totalLockedLong,
      totalLockedShort: totalLockedShort,
    }
  | (oldPrice, newPrice) if oldPrice->Ethers.BigNumber.lt(newPrice) => {
      let percentageChange =
        newPrice
        ->Ethers.BigNumber.sub(oldPrice)
        ->Ethers.BigNumber.mul(CONSTANTS.tenToThe18)
        ->Ethers.BigNumber.div(oldPrice)

      if percentageChange->Ethers.BigNumber.gte(CONSTANTS.tenToThe18) {
        let totalLocked = totalLockedLong->Ethers.BigNumber.add(totalLockedShort)
        {
          totalLockedLong: totalLocked,
          totalLockedShort: CONSTANTS.zeroBn,
        }
      } else {
        let changeInValue = valueChange(~percentageChange, ~totalLockedLong, ~totalLockedShort)

        {
          totalLockedLong: totalLockedLong->Ethers.BigNumber.add(changeInValue),
          totalLockedShort: totalLockedShort->Ethers.BigNumber.sub(changeInValue),
        }
      }
    }
  | (oldPrice, newPrice) => {
      let percentageChange =
        oldPrice
        ->Ethers.BigNumber.sub(newPrice)
        ->Ethers.BigNumber.mul(CONSTANTS.tenToThe18)
        ->Ethers.BigNumber.div(oldPrice)
      if percentageChange->Ethers.BigNumber.gte(CONSTANTS.tenToThe18) {
        let totalLocked = totalLockedLong->Ethers.BigNumber.add(totalLockedShort)

        {
          totalLockedLong: CONSTANTS.zeroBn,
          totalLockedShort: totalLocked,
        }
      } else {
        let changeInValue = valueChange(~percentageChange, ~totalLockedLong, ~totalLockedShort)

        {
          totalLockedLong: totalLockedLong->Ethers.BigNumber.sub(changeInValue),
          totalLockedShort: totalLockedShort->Ethers.BigNumber.add(changeInValue),
        }
      }
    }
  }
}
