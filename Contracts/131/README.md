# Backd Tokenomics contest details

- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-05-backd-tokenomics-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts May 27, 2022 20:00 UTC
- Ends June 3, 2022 19:59 UTC

**NOTE** This contest is focused exclusively on the *tokenomics* aspect of Backd. [Another contest](https://github.com/code-423n4/2022-04-backd) was already run for the other parts of the protocol.
Some parts of the tokenomics may however require some understanding of the rest of the protocol.
We have a high-level description of all the protocol components in the other contest [README](https://github.com/code-423n4/2022-04-backd).

In this document, we give a high-level overview of Backd's tokenomics for participants of the Code4arena contest. We only focus on the contracts within the scope of the contest.

## Tokenomics overview

Backd tokenomics consists of several contracts that have for main goal to manage how the BKD token will be distributed to users.

BKD tokens are distributed to the following parties:

* Liquidity providers to [Backd liquidity pools](https://docs.backd.fund/protocol-architecture/pools/backdlp)
* Backd [keepers](https://docs.backd.fund/protocol-architecture/backd-keepers)
* Liquidity providers to whitelisted AMM pools (initially a BKD/WETH pool on Curve)

### Inflation schedule

The token supply is limited to a total of $268\,435\,456$ tokens. 
$48\%$ are reserved for distribution to LPs and keepers and $8\%$ are reserved for distribution to LPs of Backd governance token pools on AMMs.
The tokens reserved for distribution to LPs and LPs of Backd governance token pools on AMMs are released according to a common inflation schedule, i.e., the same inflation schedule applies to their respective allocations, while the distribution to keepers follows an independent piecewise-linear inflation schedule. 
The initial supply of governance tokens will be $2\%$ ($5\,368\,709$) of the total token supply, only comprised of the allocation for pre-launch LPs. 
Then, a further $56\%$ ($150\,323\,856$) are released according to a perpetual piece-wise linear inflation schedule with inflation rate $r$ for the shares for LPs and liquidity providers of Backd governance tokens on AMMs and an independent inflation rate for keepers.  
The annual inflation rate $r$ is then reduced by a factor of $0.6$ every year. 
The total token supply will thereby eventually approach $268\,435\,456$.

The `InflationManager` is the main contract in charge of handling the inflation schedule.


### Distribution to Backd LPs

Liquidity providers on Backd receive Backd governance tokens in proportion to the share of total liquidity they supply in a pool and the weight $w_p$ that is assigned to this pool. 
Note, pool weights will be adjustable via governance.
A pool's inflation rate is then calculated as $r' = w_p (t) r(t)$, were $t$ denotes the current time. An LP's fair share of a pool's distribution is then

$$
I_L = \sum_t \frac{r' b_L(t)}{S_p(t)}\,,
$$

where $b_L$ denotes the LP's deposited amount and $S_p$ denotes the total amount deposited in a pool.
Backd governance tokens received by an LP can be withdrawn immediately. 
To receive Backd governance tokens, LPs need to stake their LP tokens received from depositing to a Backd pool. 
They can therefore be used for registered positions and to earn Backd governance tokens simultaneously.

LP rewards are mainly managed by `LpGauge`.


### Distribution to Keepers

In the Backd protocol, keepers receive Backd governance tokens in proportion to the value of collateral top-ups they execute.
The value of top ups reported by a keeper $K$ is recorded on-chain by the protocol. 
The number of Backd governance tokens a keeper receives is computed periodically. 
A keepers fair share of the periodic distribution is based on the total value of top ups that keeper reported during a period, i.e.,

$$
I_K = V(P_K(t)) \ T(t) \,,
$$

where $V(P_K(t))$ is the fraction of total top ups executed by a keeper during period $t$ and $T(t)$ is the total value of executed top ups in that period.

The rewards for keepers are mostly handled in the `KeeperGauge`.

### Distribution to Backd AMM LPs

In addition to providing liquidity and reporting positions eligible for collateral top ups, users of the Backd protocol can also earn governance tokens by providing liquidity to AMM pools containing Backd governance tokens. 
In order to receive these, the LP token of the respective AMM pool must be staked in the Backd protocol and previously approved via governance.
Their fair share of released Backd governance tokens is computed as:

$$
I_A = \sum_t \frac{r(t) \cdot w_{AMM} b_A(t)}{S_A(t)} \,,
$$

where $w_{AMM}$ denotes the percentage of the total inflation distributed to AMM liquidity providers, $b_A$ denotes the amount of liquidity supplied by an AMM liquidity provider and $S_A$ denotes the total amount of liquidity in approved pools on AMMs containing Backd governance tokens.

The rewards for Backd AMM LPs are planned to be initially distributed through extra rewards for a Convex pool but could be distributed using `AMMGauge` should we change the AMM to something else than Curve (e.g. Uniswap).


## Files in scope

| Filename                                       |   Lines of code |
|------------------------------------------------|-----------------|
| contracts/access/Authorization.sol             |              11 |
| contracts/access/RoleManager.sol               |             139 |
| contracts/AddressProvider.sol                  |             247 |
| contracts/BkdLocker.sol                        |             242 |
| contracts/Controller.sol                       |              86 |
| contracts/RewardHandler.sol                    |              44 |
| contracts/StakerVault.sol                      |             262 |
| contracts/tokenomics/AmmGauge.sol              |             116 |
| contracts/tokenomics/BkdToken.sol              |              20 |
| contracts/tokenomics/FeeBurner.sol             |              73 |
| contracts/tokenomics/InflationManager.sol      |             442 |
| contracts/tokenomics/KeeperGauge.sol           |             117 |
| contracts/tokenomics/LpGauge.sol               |              88 |
| contracts/tokenomics/Minter.sol                |             152 |
| contracts/tokenomics/VestedEscrow.sol          |             134 |
| contracts/tokenomics/VestedEscrowRevocable.sol |              78 |
| contracts/utils/CvxMintAmount.sol              |              21 |
| contracts/utils/Preparable.sol                 |              89 |
| contracts/zaps/PoolMigrationZap.sol            |              42 |
| interfaces/vendor/ICurveSwap.sol               |              44 |
| interfaces/vendor/ICvxLocker.sol               |              42 |
| libraries/UncheckedMath.sol                    |              18 |
