# Reading the Data

## Supply
- Total citadel supply: `citadel.totalSupply()`
- Total citadel value staked: `xCitadel.totalSupply() * xCitadel.getPricePerFullShare()`
  - (note that the staked supply also includes the supply locked, as xCitadel it is the coin locked up - coins must be staked while locked)
- Total citadel value locked: `xCitadelLocker.totalSupply()`
- Total citadel locked, historically by epoch: `xCitadelLocker.totalSupplyAtEpoch(<epoch>)`

## Emissions
Note that an epoch = 21 days
* Citadel minted per epoch, during current epoch: `supplySchedule.getEmissionsForCurrentEpoch()`
* Citadel minted per epoch, during a given epoch: `supplySchedule.getEmissionsForEpoch(<epoch>)`

The following data cannot be read on chain, but can be derived by scraping event logs of the given event.
* Overall Citadel emitted to all funding pools for a given time period: `event CitadelDistributionToFunding(uint startTime, uint endTime, uint citadelAmount);`
* Citadel emitted to funding a certain funding pool for a given time period: `event CitadelDistributionToFundingPool(uint startTime, uint endTime, address pool, uint citadelAmount);`
* Overall Citadel emitted to stakers for a given time period: `event CitadelDistributionToStaking(uint startTime, uint endTime, uint citadelAmount);`
* Overall Citadel emitted to lockers over a given time period: `event CitadelDistributionToLocking(uint startTime, uint endTime, uint citadelAmount, uint xCitadelAmount);`

## Yield
