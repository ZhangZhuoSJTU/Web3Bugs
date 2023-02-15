// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IVault.sol";
import "./interfaces/IController.sol";
import "./interfaces/IHarvester.sol";
import "./interfaces/ILegacyController.sol";
import "./interfaces/IManager.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/ISwap.sol";

/**
 * @title Harvester
 * @notice This contract is to be used as a central point to call
 * harvest on all strategies for any given vault. It has its own
 * permissions for harvesters (set by the strategist or governance).
 */
contract Harvester is IHarvester {
    using SafeMath for uint256;

    uint256 public constant ONE_HUNDRED_PERCENT = 10000;

    IManager public immutable override manager;
    IController public immutable controller;
    ILegacyController public immutable legacyController;

    uint256 public slippage;

    struct Strategy {
        uint256 timeout;
        uint256 lastCalled;
        address[] addresses;
    }

    mapping(address => Strategy) public strategies;
    mapping(address => bool) public isHarvester;

    /**
     * @notice Logged when harvest is called for a strategy
     */
    event Harvest(
        address indexed controller,
        address indexed strategy
    );

    /**
     * @notice Logged when a harvester is set
     */
    event HarvesterSet(address indexed harvester, bool status);

    /**
     * @notice Logged when a strategy is added for a vault
     */
    event StrategyAdded(address indexed vault, address indexed strategy, uint256 timeout);

    /**
     * @notice Logged when a strategy is removed for a vault
     */
    event StrategyRemoved(address indexed vault, address indexed strategy, uint256 timeout);

    /**
     * @param _manager The address of the yAxisMetaVaultManager contract
     * @param _controller The address of the controller
     */
    constructor(
        address _manager,
        address _controller,
        address _legacyController
    )
        public
    {
        manager = IManager(_manager);
        controller = IController(_controller);
        legacyController = ILegacyController(_legacyController);
    }

    /**
     * (GOVERNANCE|STRATEGIST)-ONLY FUNCTIONS
     */

    /**
     * @notice Adds a strategy to the rotation for a given vault and sets a timeout
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     * @param _timeout The timeout between harvests
     */
    function addStrategy(
        address _vault,
        address _strategy,
        uint256 _timeout
    )
        external
        override
        onlyController
    {
        strategies[_vault].addresses.push(_strategy);
        strategies[_vault].timeout = _timeout;
        emit StrategyAdded(_vault, _strategy, _timeout);
    }

    /**
     * @notice Removes a strategy from the rotation for a given vault and sets a timeout
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     * @param _timeout The timeout between harvests
     */
    function removeStrategy(
        address _vault,
        address _strategy,
        uint256 _timeout
    )
        external
        override
        onlyController
    {
        uint256 tail = strategies[_vault].addresses.length;
        uint256 index;
        bool found;
        for (uint i; i < tail; i++) {
            if (strategies[_vault].addresses[i] == _strategy) {
                index = i;
                found = true;
                break;
            }
        }

        if (found) {
            strategies[_vault].addresses[index] = strategies[_vault].addresses[tail.sub(1)];
            strategies[_vault].addresses.pop();
            strategies[_vault].timeout = _timeout;
            emit StrategyRemoved(_vault, _strategy, _timeout);
        }
    }

    /**
     * @notice Sets the status of a harvester address to be able to call harvest functions
     * @param _harvester The address of the harvester
     * @param _status The status to allow the harvester to harvest
     */
    function setHarvester(
        address _harvester,
        bool _status
    )
        external
        onlyStrategist
    {
        isHarvester[_harvester] = _status;
        emit HarvesterSet(_harvester, _status);
    }

    function setSlippage(
        uint256 _slippage
    )
        external
        onlyStrategist
    {
        require(_slippage < ONE_HUNDRED_PERCENT, "!_slippage");
        slippage = _slippage;
    }

    /**
     * HARVESTER-ONLY FUNCTIONS
     */

    function earn(
        address _strategy,
        address _vault
    )
        external
        onlyHarvester
    {
        IVault(_vault).earn(_strategy);
    }

    /**
     * @notice Harvests a given strategy on the provided controller
     * @dev This function ignores the timeout
     * @param _controller The address of the controller
     * @param _strategy The address of the strategy
     */
    function harvest(
        IController _controller,
        address _strategy,
        uint256 _estimatedWETH,
        uint256 _estimatedYAXIS
    )
        public
        onlyHarvester
    {
        _controller.harvestStrategy(_strategy, _estimatedWETH, _estimatedYAXIS);
        emit Harvest(address(_controller), _strategy);
    }

    /**
     * @notice Harvests the next available strategy for a given vault and
     * rotates the strategies
     * @param _vault The address of the vault
     */
    function harvestNextStrategy(
        address _vault,
        uint256 _estimatedWETH,
        uint256 _estimatedYAXIS
    )
        external
    {
        require(canHarvest(_vault), "!canHarvest");
        address strategy = strategies[_vault].addresses[0];
        harvest(controller, strategy, _estimatedWETH, _estimatedYAXIS);
        uint256 k = strategies[_vault].addresses.length;
        if (k > 1) {
            address[] memory _strategies = new address[](k);
            for (uint i; i < k-1; i++) {
                _strategies[i] = strategies[_vault].addresses[i+1];
            }
            _strategies[k-1] = strategy;
            strategies[_vault].addresses = _strategies;
        }
        // solhint-disable-next-line not-rely-on-time
        strategies[_vault].lastCalled = block.timestamp;
    }

    /**
     * @notice Earns tokens in the LegacyController to the v3 vault
     * @param _expected The expected amount to deposit after conversion
     */
    function legacyEarn(
        uint256 _expected
    )
        external
        onlyHarvester
    {
        legacyController.legacyDeposit(_expected);
    }

    /**
     * EXTERNAL VIEW FUNCTIONS
     */

    /**
     * @notice Returns the addresses of the strategies for a given vault
     * @param _vault The address of the vault
     */
    function strategyAddresses(
        address _vault
    )
        external
        view
        returns (address[] memory)
    {
        return strategies[_vault].addresses;
    }

    /**
     * PUBLIC VIEW FUNCTIONS
     */

    /**
     * @notice Returns the availability of a vault's strategy to be harvested
     * @param _vault The address of the vault
     */
    function canHarvest(
        address _vault
    )
        public
        view
        returns (bool)
    {
        Strategy storage strategy = strategies[_vault];
        // only can harvest if there are strategies, and when sufficient time has elapsed
        // solhint-disable-next-line not-rely-on-time
        return (strategy.addresses.length > 0 && strategy.lastCalled <= block.timestamp.sub(strategy.timeout));
    }

    /**
     * @notice Returns the estimated amount of WETH and YAXIS for the given strategy
     * @param _strategy The address of the strategy
     */
    function getEstimates(
        address _strategy
    )
        public
        view
        returns (uint256 _estimatedWETH, uint256 _estimatedYAXIS)
    {
        ISwap _router = IStrategy(_strategy).router();
        address[] memory _path;
        _path[0] = IStrategy(_strategy).want();
        _path[1] = IStrategy(_strategy).weth();
        uint256[] memory _amounts = _router.getAmountsOut(
            IStrategy(_strategy).balanceOfPool(),
            _path
        );
        _estimatedWETH = _amounts[1];
        uint256 _slippage = slippage;
        if (_slippage > 0) {
            _estimatedWETH = _estimatedWETH.mul(_slippage).div(ONE_HUNDRED_PERCENT);
        }
        _path[0] = manager.yaxis();
        uint256 _fee = _estimatedWETH.mul(manager.treasuryFee()).div(ONE_HUNDRED_PERCENT);
        _amounts = _router.getAmountsOut(_fee, _path);
        _estimatedYAXIS = _amounts[1];
        if (_slippage > 0) {
            _estimatedYAXIS = _estimatedYAXIS.mul(_slippage).div(ONE_HUNDRED_PERCENT);
        }
    }

    /**
     * MODIFIERS
     */

    modifier onlyController() {
        require(manager.allowedControllers(msg.sender), "!controller");
        _;
    }

    modifier onlyHarvester() {
        require(isHarvester[msg.sender], "!harvester");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }
}
