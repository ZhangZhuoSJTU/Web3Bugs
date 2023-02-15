// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import {IERC20Upgradeable} from "openzeppelin-contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {AddressUpgradeable} from "openzeppelin-contracts-upgradeable/utils/AddressUpgradeable.sol";
import {SafeERC20Upgradeable} from "openzeppelin-contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {ERC20Upgradeable} from "openzeppelin-contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {PausableUpgradeable} from "openzeppelin-contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "openzeppelin-contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./lib/SettAccessControl.sol";

import {IVault} from "./interfaces/badger/IVault.sol";
import {IVesting} from "./interfaces/citadel/IVesting.sol";
import {IStrategy} from "./interfaces/badger/IStrategy.sol";
import {IERC20} from "./interfaces/erc20/IERC20.sol";
import {IBadgerGuestlist} from "./interfaces/badger/IBadgerGuestlist.sol";

/*
    Source: https://github.com/iearn-finance/yearn-protocol/blob/develop/contracts/vaults/yVault.sol
    
    Changelog:

    V1.1
    * Strategist no longer has special function calling permissions
    * Version function added to contract
    * All write functions, with the exception of transfer, are pausable
    * Keeper or governance can pause
    * Only governance can unpause

    V1.2
    * Transfer functions are now pausable along with all other non-permissioned write functions
    * All permissioned write functions, with the exception of pause() & unpause(), are pausable as well

    V1.3
    * Add guest list functionality
    * All deposits can be optionally gated by external guestList approval logic on set guestList contract

    V1.4
    * Add depositFor() to deposit on the half of other users. That user will then be blockLocked.

    V1.5
    * Removed Controller
        - Removed harvest from vault (only on strategy)
    * Params added to track autocompounded rewards (lifeTimeEarned, lastHarvestedAt, lastHarvestAmount, assetsAtLastHarvest)
      this would work in sync with autoCompoundRatio to help us track harvests better.
    * Fees
        - Strategy would report the autocompounded harvest amount to the vault
        - Calculation performanceFeeGovernance, performanceFeeStrategist, withdrawalFee, managementFee moved to the vault.
        - Vault mints shares for performanceFees and managementFee to the respective recipient (treasury, strategist)
        - withdrawal fees is transferred to the rewards address set
    * Permission:
        - Strategist can now set performance, withdrawal and management fees
        - Governance will determine maxPerformanceFee, maxWithdrawalFee, maxManagementFee that can be set to prevent rug of funds.
    * Strategy would take the actors from the vault it is connected to
    * All governance related fees goes to treasury
*/

