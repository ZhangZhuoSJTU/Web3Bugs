# DAO
## Staking
- [x] Only approved assets can be staked
- [x] Only live staking
- [x] Staking Eye sets fate per day to root EYE 
- [x] Staking Eye and wait increases fate correctly
- [x] Staking LP set eye to 2 root eye balance
- [x] Adjusting eye stake down releases eye and sets fate per day correctly
- [x] Adjusting eye stake up takes more eye and sets fate per day correctly
- [x] Adjusting LP stake down releases eye and sets fate per day correctly
- [x] Adjusting LP stake up takes more eye and sets fate per day correctly

- [x] Staking, getting fate and then changing stake and waiting ends up with correct fate
- [x] Staking multiple asset types sets fate rate correctly
- [x] Test burning EYE and burning LP to get much higher votes


## Proposals
- [x] Insufficient fate to lodge rejected
- [x] Lodging proposal while existing proposal valid rejected
- [x] lodging proposal when none exist accepted
- [x] Lodging proposal while existing proposal expired accepted
- [x] Voting yes on current proposal accepts it after duration, can then be executed
- [x] voting no on current proposal makes it unexecutable.
- [x] asset approval proposal can add and remove approved assets
- [x] Voting that flips extends cut off


## Limbo
**old souls**
- [x] old souls can be claimed from
- [x] old souls can be bonus claimed from
- [x] perpetual pools have no upper limit

**Config**
- [x] populating crossingConfig with configureCrossingConfig
- [x] use flashGovernance to adjustSoul
- [x] flashGovernance adjust configureCrossingParameters
- [x] reverse fashGov decision and burn asset
- [x] shutdown soul staking and withdraw tokens
- [x] protocol disabled blocks all functions

**staking** 
- [x] unstaking rewards user correctly and sets unclaimed to zero
- [x] staking/unstaking only possible in staking state.
- [x] staking an invalid token fails
- [x] aggregate rewards per token per second aligns with configuration and adds up to flan per second.
- [x] unstaking with exitPenalty > 1000 reverts with E3
- [x] unstaking amount larger than balance reverts with E4
- [x] unstaking with exitPenalty > 0 incurs penalty on claims  

**claims**
- [x] claims disabled on exitPenalty>0
- [x] claiming staked reward resets unclaimed to zero
- [x] claim rising bonus 
- [x] claim falling bonus 
- [x] claim bonus disabled during staking
- [x] claiming bonus twice fails.
- [x] claiming negative bonus fails

**migration governance**
- [x] withdrawERC20 fails on souls
- [x] withdrawERC20 succeeds on non listed tokens or previously listed tokens.
- [x] migration fails on not waitingToCross
- [x] stamping reserves requires wait to pass before migration
- [x] too much reserve drift between stamping and execution fails (divergenceTolerance)
- [x] only threshold souls can migrate
- [x] SCX burnt leaves rectangle of fairness.
- [x] Flan price and liquidity higher post migration.
- [x] soul changed to crossedOver post migration
- [x] token tradeable on Behodler post migration.
- [x] flash governance max tolerance respected
- [x] not enough time between crossing and migration
- [x] flan fee on transfer proposal
- [x] successful mock migration
- [] flan genesis event