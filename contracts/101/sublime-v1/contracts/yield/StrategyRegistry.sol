// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IStrategyRegistry.sol';

contract StrategyRegistry is Initializable, OwnableUpgradeable, IStrategyRegistry {
    using SafeMath for uint256;

    //-------------------------------- Global vars start --------------------------------/

    /**
     * @notice max strategies allowed to be whitelisted
     * @dev this limit ensures that strategies array is not too big to iterate
     **/
    uint256 public maxStrategies;

    //-------------------------------- Global vars end --------------------------------/

    //-------------------------------- State vars start --------------------------------/

    /**
     * @notice list of whitelisted strategies
     **/
    address[] public strategies;

    /**
     * @notice registry which maps whitelisted strategies to true
     **/
    mapping(address => uint256) public override registry;

    /**
     * @notice registry which maps retired strategies which were once whitelisted to true
     **/
    mapping(address => uint256) public retiredRegistry;

    //-------------------------------- State vars end --------------------------------/

    //-------------------------------- Init start --------------------------------/

    /**
     * @notice used to initialize the paramters of strategy registry
     * @dev can only be called once
     * @param _owner address of the owner
     * @param _maxStrategies maximum number of strategies allowed
     **/
    function initialize(address _owner, uint256 _maxStrategies) external initializer {
        __Ownable_init();
        super.transferOwnership(_owner);

        _updateMaxStrategies(_maxStrategies);
    }

    //-------------------------------- Init end --------------------------------/

    //-------------------------------- Strategy mgmt start --------------------------------/

    /**
     * @dev Add strategies to invest in. Please ensure that number of strategies are less than maxStrategies.
     * @param _strategy address of the strategy contract
     **/
    function addStrategy(address _strategy) external override onlyOwner {
        require(strategies.length + 1 <= maxStrategies, 'SR:AS1');
        require(registry[_strategy] == 0, 'SR:AS2');
        require(_strategy != address(0), 'SR:AS3');
        registry[_strategy] = 1;
        strategies.push(_strategy);

        emit StrategyAdded(_strategy);
    }

    /**
     * @dev Remove strategy to invest in.
     * @param _strategyIndex Index of the strategy to remove
     * @param _strategyAddress Address of the strategy to remove
     **/
    function removeStrategy(uint256 _strategyIndex, address _strategyAddress) external override onlyOwner {
        address _strategy = strategies[_strategyIndex];
        require(_strategy == _strategyAddress, 'SR:RS1');
        address[] memory _strategies = strategies;
        for (uint256 i = _strategyIndex; i < _strategies.length - 1; ++i) {
            strategies[i] = _strategies[i + 1];
        }
        strategies.pop();
        delete registry[_strategy];
        retiredRegistry[_strategy] = 1;

        emit StrategyRemoved(_strategy);
    }

    /**
     * @dev Update strategy to invest in.
     * @param _strategyIndex Index of the strategy to remove
     * @param _oldStrategy Strategy that is to be removed
     * @param _newStrategy Updated strategy
     **/
    function updateStrategy(
        uint256 _strategyIndex,
        address _oldStrategy,
        address _newStrategy
    ) external override onlyOwner {
        require(_strategyIndex < strategies.length, 'SR:US1');
        require(strategies[_strategyIndex] == _oldStrategy, 'SR:US2');
        require(_newStrategy != address(0), 'SR:US3');
        require(registry[_newStrategy] == 0, 'SR:US4');
        strategies[_strategyIndex] = _newStrategy;

        delete registry[_oldStrategy];
        retiredRegistry[_oldStrategy] = 1;
        emit StrategyRemoved(_oldStrategy);
        registry[_newStrategy] = 1;
        emit StrategyAdded(_newStrategy);
    }

    //-------------------------------- Strategy mgmt end --------------------------------/

    //-------------------------------- Utils start --------------------------------/
    /**
     * @notice used to get whitelisted strategies list
     * @return array of whitelisted strategies
     **/
    function getStrategies() external view override returns (address[] memory) {
        return strategies;
    }

    function isValidStrategy(address _strategy) external view override returns (bool) {
        return (registry[_strategy] != 0 || retiredRegistry[_strategy] != 0);
    }

    //-------------------------------- Utils end --------------------------------/

    //-------------------------------- Global var setters start --------------------------------/
    /**
     * @notice used to update max strategies allowed
     * @dev only owner can invoke
     * @param _maxStrategies updated number of max strategies allowed
     **/
    function updateMaxStrategies(uint256 _maxStrategies) external onlyOwner {
        _updateMaxStrategies(_maxStrategies);
    }

    function _updateMaxStrategies(uint256 _maxStrategies) private {
        require(_maxStrategies != 0, 'SR:IUMS1');
        maxStrategies = _maxStrategies;
        emit MaxStrategiesUpdated(_maxStrategies);
    }

    //-------------------------------- Global var setters end --------------------------------/
}