contract StakedCitadel is
    ERC20Upgradeable,
    SettAccessControl,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;

    uint256 constant ONE_ETH = 1e18;

    /// ===== Storage Variables ====

    IERC20Upgradeable public token; // Token used for deposits
    IBadgerGuestlist public guestList; // guestlist when vault is in experiment/ guarded state

    bool public pausedDeposit; // false by default Allows to only block deposits, use pause for the normal pause state

    address public strategy; // address of the strategy connected to the vault
    address public guardian; // guardian of vault and strategy
    address public treasury; // set by governance ... any fees go there

    address public badgerTree; // Address we send tokens too via reportAdditionalTokens
    address public vesting; // Address of the vesting contract where after withdrawal we send CTDL to vest for 21 days

    /// @dev name and symbol prefixes for lpcomponent token of vault
    string internal constant _defaultNamePrefix = "Staked ";
    string internal constant _symbolSymbolPrefix = "x";

    /// Params to track autocompounded rewards
    uint256 public lifeTimeEarned; // keeps track of total earnings
    uint256 public lastHarvestedAt; // timestamp of the last harvest
    uint256 public lastHarvestAmount; // amount harvested during last harvest
    uint256 public assetsAtLastHarvest; // assets for which the harvest took place.

    mapping(address => uint256) public additionalTokensEarned;
    mapping(address => uint256) public lastAdditionalTokenAmount;

    /// Fees ///
    /// @notice all fees will be in bps
    uint256 public performanceFeeGovernance; // Perf fee sent to `treasury`
    uint256 public performanceFeeStrategist; // Perf fee sent to `strategist`
    uint256 public withdrawalFee; // fee issued to `treasury` on withdrawal
    uint256 public managementFee; // fee issued to `treasury` on report (typically on harvest, but only if strat is autocompounding)

    uint256 public maxPerformanceFee; // maximum allowed performance fees
    uint256 public maxWithdrawalFee; // maximum allowed withdrawal fees
    uint256 public maxManagementFee; // maximum allowed management fees

    uint256 public toEarnBps; // NOTE: in BPS, minimum amount of token to deposit into strategy when earn is called

    /// ===== Constants ====

    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant SECS_PER_YEAR = 31_556_952; // 365.2425 days

    uint256 public constant WITHDRAWAL_FEE_HARD_CAP = 200; // Never higher than 2%
    uint256 public constant PERFORMANCE_FEE_HARD_CAP = 3_000; // Never higher than 30% // 30% maximum performance fee // We usually do 20, so this is insanely high already
    uint256 public constant MANAGEMENT_FEE_HARD_CAP = 200; // Never higher than 2%

    /// ===== Events ====

    // Emitted when a token is sent to the badgerTree for emissions
    event TreeDistribution(
        address indexed token,
        uint256 amount,
        uint256 indexed blockNumber,
        uint256 timestamp
    );

    // Emitted during a report, when there has been an increase in pricePerFullShare (ppfs)
    event Harvested(
        address indexed token,
        uint256 amount,
        uint256 indexed blockNumber,
        uint256 timestamp
    );

    event SetTreasury(address indexed newTreasury);
    event SetStrategy(address indexed newStrategy);
    event SetToEarnBps(uint256 newEarnToBps);
    event SetMaxWithdrawalFee(uint256 newMaxWithdrawalFee);
    event SetMaxPerformanceFee(uint256 newMaxPerformanceFee);
    event SetMaxManagementFee(uint256 newMaxManagementFee);
    event SetGuardian(address indexed newGuardian);
    event SetVesting(address indexed newVesting);
    event SetGuestList(address indexed newGuestList);
    event SetWithdrawalFee(uint256 newWithdrawalFee);
    event SetPerformanceFeeStrategist(uint256 newPerformanceFeeStrategist);
    event SetPerformanceFeeGovernance(uint256 newPerformanceFeeGovernance);
    event SetManagementFee(uint256 newManagementFee);

    event PauseDeposits(address indexed pausedBy);
    event UnpauseDeposits(address indexed pausedBy);

    /// @notice Initializes the Sett. Can only be called once, ideally when the contract is deployed.
    /// @param _token Address of the token that can be deposited into the sett.
    /// @param _governance Address authorized as governance.
    /// @param _keeper Address authorized as keeper.
    /// @param _guardian Address authorized as guardian.
    /// @param _treasury Address to distribute governance fees/rewards to.
    /// @param _strategist Address authorized as strategist.
    /// @param _badgerTree Address of badgerTree used for emissions.
    /// @param _name Specify a custom sett name. Leave empty for default value.
    /// @param _symbol Specify a custom sett symbol. Leave empty for default value.
    /// @param _feeConfig Values for the 4 different types of fees charges by the sett
    ///         [performanceFeeGovernance, performanceFeeStrategist, withdrawToVault, managementFee]
    ///         Each fee should be less than the constant hard-caps defined above.
    function initialize(
        address _token,
        address _governance,
        address _keeper,
        address _guardian,
        address _treasury,
        address _strategist,
        address _badgerTree,
        address _vesting,
        string memory _name,
        string memory _symbol,
        uint256[4] memory _feeConfig
    ) public initializer whenNotPaused {
        require(_token != address(0)); // dev: _token address should not be zero
        require(_governance != address(0)); // dev: _governance address should not be zero
        require(_keeper != address(0)); // dev: _keeper address should not be zero
        require(_guardian != address(0)); // dev: _guardian address should not be zero
        require(_treasury != address(0)); // dev: _treasury address should not be zero
        require(_strategist != address(0)); // dev: _strategist address should not be zero
        require(_badgerTree != address(0)); // dev: _badgerTree address should not be zero
        require(_vesting != address(0)); // dev: _vesting address should not be zero

        // Check for fees being reasonable (see below for interpretation)
        require(
            _feeConfig[0] <= PERFORMANCE_FEE_HARD_CAP,
            "performanceFeeGovernance too high"
        );
        require(
            _feeConfig[1] <= PERFORMANCE_FEE_HARD_CAP,
            "performanceFeeStrategist too high"
        );
        require(
            _feeConfig[2] <= WITHDRAWAL_FEE_HARD_CAP,
            "withdrawalFee too high"
        );
        require(
            _feeConfig[3] <= MANAGEMENT_FEE_HARD_CAP,
            "managementFee too high"
        );

        string memory name;
        string memory symbol;

        // If they are non empty string we'll use the custom names
        // Else just add the default prefix
        IERC20 namedToken = IERC20(_token);

        if (keccak256(abi.encodePacked(_name)) != keccak256("")) {
            name = _name;
        } else {
            name = string(
                abi.encodePacked(_defaultNamePrefix, namedToken.name())
            );
        }

        if (keccak256(abi.encodePacked(_symbol)) != keccak256("")) {
            symbol = _symbol;
        } else {
            symbol = string(
                abi.encodePacked(_symbolSymbolPrefix, namedToken.symbol())
            );
        }

        // Initializing the lpcomponent token
        __ERC20_init(name, symbol);
        // Initialize the other contracts
        __Pausable_init();
        __ReentrancyGuard_init();

        token = IERC20Upgradeable(_token);
        governance = _governance;
        treasury = _treasury;
        strategist = _strategist;
        keeper = _keeper;
        guardian = _guardian;
        badgerTree = _badgerTree;
        vesting = _vesting;

        lastHarvestedAt = block.timestamp; // setting initial value to the time when the vault was deployed

        performanceFeeGovernance = _feeConfig[0];
        performanceFeeStrategist = _feeConfig[1];
        withdrawalFee = _feeConfig[2];
        managementFee = _feeConfig[3];
        maxPerformanceFee = PERFORMANCE_FEE_HARD_CAP; // 30% max performance fee
        maxWithdrawalFee = WITHDRAWAL_FEE_HARD_CAP; // 2% maximum withdrawal fee
        maxManagementFee = MANAGEMENT_FEE_HARD_CAP; // 2% maximum management fee

        toEarnBps = 9_500; // initial value of toEarnBps // 95% is invested to the strategy, 5% for cheap withdrawals
    }

    /// ===== Modifiers ====

    /// @notice Checks whether a call is from guardian or governance.
    function _onlyAuthorizedPausers() internal view {
        require(
            msg.sender == guardian || msg.sender == governance,
            "onlyPausers"
        );
    }

    /// @notice Checks whether a call is from the strategy.
    function _onlyStrategy() internal view {
        require(msg.sender == strategy, "onlyStrategy");
    }

    /// ===== View Functions =====

    /// @notice Used to track the deployed version of the contract.
    /// @return Current version of the contract.
    function version() external pure returns (string memory) {
        return "1.5";
    }

    /// @notice Gives the price for a single Sett share.
    /// @dev Sett starts with a price per share of 1.
    /// @return Value of a single share.
    function getPricePerFullShare() public view returns (uint256) {
        if (totalSupply() == 0) {
            return ONE_ETH;
        }
        return (balance() * ONE_ETH) / totalSupply();
    }

    /// @notice Gives the total balance of the underlying token within the sett and strategy system.
    /// @return Balance of token handled by the sett.
    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Defines how much of the Setts' underlying is available for strategy to borrow.
    /// @return Amount of tokens that the sett can provide to the strategy.
    function available() public view returns (uint256) {
        return (token.balanceOf(address(this)) * toEarnBps) / MAX_BPS;
    }

    /// ===== Public Actions =====

    /// @notice Deposits `_amount` tokens, issuing shares.
    ///         Note that deposits are not accepted when the Sett is paused or when `pausedDeposit` is true.
    /// @dev See `_depositFor` for details on how deposit is implemented.
    /// @param _amount Quantity of tokens to deposit.
    function deposit(uint256 _amount) external whenNotPaused {
        _depositWithAuthorization(_amount, new bytes32[](0));
    }

    /// @notice Deposits `_amount` tokens, issuing shares.
    ///         Checks the guestlist to verify that the calling account is authorized to make a deposit for the specified `_amount`.
    ///         Note that deposits are not accepted when the Sett is paused or when `pausedDeposit` is true.
    /// @dev See `_depositForWithAuthorization` for details on guestlist authorization.
    /// @param _amount Quantity of tokens to deposit.
    /// @param proof Merkle proof to validate in the guestlist.
    function deposit(uint256 _amount, bytes32[] memory proof)
        external
        whenNotPaused
    {
        _depositWithAuthorization(_amount, proof);
    }

    /// @notice Deposits all tokens, issuing shares.
    ///         Note that deposits are not accepted when the Sett is paused or when `pausedDeposit` is true.
    /// @dev See `_depositFor` for details on how deposit is implemented.
    function depositAll() external whenNotPaused {
        _depositWithAuthorization(
            token.balanceOf(msg.sender),
            new bytes32[](0)
        );
    }

    /// @notice Deposits all tokens, issuing shares.
    ///         Checks the guestlist to verify that the calling is authorized to make a full deposit.
    ///         Note that deposits are not accepted when the Sett is paused or when `pausedDeposit` is true.
    /// @dev See `_depositForWithAuthorization` for details on guestlist authorization.
    /// @param proof Merkle proof to validate in the guestlist.
    function depositAll(bytes32[] memory proof) external whenNotPaused {
        _depositWithAuthorization(token.balanceOf(msg.sender), proof);
    }

    /// @notice Deposits `_amount` tokens, issuing shares to `recipient`.
    ///         Note that deposits are not accepted when the Sett is paused or when `pausedDeposit` is true.
    /// @dev See `_depositFor` for details on how deposit is implemented.
    /// @param _recipient Address to issue the Sett shares to.
    /// @param _amount Quantity of tokens to deposit.
    function depositFor(address _recipient, uint256 _amount)
        external
        whenNotPaused
    {
        _depositForWithAuthorization(_recipient, _amount, new bytes32[](0));
    }

    /// @notice Deposits `_amount` tokens, issuing shares to `recipient`.
    ///         Checks the guestlist to verify that `recipient` is authorized to make a deposit for the specified `_amount`.
    ///         Note that deposits are not accepted when the Sett is paused or when `pausedDeposit` is true.
    /// @dev See `_depositForWithAuthorization` for details on guestlist authorization.
    /// @param _recipient Address to issue the Sett shares to.
    /// @param _amount Quantity of tokens to deposit.
    function depositFor(
        address _recipient,
        uint256 _amount,
        bytes32[] memory proof
    ) external whenNotPaused {
        _depositForWithAuthorization(_recipient, _amount, proof);
    }

    /// @notice Redeems `_shares` for an appropriate amount of tokens.
    ///         Note that withdrawals are not processed when the Sett is paused.
    /// @dev See `_withdraw` for details on how withdrawals are processed.
    /// @param _shares Quantity of shares to redeem.
    function withdraw(uint256 _shares) external whenNotPaused {
        _withdraw(_shares);
    }

    /// @notice Redeems all shares, issuing an appropriate amount of tokens.
    ///         Note that withdrawals are not processed when the Sett is paused.
    /// @dev See `_withdraw` for details on how withdrawals are processed.
    function withdrawAll() external whenNotPaused {
        _withdraw(balanceOf(msg.sender));
    }

    /// ===== Permissioned Actions: Strategy =====

    /// @notice Used by the strategy to report a harvest to the sett.
    ///         Issues shares for the strategist and treasury based on the performance fees and harvested amount.
    ///         Issues shares for the treasury based on the management fee and the time elapsed since last harvest.
    ///         Updates harvest variables for on-chain APR tracking.
    ///         This can only be called by the strategy.
    /// @dev This implicitly trusts that the strategy reports the correct amount.
    ///      Pausing on this function happens at the strategy level.
    /// @param _harvestedAmount Amount of underlying token harvested by the strategy.
    function reportHarvest(uint256 _harvestedAmount) external nonReentrant {
        _onlyStrategy();

        uint256 harvestTime = block.timestamp;
        uint256 assetsAtHarvest = balance() - _harvestedAmount; // Must be less than or equal or revert

        _handleFees(_harvestedAmount, harvestTime);

        // Updated lastHarvestAmount
        lastHarvestAmount = _harvestedAmount;

        // if we withdrawAll
        // we will have some yield left
        // having 0 for assets will inflate APY
        // Instead, have the last harvest report with the previous assets
        // And if you end up harvesting again, that report will have both 0s
        if (assetsAtHarvest != 0) {
            assetsAtLastHarvest = assetsAtHarvest;
        } else if (_harvestedAmount == 0) {
            // If zero
            assetsAtLastHarvest = 0;
        }

        lifeTimeEarned = lifeTimeEarned + _harvestedAmount;
        // Update time either way
        lastHarvestedAt = harvestTime;

        emit Harvested(
            address(token),
            _harvestedAmount,
            block.number,
            block.timestamp
        );
    }

    /// @notice Used by the strategy to report harvest of additional tokens to the sett.
    ///         Charges performance fees on the additional tokens and transfers fees to treasury and strategist.
    ///         The remaining amount is sent to badgerTree for emissions.
    ///         Updates harvest variables for on-chain APR tracking.
    ///         This can only be called by the strategy.
    /// @dev This function is called after the strategy sends the additional tokens to the sett.
    ///      Pausing on this function happens at the strategy level.
    /// @param _token Address of additional token harvested by the strategy.
    function reportAdditionalToken(address _token) external nonReentrant {
        _onlyStrategy();
        require(address(token) != _token, "No want");
        uint256 tokenBalance = IERC20Upgradeable(_token).balanceOf(
            address(this)
        );

        additionalTokensEarned[_token] =
            additionalTokensEarned[_token] +
            tokenBalance;
        lastAdditionalTokenAmount[_token] = tokenBalance;

        // We may have more, but we still report only what the strat sent
        uint256 governanceRewardsFee = _calculateFee(
            tokenBalance,
            performanceFeeGovernance
        );
        uint256 strategistRewardsFee = _calculateFee(
            tokenBalance,
            performanceFeeStrategist
        );

        IERC20Upgradeable(_token).safeTransfer(treasury, governanceRewardsFee);
        IERC20Upgradeable(_token).safeTransfer(
            strategist,
            strategistRewardsFee
        );

        // Send rest to tree
        uint256 newBalance = IERC20Upgradeable(_token).balanceOf(address(this));
        IERC20Upgradeable(_token).safeTransfer(badgerTree, newBalance);
        emit TreeDistribution(
            _token,
            newBalance,
            block.number,
            block.timestamp
        );
    }

    /// ===== Permissioned Actions: Governance =====

    /// @notice Changes the treasury address.
    ///         Treasury is recipient of management and governance performance fees.
    ///         This can only be called by governance.
    ///         Note that this can only be called when sett is not paused.
    /// @param _treasury Address of the new treasury.
    function setTreasury(address _treasury) external whenNotPaused {
        _onlyGovernance();
        require(_treasury != address(0), "Address 0");

        treasury = _treasury;
        emit SetTreasury(_treasury);
    }

    /// @notice Changes the strategy address.
    ///         This can only be called by governance.
    ///         Note that this can only be called when sett is not paused.
    /// @dev This is a rug vector, pay extremely close attention to the next strategy being set.
    ///      Changing the strategy should happen only via timelock.
    ///      This function must not be callable when the sett is paused as this would force depositors into a strategy they may not want to use.
    /// @param _strategy Address of new strategy.
    function setStrategy(address _strategy) external whenNotPaused {
        _onlyGovernance();
        require(_strategy != address(0), "Address 0");

        /// NOTE: Migrate funds if settings strategy when already existing one
        if (strategy != address(0)) {
            require(
                IStrategy(strategy).balanceOf() == 0,
                "Please withdrawToVault before changing strat"
            );
        }
        strategy = _strategy;
        emit SetStrategy(_strategy);
    }

    // === Setters that can be called by governance even when paused ===

    /// @notice Sets the max withdrawal fee that can be charged by the Sett.
    ///         This can only be called by governance.
    /// @dev The input `_fees` should be less than the `WITHDRAWAL_FEE_HARD_CAP` hard-cap.
    /// @param _fees The new maximum cap for withdrawal fee.
    function setMaxWithdrawalFee(uint256 _fees) external {
        _onlyGovernance();
        require(_fees <= WITHDRAWAL_FEE_HARD_CAP, "withdrawalFee too high");

        maxWithdrawalFee = _fees;
        emit SetMaxWithdrawalFee(_fees);
    }

    /// @notice Sets the max performance fee that can be charged by the Sett.
    ///         This can only be called by governance.
    /// @dev The input `_fees` should be less than the `PERFORMANCE_FEE_HARD_CAP` hard-cap.
    /// @param _fees The new maximum cap for performance fee.
    function setMaxPerformanceFee(uint256 _fees) external {
        _onlyGovernance();
        require(
            _fees <= PERFORMANCE_FEE_HARD_CAP,
            "performanceFeeStrategist too high"
        );

        maxPerformanceFee = _fees;
        emit SetMaxPerformanceFee(_fees);
    }

    /// @notice Sets the max management fee that can be charged by the Sett.
    ///         This can only be called by governance.
    /// @dev The input `_fees` should be less than the `MANAGEMENT_FEE_HARD_CAP` hard-cap.
    /// @param _fees The new maximum cap for management fee.
    function setMaxManagementFee(uint256 _fees) external {
        _onlyGovernance();
        require(_fees <= MANAGEMENT_FEE_HARD_CAP, "managementFee too high");

        maxManagementFee = _fees;
        emit SetMaxManagementFee(_fees);
    }

    /// @notice Changes the guardian address.
    ///         Guardian is an authorized actor that can pause the sett in case of an emergency.
    ///         This can only be called by governance.
    /// @param _guardian Address of the new guardian.
    function setGuardian(address _guardian) external {
        _onlyGovernance();
        require(_guardian != address(0), "Address cannot be 0x0");

        guardian = _guardian;
        emit SetGuardian(_guardian);
    }

    /// @notice Changes the vesting contract address.
    ///         Vesting contract is used to vest withdrawn tokens linearly over period of 21 days
    ///         This can only be called by governance.
    /// @param _vesting Address of the new guardian.
    function setVesting(address _vesting) external {
        _onlyGovernance();
        require(_vesting != address(0), "Address cannot be 0x0");

        vesting = _vesting;
        emit SetVesting(_vesting);
    }

    /// ===== Permissioned Functions: Trusted Actors =====

    /// @notice Sets the fraction of sett balance (in basis points) that the strategy can borrow.
    ///         This can be called by either governance or strategist.
    ///         Note that this can only be called when the sett is not paused.
    /// @param _newToEarnBps The new maximum cap for management fee.
    function setToEarnBps(uint256 _newToEarnBps) external whenNotPaused {
        _onlyGovernanceOrStrategist();
        require(_newToEarnBps <= MAX_BPS, "toEarnBps should be <= MAX_BPS");

        toEarnBps = _newToEarnBps;
        emit SetToEarnBps(_newToEarnBps);
    }

    /// @notice Changes the guestlist address.
    ///         The guestList is used to gate or limit deposits. If no guestlist is set then anyone can deposit any amount.
    ///         This can be called by either governance or strategist.
    ///         Note that this can only be called when the sett is not paused.
    /// @param _guestList Address of the new guestlist.
    function setGuestList(address _guestList) external whenNotPaused {
        _onlyGovernanceOrStrategist();
        guestList = IBadgerGuestlist(_guestList);
        emit SetGuestList(_guestList);
    }

    /// @notice Sets the withdrawal fee charged by the Sett.
    ///         The fee is taken at the time of withdrawals in the underlying token which is then used to issue new shares for the treasury.
    ///         The new withdrawal fee should be less than `maxWithdrawalFee`.
    ///         This can be called by either governance or strategist.
    /// @dev See `_withdraw` to see how withdrawal fee is charged.
    /// @param _withdrawalFee The new withdrawal fee.
    function setWithdrawalFee(uint256 _withdrawalFee) external whenNotPaused {
        _onlyGovernanceOrStrategist();
        require(_withdrawalFee <= maxWithdrawalFee, "Excessive withdrawal fee");
        withdrawalFee = _withdrawalFee;
        emit SetWithdrawalFee(_withdrawalFee);
    }

    /// @notice Sets the performance fee taken by the strategist on the harvests.
    ///         The fee is taken at the time of harvest reporting for both the underlying token and additional tokens.
    ///         For the underlying token, the fee is used to issue new shares for the strategist.
    ///         The new performance fee should be less than `maxPerformanceFee`.
    ///         This can be called by either governance or strategist.
    /// @dev See `reportHarvest` and `reportAdditionalToken` to see how performance fees are charged.
    /// @param _performanceFeeStrategist The new performance fee.
    function setPerformanceFeeStrategist(uint256 _performanceFeeStrategist)
        external
        whenNotPaused
    {
        _onlyGovernanceOrStrategist();
        require(
            _performanceFeeStrategist <= maxPerformanceFee,
            "Excessive strategist performance fee"
        );
        performanceFeeStrategist = _performanceFeeStrategist;
        emit SetPerformanceFeeStrategist(_performanceFeeStrategist);
    }

    /// @notice Sets the performance fee taken by the treasury on the harvests.
    ///         The fee is taken at the time of harvest reporting for both the underlying token and additional tokens.
    ///         For the underlying token, the fee is used to issue new shares for the treasury.
    ///         The new performance fee should be less than `maxPerformanceFee`.
    ///         This can be called by either governance or strategist.
    /// @dev See `reportHarvest` and `reportAdditionalToken` to see how performance fees are charged.
    /// @param _performanceFeeGovernance The new performance fee.
    function setPerformanceFeeGovernance(uint256 _performanceFeeGovernance)
        external
        whenNotPaused
    {
        _onlyGovernanceOrStrategist();
        require(
            _performanceFeeGovernance <= maxPerformanceFee,
            "Excessive governance performance fee"
        );
        performanceFeeGovernance = _performanceFeeGovernance;
        emit SetPerformanceFeeGovernance(_performanceFeeGovernance);
    }

    /// @notice Sets the management fee taken by the treasury on the AUM in the sett.
    ///         The fee is calculated at the time of `reportHarvest` and is used to issue new shares for the treasury.
    ///         The new management fee should be less than `maxManagementFee`.
    ///         This can be called by either governance or strategist.
    /// @dev See `_handleFees` to see how the management fee is calculated.
    /// @param _fees The new management fee.
    function setManagementFee(uint256 _fees) external whenNotPaused {
        _onlyGovernanceOrStrategist();
        require(_fees <= maxManagementFee, "Excessive management fee");
        managementFee = _fees;
        emit SetManagementFee(_fees);
    }

    /// === Strategist level operations that can be done even when paused ==

    /// @notice Withdraws all funds from the strategy back to the sett.
    ///         This can be called by either governance or strategist.
    /// @dev This calls `_withdrawAll` on the strategy and transfers the balance to the sett.
    function withdrawToVault() external {
        _onlyGovernanceOrStrategist();
        IStrategy(strategy).withdrawToVault();
    }

    /// @notice Sends balance of any extra token earned by the strategy (from airdrops, donations etc.)
    ///         to the badgerTree for emissions.
    ///         The `_token` should be different from any tokens managed by the strategy.
    ///         This can only be called by either strategist or governance.
    /// @dev See `BaseStrategy.emitNonProtectedToken` for details.
    /// @param _token Address of the token to be emitted.
    function emitNonProtectedToken(address _token) external {
        _onlyGovernanceOrStrategist();

        IStrategy(strategy).emitNonProtectedToken(_token);
    }

    /// @notice Sweeps the balance of an extra token from the vault and strategy and sends it to governance.
    ///         The `_token` should be different from any tokens managed by the strategy.
    ///         This can only be called by either strategist or governance.
    /// @dev Sweeping doesn't take any fee.
    /// @param _token Address of the token to be swept.
    function sweepExtraToken(address _token) external {
        _onlyGovernanceOrStrategist();
        require(address(token) != _token, "No want");

        IStrategy(strategy).withdrawOther(_token);
        // Send all `_token` we have
        // Safe because `withdrawOther` will revert on protected tokens
        // Done this way works for both a donation to strategy or to vault
        IERC20Upgradeable(_token).safeTransfer(
            governance,
            IERC20Upgradeable(_token).balanceOf(address(this))
        );
    }

    /// @notice Deposits the available balance of the underlying token into the strategy.
    ///         The strategy then uses the amount for yield-generating activities.
    ///         This can be called by either the keeper or governance.
    ///         Note that earn cannot be called when deposits are paused.
    /// @dev Pause is enforced at the Strategy level (this allows to still earn yield when the Vault is paused)
    function earn() external {
        require(!pausedDeposit, "pausedDeposit"); // dev: deposits are paused, we don't earn as well
        _onlyAuthorizedActors();

        uint256 _bal = available();
        token.safeTransfer(strategy, _bal);
        IStrategy(strategy).earn();
    }

    /// @notice Pauses only deposits.
    ///         This can be called by either guardian or governance.
    function pauseDeposits() external {
        _onlyAuthorizedPausers();
        pausedDeposit = true;
        emit PauseDeposits(msg.sender);
    }

    /// @notice Unpauses deposits.
    ///         This can only be called by governance.
    function unpauseDeposits() external {
        _onlyGovernance();
        pausedDeposit = false;
        emit UnpauseDeposits(msg.sender);
    }

    /// @notice Pauses everything.
    ///         This can be called by either guardian or governance.
    function pause() external {
        _onlyAuthorizedPausers();
        _pause();
    }

    /// @notice Unpauses everything
    ///         This can only be called by governance.
    function unpause() external {
        _onlyGovernance();
        _unpause();
    }

    /// ===== Internal Implementations =====

    /// @notice Deposits `_amount` tokens, issuing shares to `recipient`.
    ///         Note that deposits are not accepted when `pausedDeposit` is true.
    /// @dev This is the actual deposit operation.
    ///      Deposits are based on the realized value of underlying assets between Sett & associated Strategy
    /// @param _recipient Address to issue the Sett shares to.
    /// @param _amount Quantity of tokens to deposit.
    function _depositFor(address _recipient, uint256 _amount)
        internal
        nonReentrant
    {
        require(_recipient != address(0), "Address 0");
        require(_amount != 0, "Amount 0");
        require(!pausedDeposit, "pausedDeposit"); // dev: deposits are paused

        uint256 _pool = balance();
        uint256 _before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = token.balanceOf(address(this));
        _mintSharesFor(_recipient, _after - _before, _pool);
    }

    /// @dev See `_depositWithAuthorization`
    function _depositWithAuthorization(uint256 _amount, bytes32[] memory proof)
        internal
    {
        _depositForWithAuthorization(msg.sender, _amount, proof);
    }

    /// @dev Verifies that `_recipient` is authorized to deposit `_amount` based on the guestlist.
    ///      See `_depositFor` for deposit details.
    function _depositForWithAuthorization(
        address _recipient,
        uint256 _amount,
        bytes32[] memory proof
    ) internal {
        if (address(guestList) != address(0)) {
            require(
                guestList.authorized(_recipient, _amount, proof),
                "GuestList: Not Authorized"
            );
        }
        _depositFor(_recipient, _amount);
    }

    /// @notice Redeems `_shares` for an appropriate amount of tokens.
    /// @dev This is the actual withdraw operation.
    ///      Withdraws from strategy positions if sett doesn't contain enough tokens to process the withdrawal.
    ///      Calculates withdrawal fees and issues corresponding shares to treasury.
    ///      No rebalance implementation for lower fees and faster swaps
    /// @param _shares Quantity of shares to redeem.
    function _withdraw(uint256 _shares) internal nonReentrant {
        require(_shares != 0, "0 Shares");

        uint256 r = (balance() * _shares) / totalSupply();
        _burn(msg.sender, _shares);

        // Check balance
        uint256 b = token.balanceOf(address(this));
        if (b < r) {
            uint256 _toWithdraw = r - b;
            IStrategy(strategy).withdraw(_toWithdraw);
            uint256 _after = token.balanceOf(address(this));
            uint256 _diff = _after - b;
            if (_diff < _toWithdraw) {
                r = b + _diff;
            }
        }

        uint256 _fee = _calculateFee(r, withdrawalFee);
        uint256 _amount = r - _fee;

        // Send funds to vesting contract and setup vesting
        IVesting(vesting).setupVesting(msg.sender, _amount, block.timestamp);
        token.safeTransfer(vesting, _amount);

        // After you burned the shares, and you have sent the funds, adding here is equivalent to depositing
        // Process withdrawal fee
        if(_fee > 0) {
            _mintSharesFor(treasury, _fee, balance() - _fee);
        }
    }

    /// @dev Helper function to calculate fees.
    /// @param amount Amount to calculate fee on.
    /// @param feeBps The fee to be charged in basis points.
    /// @return Amount of fees to take.
    function _calculateFee(uint256 amount, uint256 feeBps)
        internal
        pure
        returns (uint256)
    {
        if (feeBps == 0) {
            return 0;
        }
        uint256 fee = (amount * feeBps) / MAX_BPS;
        return fee;
    }

    /// @dev Helper function to calculate governance and strategist performance fees. Make sure to use it to get paid!
    /// @param _amount Amount to calculate fee on.
    /// @return Tuple containing amount of (governance, strategist) fees to take.
    function _calculatePerformanceFee(uint256 _amount)
        internal
        view
        returns (uint256, uint256)
    {
        uint256 governancePerformanceFee = _calculateFee(
            _amount,
            performanceFeeGovernance
        );

        uint256 strategistPerformanceFee = _calculateFee(
            _amount,
            performanceFeeStrategist
        );

        return (governancePerformanceFee, strategistPerformanceFee);
    }

    /// @dev Helper function to issue shares to `recipient` based on an input `_amount` and `_pool` size.
    /// @param recipient Address to issue shares to.
    /// @param _amount Amount to issue shares on.
    /// @param _pool Pool size to use while calculating amount of shares to mint.
    function _mintSharesFor(
        address recipient,
        uint256 _amount,
        uint256 _pool
    ) internal {
        uint256 shares;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount * totalSupply()) / _pool;
        }
        _mint(recipient, shares);
    }

    /// @dev Helper function that issues shares based on performance and management fee when a harvest is reported.
    /// @param _harvestedAmount The harvested amount to take fee on.
    /// @param harvestTime Time of harvest (block.timestamp).
    function _handleFees(uint256 _harvestedAmount, uint256 harvestTime)
        internal
    {
        (
            uint256 feeGovernance,
            uint256 feeStrategist
        ) = _calculatePerformanceFee(_harvestedAmount);
        uint256 duration = harvestTime - lastHarvestedAt;

        // Management fee is calculated against the assets before harvest, to make it fair to depositors
        uint256 management_fee = managementFee > 0
            ? (managementFee * (balance() - _harvestedAmount) * duration) /
                SECS_PER_YEAR /
                MAX_BPS
            : 0;
        uint256 totalGovernanceFee = feeGovernance + management_fee;

        // Pool size is the size of the pool minus the fees, this way
        // it's equivalent to sending the tokens as rewards after the harvest
        // and depositing them again
        uint256 _pool = balance() - totalGovernanceFee - feeStrategist;

        // uint != is cheaper and equivalent to >
        if (totalGovernanceFee != 0) {
            _mintSharesFor(treasury, totalGovernanceFee, _pool);
        }

        if (feeStrategist != 0 && strategist != address(0)) {
            /// NOTE: adding feeGovernance backed to _pool as shares would have been issued for it.
            _mintSharesFor(
                strategist,
                feeStrategist,
                _pool + totalGovernanceFee
            );
        }
    }
}
