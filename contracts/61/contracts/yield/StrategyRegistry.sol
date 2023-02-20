// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IStrategyRegistry.sol';

contract StrategyRegistry is Initializable, OwnableUpgradeable, IStrategyRegistry {
    using SafeMath for uint256;

    /**
     * @notice list of whitelisted strategies
     **/
    address[] public strategies;
    /**
     * @notice max strategies allowed to be whitelisted
     * @dev this limit ensures that strategies array is not too big to iterate
     **/
    uint256 public maxStrategies;

    /**
     * @notice registry which maps whitelisted strategies to true
     **/
    mapping(address => bool) public override registry;

    /**
     * @notice used to initialize the paramters of strategy registry
     * @dev can only be called once
     * @param _owner address of the owner
     * @param _maxStrategies maximum number of strategies allowed
     **/
    function initialize(address _owner, uint256 _maxStrategies) external initializer {
        require(_maxStrategies != 0, 'StrategyRegistry::initialize maxStrategies cannot be zero');
        __Ownable_init();
        super.transferOwnership(_owner);

        _updateMaxStrategies(_maxStrategies);
    }

    /**
     * @notice used to update max strategies allowed
     * @dev only owner can invoke
     * @param _maxStrategies updated number of max strategies allowed
     **/
    function updateMaxStrategies(uint256 _maxStrategies) external onlyOwner {
        _updateMaxStrategies(_maxStrategies);
    }

    function _updateMaxStrategies(uint256 _maxStrategies) internal {
        require(_maxStrategies != 0, 'StrategyRegistry::updateMaxStrategies should be more than zero');
        maxStrategies = _maxStrategies;
        emit MaxStrategiesUpdated(_maxStrategies);
    }

    /**
     * @notice used to get whitelisted strategies list
     * @return array of whitelisted strategies
     **/
    function getStrategies() external view override returns (address[] memory) {
        return strategies;
    }

    /**
     * @dev Add strategies to invest in. Please ensure that number of strategies are less than maxStrategies.
     * @param _strategy address of the strategy contract
     **/
    function addStrategy(address _strategy) external override onlyOwner {
        require(strategies.length.add(1) <= maxStrategies, "StrategyRegistry::addStrategy - Can't add more strategies");
        require(!registry[_strategy], 'StrategyRegistry::addStrategy - Strategy already exists');
        require(_strategy != address(0), 'StrategyRegistry::addStrategy - _strategy cannot be address(0)');
        registry[_strategy] = true;
        strategies.push(_strategy);

        emit StrategyAdded(_strategy);
    }

    /**
     * @dev Remove strategy to invest in.
     * @param _strategyIndex Index of the strategy to remove
     **/
    function removeStrategy(uint256 _strategyIndex) external override onlyOwner {
        address _strategy = strategies[_strategyIndex];
        strategies[_strategyIndex] = strategies[strategies.length.sub(1, 'StrategyRegistry::removeStrategy - No strategies exist')];
        strategies.pop();
        registry[_strategy] = false;

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
        require(
            strategies[_strategyIndex] == _oldStrategy,
            "StrategyRegistry::updateStrategy - index to update and strategy address don't match"
        );
        require(!registry[_newStrategy], 'StrategyRegistry::updateStrategy - New strategy already exists');
        strategies[_strategyIndex] = _newStrategy;

        registry[_oldStrategy] = false;
        emit StrategyRemoved(_oldStrategy);
        registry[_newStrategy] = true;
        emit StrategyAdded(_newStrategy);
    }
}
