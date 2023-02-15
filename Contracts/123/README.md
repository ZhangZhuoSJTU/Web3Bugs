# Aura Finance contest details

-   $142,500 USDC main award pot
-   $7,500 USDC gas optimization award pot
-   Join [C4 Discord](https://discord.gg/code4rena) to register
-   Submit findings [using the C4 form](https://code4rena.com/contests/2022-05-aura-finance-contest/submit)
-   [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
-   Starts May 11, 2022 13:00 UTC
-   Ends May 25, 2022 12:59 UTC

## What is Aura

Aura Finance is a protocol built on top of the Balancer system to provide maximum incentives to Balancer liquidity providers and BAL stakers (into veBAL) through social aggregation of BAL deposits and Aura’s native token. The Convex system has been adapted to be generic.

Aura is a fork of the well known Convex system. Naming conventions and architecture from the original Convex system have been kept in Curve, so those familiar with their system or repo will have an easier time parsing the functionality.

## Links

-   [Aura Contracts Repo](https://github.com/aurafinance/aura-contracts-lite)
-   [Aura:Convex diff](https://github.com/aurafinance/convex-platform/pull/23/files?file-filters%5B%5D=.sol&show-viewed-files=true&show-deleted-files=true)
-   [Docs](https://docs.aura.finance/)
-   [Original Convex Docs](https://docs.convexfinance.com/convexfinance/)

## Repo

All files in `contracts` and `convex-platform/contracts` are included in this audit competition (excluding `/mocks`)

Contracts specific to Aura or those needing larger changes are in the `contracts`, and modified files from the Convex protocol are in the `convex-platform/` folder. This strategy has been taken to preserve the file formatting to make diff'ing the files easier (view [diff here](https://github.com/aurafinance/convex-platform/pull/23/files?file-filters%5B%5D=.sol&show-viewed-files=true&show-deleted-files=true)). Contracts that are core to the system and flow of user funds remain in the `convex-platform/contracts` subdirectory.

Contracts in `contracts/` are either peripheral (AuraClaimZap, AuraStakingProxy, AuraVestedEscrow, CrvDepositorWrapper, ExtraRewardsDistributor), Aura Specific (Aura, AuraMinter, AuraBalRewardPool, AuraPenaltyForwarder) or those that required bigger changes (in the case of AuraLocker).

original convex code -> new aura versions

-   `convex-platform/.../Cvx.sol` -> `contracts/Aura.sol`
-   `convex-platform/.../BaseRewardPool.sol` -> `contracts/AuraBalRewardPool.sol`
-   `convex-platform/.../ClaimZap.sol` -> `contracts/AuraClaimZap.sol`
-   `convex-platform/.../CvxLocker.sol` -> `contracts/AuraLocker.sol`
-   `convex-platform/.../MerkleDrop.sol` -> `contracts/AuraMerkleDrop.sol`
-   `convex-platform/.../interfaces/BoringMath.sol` -> `contracts/AuraMath.sol`
-   `convex-platform/.../CvxStakingProxy.sol` -> `contracts/AuraStakingProxy.sol`
-   `convex-platform/.../VestedEscrow.sol` -> `contracts/AuraVestedEscrow.sol`
-   `convex-platform/.../vlCvxExtraRewardDistribution.sol` -> `contracts/ExtraRewardsDistributor.sol`

Testing outputs can be found in `test-output.txt` and `fork-test-output.txt`

## Running tests

Run the full test suite:

```
yarn
yarn compile
yarn test
```

Run the fork test suite:

```
yarn
yarn compile
export NODE_URL=<alchemy mainnet archive node URL>
yarn test:fork:all
```

## Diagrams

### Aura Voting

Multisigs will be used for the initial bootstrapping of the project, before things are moved entirely on chain.
The VoterProxy is the contract that holds the veBAL voting power and is the contract that has been whitelisted in the BAL ecosystem.
Voting is currently handled via snapshot. Voting hashes are set on the VoterProxy via the Booster and are then verified with the
EIP-1271 method `verifySignature`.

![Aura Voting](https://user-images.githubusercontent.com/97352567/167505092-07ddbd56-df97-4cd9-802f-d9387c21cf55.jpg)

### Booster Pools (for liquidity providers)

Balancer Pool Tokens (or BPTs) are received for depositing assets into a balancer liquidity pool. These BPTs can be staked in Balancer Gauges to earn
BAL rewards. Depositors are given a "boost" up to 2.5x based on their veBAL balance. To get a veBAL balance, users usually need to lock up
BAL in the Balancer VotingEscrow. In the case of Aura the VoterProxy is the contract which deposits into the Balancer gauges.

Balancer pools are added to the Booster contract via the PoolManagerV3 contract. The PoolManager and PoolManagerProxy(s) perform some checks
on the pool to ensure is is valid. Once added a BaseRewardPool and DepositToken are deployed. Users deposit BPT into the Booster for a target pools
and recieve DepositToken's (auraBPT). They then stake these auraBPT token's in the BaseRewardPool in order to recieve a share of the rewards.
Once deposited in the Booster the BPT is forwarded to the VoterProxy which then deposits then into their related gauge.

Rewards can be harvested by any user by calling `earmarkRewards` and `earmarkFees` on the Booster contract for a specific pool. This then
calls `claimCrv` (claims BAL), `claimRewards` (claims any additional reward tokens registered for the gauge) and `claimFees` (claims pool fees
from the fee distro). The caller of `earmarkRewards` and `earmarkFees` is paid an incentive to do so.

We have made minimal changes to both the Booster and VoterProxy compared to the original Convex code. The minor changes we have made are to support
voting on snapshot with EIP-1271 signatures and a more graceful shutdown/release process for the VoterProxy.

One key difference between Balancer and Curve is that Balancer has multiple fee distro contracts. We have made changes in the Booster contract
`setFeeInfo` function to support this. As we are not getting these distros from a registy we have also added protection in `addPool`.

![Booster Pools Rewards (2)](https://user-images.githubusercontent.com/97352567/168024732-99c1adaf-8a69-4641-8269-e9e51775d89d.jpg)

### auraBAL Rewards

auraBAL is tokenized veBAL. veBAL is recieved by locking 80/20 BAL/ETH BPT into the Balancer VotingEscrow contract.
There are two ways to recieve auraBAL. (1) You can deposit BAL into the `CrvDepositorWrapper` to recieve auraBAL. `CrvDepositorWrapper`
will swap BAL for the BPT by adding single sided liquidity to the 80/20 BAL/ETH pool. (2) you can deposit 80:20-BAL:ETH-BPT into
`CrvDepositor` to recieve auraBAL. The auraBAL can then be staked in the `cvxCrvRewards` contract to recieve rewards.

`earmarkRewards` and `earmarkFees` can be called on the Booster in the same way we describe above (Booster Pools) to distribute rewards
to auraBAL stakers.

### AuraLocker

AURA tokens can be locked in the AuraLocker to recieve vlAURA. vlAURA is voting power in the AURA ecosystem. We have made some major changes
to the original CvxLocker in order to support vote delegation. While vlAURA balances are currently only being used in the snapshot strategies
in future they will be the voting token for our on chain governance. The lock duration is 17 weeks and rewards a distributed in 1 week epochs.

![Aura Rewards (2)](https://user-images.githubusercontent.com/97352567/167840889-3bb23b7a-d2cc-4b90-81c3-8e5ceb555648.jpg)

## Contracts Of Interest

### AuraLocker.sol

Allows for rolling 16 week lockups of AURA for vlAURA, and provides balances available at each epoch (1 week).
Also receives auraBAL from `CvxStakingProxy` and redistributes. Major changes from CvxLocker implementation include addition
of voting delegation.

### AuraBalRewardPool.sol

This is a fork of BaseRewardPool that will have significant rewards during the first two weeks of the system. It will accept auraBAL deposits
and then apply a penalty for those recipients who do not lock up in the AuraLocker. After this bootstrapping period, the incentives will continue natively
to the system and users will need to migrate to the "lockRewards" BaseRewardPool.

### AuraVestedEscrow.sol

A vesting contract for all users. If the admin is 0, then the stream is immutable. All treasury and team vesting will happen through here.

### Booster.sol

Main deposit contract; keeps track of pool info & user deposits; distributes rewards. They say all paths lead to Rome,
and the Booster is no different. This is where it all goes down. It is responsible for tracking all the pools, it
collects rewards from all pools and redirects it. The Booster is owned by the BoosterOwner contract and pools are added by
PoolMangerV3 via PoolManagerProxy(s). No major changes from Convex other than adding support for multiple fee distros.

### VoterProxy.sol

VoterProxy whitelisted in the Balancer SmartWalletWhitelist that participates in Balancer governance. Also handles all deposits
into VotingEscrow and into the gauges. This is the address that has the voting power.

### Aura.sol

The Aura token. Ability to mint additional aura tokens after the inflation period has ended.

### CrvDepositor.sol

Deposit 80:20-BAL:ETH BPT and recieve auraBAL 1:1. BPT is sent to the VoterProxy and locked for the max amount of time in the Balancer
VotingEscrow contract.

### CrvDepositorWrapper.sol

Deposit BAL and recieve auraBAL. This contracts adds single sided BAL liquidity to the 80:20-BAL:ETH pool to recieve BPT and then converts
BPT to auraBAL via CrvDepositor.
