// SPDX-License-Identifier: MIT
// solhint-disable max-states-count
// solhint-disable var-name-mixedcase

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IController.sol";
import "./interfaces/IConverter.sol";
import "./interfaces/IHarvester.sol";
import "./interfaces/IManager.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IVault.sol";

/**
 * @title Manager
 * @notice This contract serves as the central point for governance-voted
 * variables. Fees and permissioned addresses are stored and referenced in
 * this contract only.
 */
contract Manager is IManager {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant PENDING_STRATEGIST_TIMELOCK = 7 days;
    uint256 public constant MAX_TOKENS = 256;

    address public immutable override yaxis;

    bool public override halted;

    address public override governance;
    address public override harvester;
    address public override insurancePool;
    address public override stakingPool;
    address public override strategist;
    address public override pendingStrategist;
    address public override treasury;

    // The following fees are all mutable.
    // They are updated by governance (community vote).
    uint256 public override insuranceFee;
    uint256 public override insurancePoolFee;
    uint256 public override stakingPoolShareFee;
    uint256 public override treasuryFee;
    uint256 public override withdrawalProtectionFee;


    uint256 private setPendingStrategistTime;

    // Governance must first allow the following properties before
    // the strategist can make use of them
    mapping(address => bool) public override allowedControllers;
    mapping(address => bool) public override allowedConverters;
    mapping(address => bool) public override allowedStrategies;
    mapping(address => bool) public override allowedTokens;
    mapping(address => bool) public override allowedVaults;

    // vault => controller
    mapping(address => address) public override controllers;
    // vault => tokens[]
    mapping(address => address[]) public override tokens;
    // token => vault
    mapping(address => address) public override vaults;

    event AllowedController(
        address indexed _controller,
        bool _allowed
    );
    event AllowedConverter(
        address indexed _converter,
        bool _allowed
    );
    event AllowedStrategy(
        address indexed _strategy,
        bool _allowed
    );
    event AllowedToken(
        address indexed _token,
        bool _allowed
    );
    event AllowedVault(
        address indexed _vault,
        bool _allowed
    );
    event Halted();
    event SetController(
        address indexed _vault,
        address indexed _controller
    );
    event SetGovernance(
        address indexed _governance
    );
    event SetPendingStrategist(
        address indexed _strategist
    );
    event SetStrategist(
        address indexed _strategist
    );
    event TokenAdded(
        address indexed _vault,
        address indexed _token
    );
    event TokenRemoved(
        address indexed _vault,
        address indexed _token
    );

    /**
     * @param _yaxis The address of the YAX token
     */
    constructor(
        address _yaxis
    )
        public
    {
        require(_yaxis != address(0), "!_yaxis");
        yaxis = _yaxis;
        governance = msg.sender;
        strategist = msg.sender;
        harvester = msg.sender;
        treasury = msg.sender;
        stakingPoolShareFee = 2000;
        treasuryFee = 500;
        withdrawalProtectionFee = 10;
    }

    /**
     * GOVERNANCE-ONLY FUNCTIONS
     */

    /**
     * @notice Sets the permission for the given controller
     * @param _controller The address of the controller
     * @param _allowed The status of if it is allowed
     */
    function setAllowedController(
        address _controller,
        bool _allowed
    )
        external
        notHalted
        onlyGovernance
    {
        require(address(IController(_controller).manager()) == address(this), "!manager");
        allowedControllers[_controller] = _allowed;
        emit AllowedController(_controller, _allowed);
    }

    /**
     * @notice Sets the permission for the given converter
     * @param _converter The address of the converter
     * @param _allowed The status of if it is allowed
     */
    function setAllowedConverter(
        address _converter,
        bool _allowed
    )
        external
        notHalted
        onlyGovernance
    {
        require(address(IConverter(_converter).manager()) == address(this), "!manager");
        allowedConverters[_converter] = _allowed;
        emit AllowedConverter(_converter, _allowed);
    }

    /**
     * @notice Sets the permission for the given strategy
     * @param _strategy The address of the strategy
     * @param _allowed The status of if it is allowed
     */
    function setAllowedStrategy(
        address _strategy,
        bool _allowed
    )
        external
        notHalted
        onlyGovernance
    {
        require(address(IStrategy(_strategy).manager()) == address(this), "!manager");
        allowedStrategies[_strategy] = _allowed;
        emit AllowedStrategy(_strategy, _allowed);
    }

    /**
     * @notice Sets the permission for the given token
     * @param _token The address of the token
     * @param _allowed The status of if it is allowed
     */
    function setAllowedToken(
        address _token,
        bool _allowed
    )
        external
        notHalted
        onlyGovernance
    {
        allowedTokens[_token] = _allowed;
        emit AllowedToken(_token, _allowed);
    }

    /**
     * @notice Sets the permission for the given vault
     * @param _vault The address of the vault
     * @param _allowed The status of if it is allowed
     */
    function setAllowedVault(
        address _vault,
        bool _allowed
    )
        external
        notHalted
        onlyGovernance
    {
        require(address(IVault(_vault).manager()) == address(this), "!manager");
        allowedVaults[_vault] = _allowed;
        emit AllowedVault(_vault, _allowed);
    }

    /**
     * @notice Sets the governance address
     * @param _governance The address of the governance
     */
    function setGovernance(
        address _governance
    )
        external
        notHalted
        onlyGovernance
    {
        governance = _governance;
        emit SetGovernance(_governance);
    }

    /**
     * @notice Sets the harvester address
     * @param _harvester The address of the harvester
     */
    function setHarvester(
        address _harvester
    )
        external
        notHalted
        onlyGovernance
    {
        require(address(IHarvester(_harvester).manager()) == address(this), "!manager");
        harvester = _harvester;
    }

    /**
     * @notice Sets the insurance fee
     * @dev Throws if setting fee over 1%
     * @param _insuranceFee The value for the insurance fee
     */
    function setInsuranceFee(
        uint256 _insuranceFee
    )
        external
        notHalted
        onlyGovernance
    {
        require(_insuranceFee <= 100, "_insuranceFee over 1%");
        insuranceFee = _insuranceFee;
    }

    /**
     * @notice Sets the insurance pool address
     * @param _insurancePool The address of the insurance pool
     */
    function setInsurancePool(
        address _insurancePool
    )
        external
        notHalted
        onlyGovernance
    {
        insurancePool = _insurancePool;
    }

    /**
     * @notice Sets the insurance pool fee
     * @dev Throws if setting fee over 20%
     * @param _insurancePoolFee The value for the insurance pool fee
     */
    function setInsurancePoolFee(
        uint256 _insurancePoolFee
    )
        external
        notHalted
        onlyGovernance
    {
        require(_insurancePoolFee <= 2000, "_insurancePoolFee over 20%");
        insurancePoolFee = _insurancePoolFee;
    }

    /**
     * @notice Sets the staking pool address
     * @param _stakingPool The address of the staking pool
     */
    function setStakingPool(
        address _stakingPool
    )
        external
        notHalted
        onlyGovernance
    {
        stakingPool = _stakingPool;
    }

    /**
     * @notice Sets the staking pool share fee
     * @dev Throws if setting fee over 50%
     * @param _stakingPoolShareFee The value for the staking pool fee
     */
    function setStakingPoolShareFee(
        uint256 _stakingPoolShareFee
    )
        external
        notHalted
        onlyGovernance
    {
        require(_stakingPoolShareFee <= 5000, "_stakingPoolShareFee over 50%");
        stakingPoolShareFee = _stakingPoolShareFee;
    }

    /**
     * @notice Sets the pending strategist and the timestamp
     * @param _strategist The address of the strategist
     */
    function setStrategist(
        address _strategist
    )
        external
        notHalted
        onlyGovernance
    {
        require(_strategist != address(0), "!_strategist");
        pendingStrategist = _strategist;
        // solhint-disable-next-line not-rely-on-time
        setPendingStrategistTime = block.timestamp;
        emit SetPendingStrategist(_strategist);
    }

    /**
     * @notice Sets the treasury address
     * @param _treasury The address of the treasury
     */
    function setTreasury(
        address _treasury
    )
        external
        notHalted
        onlyGovernance
    {
        require(_treasury != address(0), "!_treasury");
        treasury = _treasury;
    }

    /**
     * @notice Sets the treasury fee
     * @dev Throws if setting fee over 20%
     * @param _treasuryFee The value for the treasury fee
     */
    function setTreasuryFee(
        uint256 _treasuryFee
    )
        external
        notHalted
        onlyGovernance
    {
        require(_treasuryFee <= 2000, "_treasuryFee over 20%");
        treasuryFee = _treasuryFee;
    }

    /**
     * @notice Sets the withdrawal protection fee
     * @dev Throws if setting fee over 1%
     * @param _withdrawalProtectionFee The value for the withdrawal protection fee
     */
    function setWithdrawalProtectionFee(
        uint256 _withdrawalProtectionFee
    )
        external
        notHalted
        onlyGovernance
    {
        require(_withdrawalProtectionFee <= 100, "_withdrawalProtectionFee over 1%");
        withdrawalProtectionFee = _withdrawalProtectionFee;
    }

    /**
     * STRATEGIST-ONLY FUNCTIONS
     */

    /**
     * @notice Updates the strategist to the pending strategist
     * @dev This can only be called after the pending strategist timelock (7 days)
     */
    function acceptStrategist()
        external
        notHalted
    {
        require(msg.sender == pendingStrategist, "!pendingStrategist");
        // solhint-disable-next-line not-rely-on-time
        require(block.timestamp > setPendingStrategistTime.add(PENDING_STRATEGIST_TIMELOCK), "PENDING_STRATEGIST_TIMELOCK");
        delete pendingStrategist;
        delete setPendingStrategistTime;
        strategist = msg.sender;
        emit SetStrategist(msg.sender);
    }

    /**
     * @notice Adds a token to be able to be deposited for a given vault
     * @param _vault The address of the vault
     * @param _token The address of the token
     */
    function addToken(
        address _vault,
        address _token
    )
        external
        override
        notHalted
        onlyStrategist
    {
        require(allowedTokens[_token], "!allowedTokens");
        require(allowedVaults[_vault], "!allowedVaults");
        require(tokens[_vault].length < MAX_TOKENS, ">tokens");
        require(vaults[_token] == address(0), "!_token");
        vaults[_token] = _vault;
        tokens[_vault].push(_token);
        emit TokenAdded(_vault, _token);
    }

    /**
     * @notice Allows the strategist to pull tokens out of this contract
     * @dev This contract should never hold tokens
     * @param _token The address of the token
     * @param _amount The amount to withdraw
     * @param _to The address to send to
     */
    function recoverToken(
        IERC20 _token,
        uint256 _amount,
        address _to
    )
        external
        notHalted
        onlyStrategist
    {
        _token.safeTransfer(_to, _amount);
    }

    /**
     * @notice Removes a token from being able to be deposited for a given vault
     * @param _vault The address of the vault
     * @param _token The address of the token
     */
    function removeToken(
        address _vault,
        address _token
    )
        external
        override
        notHalted
        onlyStrategist
    {
        uint256 k = tokens[_vault].length;
        uint256 index;
        bool found;

        for (uint i = 0; i < k; i++) {
            if (tokens[_vault][i] == _token) {
                index = i;
                found = true;
                break;
            }
        }

        // TODO: Verify added check
        if (found) {
            tokens[_vault][index] = tokens[_vault][k-1];
            tokens[_vault].pop();
            delete vaults[_token];
            emit TokenRemoved(_vault, _token);
        }
    }

    /**
     * @notice Sets the vault address for a controller
     * @param _vault The address of the vault
     * @param _controller The address of the controller
     */
    function setController(
        address _vault,
        address _controller
    )
        external
        notHalted
        onlyStrategist
    {
        require(allowedVaults[_vault], "!_vault");
        require(allowedControllers[_controller], "!_controller");
        controllers[_vault] = _controller;
        emit SetController(_vault, _controller);
    }

    /**
     * @notice Sets the protocol as halted, disallowing all deposits forever
     * @dev Withdraws will still work, allowing users to exit the protocol
     */
    function setHalted()
        external
        notHalted
        onlyStrategist
    {
        halted = true;
        emit Halted();
    }

    /**
     * EXTERNAL VIEW FUNCTIONS
     */

    /**
     * @notice Returns an array of token addresses for a given vault
     * @param _vault The address of the vault
     */
    function getTokens(
        address _vault
    )
        external
        view
        override
        returns (address[] memory)
    {
        return tokens[_vault];
    }

    /**
     * @notice Returns a tuple of:
     *     YAXIS token address,
     *     Treasury address,
     *     Treasury fee
     */
    function getHarvestFeeInfo()
        external
        view
        override
        returns (
            address,
            address,
            uint256
        )
    {
        return (
            yaxis,
            treasury,
            treasuryFee
        );
    }

    modifier notHalted() {
        require(!halted, "halted");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "!governance");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == strategist, "!strategist");
        _;
    }
}
