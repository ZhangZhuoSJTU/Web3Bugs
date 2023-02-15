// SPDX-License-Identifier: MIT

pragma solidity ^0.6.11;
pragma experimental ABIEncoderV2;

import "../deps/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "../deps/@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "../deps/@openzeppelin/contracts-upgradeable/math/MathUpgradeable.sol";
import "../deps/@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "../deps/@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";

import "../interfaces/uniswap/IUniswapRouterV2.sol";
import "../interfaces/badger/ISettV3.sol";
import "../interfaces/badger/IController.sol";
import "../interfaces/cvx/ICvxLocker.sol";
import "../interfaces/snapshot/IDelegateRegistry.sol";

import {BaseStrategy} from "../deps/BaseStrategy.sol";

contract MyStrategy is BaseStrategy {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint256;

    uint256 MAX_BPS = 10_000;

    // address public want // Inherited from BaseStrategy, the token the strategy wants, swaps into and tries to grow
    address public lpComponent; // Token we provide liquidity with
    address public reward; // Token we farm and swap to want / lpComponent
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant CVX = 0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B;

    address public constant SUSHI_ROUTER =
        0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;

    IDelegateRegistry public constant SNAPSHOT =
        IDelegateRegistry(0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446);

    // The address this strategies delegates voting to
    address public constant DELEGATE =
        0xB65cef03b9B89f99517643226d76e286ee999e77;

    bytes32 public constant DELEGATED_SPACE =
        0x6376782e65746800000000000000000000000000000000000000000000000000;

    ICvxLocker public LOCKER;

    ISettV3 public CVX_VAULT =
        ISettV3(0x53C8E199eb2Cb7c01543C137078a038937a68E40);

    bool public withdrawalSafetyCheck = true;
    bool public harvestOnRebalance = true;
    // If nothing is unlocked, processExpiredLocks will revert
    bool public processLocksOnReinvest = true;
    bool public processLocksOnRebalance = true;

    event Debug(string name, uint256 value);

    // Used to signal to the Badger Tree that rewards where sent to it
    event TreeDistribution(
        address indexed token,
        uint256 amount,
        uint256 indexed blockNumber,
        uint256 timestamp
    );

    function initialize(
        address _governance,
        address _strategist,
        address _controller,
        address _keeper,
        address _guardian,
        address[3] memory _wantConfig,
        uint256[3] memory _feeConfig,
        address _locker ///@dev TODO: Add this to deploy
    ) public initializer {
        __BaseStrategy_init(
            _governance,
            _strategist,
            _controller,
            _keeper,
            _guardian
        );

        /// @dev Add config here
        want = _wantConfig[0];
        lpComponent = _wantConfig[1];
        reward = _wantConfig[2];

        performanceFeeGovernance = _feeConfig[0];
        performanceFeeStrategist = _feeConfig[1];
        withdrawalFee = _feeConfig[2];

        LOCKER = ICvxLocker(_locker); //TODO: Make locker hardcoded at top of file

        /// @dev do one off approvals here
        // IERC20Upgradeable(want).safeApprove(gauge, type(uint256).max);
        // Permissions for Locker
        IERC20Upgradeable(CVX).safeApprove(_locker, type(uint256).max);
        IERC20Upgradeable(CVX).safeApprove(
            address(CVX_VAULT),
            type(uint256).max
        );

        // Permissions for Sushiswap
        IERC20Upgradeable(reward).safeApprove(SUSHI_ROUTER, type(uint256).max);

        // Delegate voting to DELEGATE
        SNAPSHOT.setDelegate(DELEGATED_SPACE, DELEGATE);
    }

    /// ===== Extra Functions =====
    ///@dev Should we check if the amount requested is more than what we can return on withdrawal?
    function setWithdrawalSafetyCheck(bool newWithdrawalSafetyCheck) public {
        _onlyGovernance();
        withdrawalSafetyCheck = newWithdrawalSafetyCheck;
    }

    ///@dev Should we harvest before doing manual rebalancing
    ///@notice you most likely want to skip harvest if everything is unlocked, or there's something wrong and you just want out
    function setHarvestOnRebalance(bool newHarvestOnRebalance) public {
        _onlyGovernance();
        harvestOnRebalance = newHarvestOnRebalance;
    }

    ///@dev Should we processExpiredLocks during reinvest?
    function setProcessLocksOnReinvest(bool newProcessLocksOnReinvest) public {
        _onlyGovernance();
        processLocksOnReinvest = newProcessLocksOnReinvest;
    }

    ///@dev Should we processExpiredLocks during manualRebalance?
    function setProcessLocksOnRebalance(bool newProcessLocksOnRebalance)
        public
    {
        _onlyGovernance();
        processLocksOnRebalance = newProcessLocksOnRebalance;
    }

    /// ===== View Functions =====

    /// @dev Specify the name of the strategy
    function getName() external pure override returns (string memory) {
        return "veCVX Voting Strategy";
    }

    /// @dev Specify the version of the Strategy, for upgrades
    function version() external pure returns (string memory) {
        return "1.0";
    }

    /// @dev From CVX Token to Helper Vault Token
    function CVXToWant(uint256 cvx) public view returns (uint256) {
        uint256 bCVXToCVX = CVX_VAULT.getPricePerFullShare();
        return cvx.mul(10**18).div(bCVXToCVX);
    }

    /// @dev From Helper Vault Token to CVX Token
    function wantToCVX(uint256 want) public view returns (uint256) {
        uint256 bCVXToCVX = CVX_VAULT.getPricePerFullShare();
        return want.mul(bCVXToCVX).div(10**18);
    }

    /// @dev Balance of want currently held in strategy positions
    function balanceOfPool() public view override returns (uint256) {
        if (withdrawalSafetyCheck) {
            uint256 bCVXToCVX = CVX_VAULT.getPricePerFullShare(); // 18 decimals
            require(bCVXToCVX > 10**18, "Loss Of Peg"); // Avoid trying to redeem for less / loss of peg
        }

        // Return the balance in locker + unlocked but not withdrawn, better estimate to allow some withdrawals
        // then multiply it by the price per share as we need to convert CVX to bCVX
        uint256 valueInLocker =
            CVXToWant(LOCKER.lockedBalanceOf(address(this))).add(
                CVXToWant(IERC20Upgradeable(CVX).balanceOf(address(this)))
            );

        return (valueInLocker);
    }

    /// @dev Returns true if this strategy requires tending
    function isTendable() public view override returns (bool) {
        return false;
    }

    // @dev These are the tokens that cannot be moved except by the vault
    function getProtectedTokens()
        public
        view
        override
        returns (address[] memory)
    {
        address[] memory protectedTokens = new address[](4);
        protectedTokens[0] = want;
        protectedTokens[1] = lpComponent;
        protectedTokens[2] = reward;
        protectedTokens[3] = CVX;
        return protectedTokens;
    }

    /// ===== Permissioned Actions: Governance =====
    /// @notice Delete if you don't need!
    function setKeepReward(uint256 _setKeepReward) external {
        _onlyGovernance();
    }

    /// ===== Internal Core Implementations =====

    /// @dev security check to avoid moving tokens that would cause a rugpull, edit based on strat
    function _onlyNotProtectedTokens(address _asset) internal override {
        address[] memory protectedTokens = getProtectedTokens();

        for (uint256 x = 0; x < protectedTokens.length; x++) {
            require(
                address(protectedTokens[x]) != _asset,
                "Asset is protected"
            );
        }
    }

    /// @dev invest the amount of want
    /// @notice When this function is called, the controller has already sent want to this
    /// @notice Just get the current balance and then invest accordingly
    function _deposit(uint256 _amount) internal override {
        // We receive bCVX -> Convert to bCVX
        CVX_VAULT.withdraw(_amount);

        uint256 toDeposit = IERC20Upgradeable(CVX).balanceOf(address(this));

        // Lock tokens for 17 weeks, send credit to strat, always use max boost cause why not?
        LOCKER.lock(address(this), toDeposit, LOCKER.maximumBoostPayment());
    }

    /// @dev utility function to convert all we can to bCVX
    /// @notice You may want to harvest before calling this to maximize the amount of bCVX you'll have
    function prepareWithdrawAll() external {
        _onlyGovernance();

        LOCKER.processExpiredLocks(false);

        uint256 toDeposit = IERC20Upgradeable(CVX).balanceOf(address(this));
        if (toDeposit > 0) {
            CVX_VAULT.deposit(toDeposit);
        }
    }

    /// @dev utility function to withdraw everything for migration
    /// @dev NOTE: You cannot call this unless you have rebalanced to have only bCVX left in the vault
    function _withdrawAll() internal override {
        //NOTE: This probably will always fail unless we have all tokens expired
        require(
            LOCKER.lockedBalanceOf(address(this)) == 0 &&
                LOCKER.balanceOf(address(this)) == 0,
            "You have to wait for unlock and have to manually rebalance out of it"
        );

        // NO-OP because you can't deposit AND transfer with bCVX
        // See prepareWithdrawAll above
    }

    /// @dev withdraw the specified amount of want, liquidate from lpComponent to want, paying off any necessary debt for the conversion
    function _withdrawSome(uint256 _amount)
        internal
        override
        returns (uint256)
    {
        uint256 max = IERC20Upgradeable(want).balanceOf(address(this));

        if (withdrawalSafetyCheck) {
            uint256 bCVXToCVX = CVX_VAULT.getPricePerFullShare(); // 18 decimals
            require(bCVXToCVX > 10**18, "Loss Of Peg"); // Avoid trying to redeem for less / loss of peg
            require(
                max >= _amount.mul(9_980).div(MAX_BPS),
                "Withdrawal Safety Check"
            ); // 20 BP of slippage
        }

        if (max < _amount) {
            return max;
        }

        return _amount;
    }

    /// @dev Harvest from strategy mechanics, realizing increase in underlying position
    function harvest() public whenNotPaused returns (uint256 harvested) {
        _onlyAuthorizedActors();

        uint256 _before = IERC20Upgradeable(want).balanceOf(address(this));

        uint256 _beforeCVX = IERC20Upgradeable(reward).balanceOf(address(this));

        // Get cvxCRV
        LOCKER.getReward(address(this), false);

        // Rewards Math
        uint256 earnedReward =
            IERC20Upgradeable(reward).balanceOf(address(this)).sub(_beforeCVX);

        // Because we are using bCVX we take fees in reward
        //NOTE: This will probably revert because we deposit and transfer on same block
        (uint256 governancePerformanceFee, uint256 strategistPerformanceFee) =
            _processRewardsFees(earnedReward, reward);

        // Swap cvxCRV for want (bCVX)
        _swapcvxCRVToWant();

        uint256 earned =
            IERC20Upgradeable(want).balanceOf(address(this)).sub(_before);

        /// @dev Harvest event that every strategy MUST have, see BaseStrategy
        emit Harvest(earned, block.number);

        /// @dev Harvest must return the amount of want increased
        return earned;
    }

    /// @dev Rebalance, Compound or Pay off debt here
    function tend() external whenNotPaused {
        _onlyAuthorizedActors();
        revert(); // NOTE: For now tend is replaced by manualRebalance
    }

    /// @dev Swap from reward to CVX, then deposit into bCVX vault
    function _swapcvxCRVToWant() internal {
        uint256 toSwap = IERC20Upgradeable(reward).balanceOf(address(this));

        if (toSwap == 0) {
            return;
        }

        // Sushi reward to WETH to want
        address[] memory path = new address[](3);
        path[0] = reward;
        path[1] = WETH;
        path[2] = CVX;
        IUniswapRouterV2(SUSHI_ROUTER).swapExactTokensForTokens(
            toSwap,
            0,
            path,
            address(this),
            now
        );

        // Deposit into vault
        uint256 toDeposit = IERC20Upgradeable(CVX).balanceOf(address(this));
        if (toDeposit > 0) {
            CVX_VAULT.deposit(toDeposit);
        }
    }

    /// ===== Internal Helper Functions =====

    /// @dev used to manage the governance and strategist fee, make sure to use it to get paid!
    function _processPerformanceFees(uint256 _amount)
        internal
        returns (
            uint256 governancePerformanceFee,
            uint256 strategistPerformanceFee
        )
    {
        governancePerformanceFee = _processFee(
            want,
            _amount,
            performanceFeeGovernance,
            IController(controller).rewards()
        );

        strategistPerformanceFee = _processFee(
            want,
            _amount,
            performanceFeeStrategist,
            strategist
        );
    }

    /// @dev used to manage the governance and strategist fee on earned rewards, make sure to use it to get paid!
    function _processRewardsFees(uint256 _amount, address _token)
        internal
        returns (uint256 governanceRewardsFee, uint256 strategistRewardsFee)
    {
        governanceRewardsFee = _processFee(
            _token,
            _amount,
            performanceFeeGovernance,
            IController(controller).rewards()
        );

        strategistRewardsFee = _processFee(
            _token,
            _amount,
            performanceFeeStrategist,
            strategist
        );
    }

    /// MANUAL FUNCTIONS ///

    /// @dev manual function to reinvest all CVX that was locked
    function reinvest() external whenNotPaused returns (uint256 reinvested) {
        _onlyGovernance();

        if (processLocksOnReinvest) {
            // Withdraw all we can
            LOCKER.processExpiredLocks(false);
        }

        // Redeposit all into veCVX
        uint256 toDeposit = IERC20Upgradeable(CVX).balanceOf(address(this));

        // Redeposit into veCVX
        LOCKER.lock(address(this), toDeposit, LOCKER.maximumBoostPayment());
    }

    /// @dev process all locks, to redeem
    function manualProcessExpiredLocks() external whenNotPaused {
        _onlyGovernance();
        LOCKER.processExpiredLocks(false);
        // Unlock veCVX that is expired and redeem CVX back to this strat
        // Processed in the next harvest or during prepareMigrateAll
    }

    /// @dev Take all CVX and deposits in the CVX_VAULT
    function manualDepositCVXIntoVault() external whenNotPaused {
        _onlyGovernance();

        uint256 toDeposit = IERC20Upgradeable(CVX).balanceOf(address(this));
        if (toDeposit > 0) {
            CVX_VAULT.deposit(toDeposit);
        }
    }

    /// @dev Send all available bCVX to the Vault
    /// @notice you can do this so you can earn again (re-lock), or just to add to the redemption pool
    function manualSendbCVXToVault() external whenNotPaused {
        _onlyGovernance();
        uint256 bCvxAmount = IERC20Upgradeable(want).balanceOf(address(this));
        _transferToVault(bCvxAmount);
    }

    /// @dev use the currently available CVX to either lock or add to bCVX
    /// @notice toLock = 0, lock nothing, deposit in bCVX as much as you can
    /// @notice toLock = 100, lock everything (CVX) you have
    function manualRebalance(uint256 toLock) external whenNotPaused {
        _onlyGovernance();
        require(toLock <= MAX_BPS, "Max is 100%");

        if (processLocksOnRebalance) {
            // manualRebalance will revert if you have no expired locks
            LOCKER.processExpiredLocks(false);
        }

        if (harvestOnRebalance) {
            harvest();
        }

        // Token that is highly liquid
        uint256 balanceOfWant =
            IERC20Upgradeable(want).balanceOf(address(this));
        // CVX uninvested we got from harvest and unlocks
        uint256 balanceOfCVX = IERC20Upgradeable(CVX).balanceOf(address(this));
        // Locked CVX in the locker
        uint256 balanceInLock = LOCKER.balanceOf(address(this));
        uint256 totalCVXBalance =
            balanceOfCVX.add(balanceInLock).add(wantToCVX(balanceOfWant));

        //Ratios
        uint256 currentLockRatio =
            balanceInLock.mul(10**18).div(totalCVXBalance);
        // Amount we want to have in lock
        uint256 newLockRatio = totalCVXBalance.mul(toLock).div(MAX_BPS);
        // Amount we want to have in bCVX
        uint256 toWantRatio =
            totalCVXBalance.mul(MAX_BPS.sub(toLock)).div(MAX_BPS);

        // We can't unlock enough, just deposit rest into bCVX
        if (newLockRatio <= currentLockRatio) {
            // Deposit into vault
            uint256 toDeposit = IERC20Upgradeable(CVX).balanceOf(address(this));
            if (toDeposit > 0) {
                CVX_VAULT.deposit(toDeposit);
            }

            return;
        }

        // If we're continuing, then we are going to lock something (unless it's zero)
        uint256 cvxToLock = newLockRatio.sub(currentLockRatio);

        // NOTE: We only lock the CVX we have and not the bCVX
        // bCVX should be sent back to vault and then go through earn
        // We do this because bCVX has "blockLock" and we can't both deposit and withdraw on the same block
        uint256 maxCVX = IERC20Upgradeable(CVX).balanceOf(address(this));
        if (cvxToLock > maxCVX) {
            // Just lock what we can
            LOCKER.lock(address(this), maxCVX, LOCKER.maximumBoostPayment());
        } else {
            // Lock proper
            LOCKER.lock(address(this), cvxToLock, LOCKER.maximumBoostPayment());
        }

        // If anything else is left, deposit into vault
        uint256 cvxLeft = IERC20Upgradeable(CVX).balanceOf(address(this));
        if (cvxLeft > 0) {
            CVX_VAULT.deposit(cvxLeft);
        }
        // At the end of the rebalance, there won't be any balanceOfCVX as that token is not considered by our strat
    }
}
