## PoolBase





### `getCooldownFee(contract IERC20 _token) → uint256`
No description


### `getSherXWeight(contract IERC20 _token) → uint256`
No description


### `getGovPool(contract IERC20 _token) → address`
No description


### `isPremium(contract IERC20 _token) → bool`
No description


### `isStake(contract IERC20 _token) → bool`
No description


### `getProtocolBalance(bytes32 _protocol, contract IERC20 _token) → uint256`
No description


### `getProtocolPremium(bytes32 _protocol, contract IERC20 _token) → uint256`
No description


### `getLockToken(contract IERC20 _token) → contract ILock`
No description


### `isProtocol(bytes32 _protocol, contract IERC20 _token) → bool`
No description


### `getProtocols(contract IERC20 _token) → bytes32[]`
No description


### `getUnstakeEntry(address _staker, uint256 _id, contract IERC20 _token) → struct PoolStorage.UnstakeEntry`
No description


### `getTotalAccruedDebt(contract IERC20 _token) → uint256`
No description


### `getFirstMoneyOut(contract IERC20 _token) → uint256`
No description


### `getAccruedDebt(bytes32 _protocol, contract IERC20 _token) → uint256`
No description


### `getTotalPremiumPerBlock(contract IERC20 _token) → uint256`
No description


### `getPremiumLastPaid(contract IERC20 _token) → uint256`
No description


### `getSherXUnderlying(contract IERC20 _token) → uint256`
No description


### `getUnstakeEntrySize(address _staker, contract IERC20 _token) → uint256`
No description


### `getInitialUnstakeEntry(address _staker, contract IERC20 _token) → uint256`
No description


### `getStakersPoolBalance(contract IERC20 _token) → uint256`
No description


### `getStakerPoolBalance(address _staker, contract IERC20 _token) → uint256`
No description


### `getTotalUnmintedSherX(contract IERC20 _token) → uint256`
No description


### `getUnallocatedSherXStored(contract IERC20 _token) → uint256`
No description


### `getUnallocatedSherXTotal(contract IERC20 _token) → uint256`
No description


### `getUnallocatedSherXFor(address _user, contract IERC20 _token) → uint256`
No description


### `getTotalSherXPerBlock(contract IERC20 _token) → uint256`
No description


### `getSherXPerBlock(contract IERC20 _token) → uint256`
No description


### `getSherXPerBlock(address _user, contract IERC20 _token) → uint256`
No description


### `getSherXPerBlock(uint256 _lock, contract IERC20 _token) → uint256`
No description


### `getSherXLastAccrued(contract IERC20 _token) → uint256`
No description


### `LockToTokenXRate(contract IERC20 _token) → uint256`
No description


### `LockToToken(uint256 _amount, contract IERC20 _token) → uint256`
No description


### `TokenToLockXRate(contract IERC20 _token) → uint256`
No description


### `TokenToLock(uint256 _amount, contract IERC20 _token) → uint256`
No description


### `baseData() → struct PoolStorage.Base ps`
No description


### `bps() → contract IERC20 rt`
No description


### `setCooldownFee(uint256 _fee, contract IERC20 _token)`
No description


### `depositProtocolBalance(bytes32 _protocol, uint256 _amount, contract IERC20 _token)`
No description


### `withdrawProtocolBalance(bytes32 _protocol, uint256 _amount, address _receiver, contract IERC20 _token)`
No description


### `activateCooldown(uint256 _amount, contract IERC20 _token) → uint256`
No description


### `cancelCooldown(uint256 _id, contract IERC20 _token)`
No description


### `unstakeWindowExpiry(address _account, uint256 _id, contract IERC20 _token)`
No description


### `unstake(uint256 _id, address _receiver, contract IERC20 _token) → uint256 amount`
No description


### `payOffDebtAll(contract IERC20 _token)`
No description


### `cleanProtocol(bytes32 _protocol, uint256 _index, bool _forceDebt, address _receiver, contract IERC20 _token)`
No description





