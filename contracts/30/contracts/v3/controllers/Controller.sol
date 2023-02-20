// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IController.sol";
import "../interfaces/IConverter.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IHarvester.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IManager.sol";

/**
 * @title Controller
 * @notice This controller allows multiple strategies to be used
 * for a single vault supporting multiple tokens.
 */
contract Controller is IController {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IManager public immutable override manager;

    bool public globalInvestEnabled;
    uint256 public maxStrategies;

    struct VaultDetail {
        address converter;
        uint256 balance;
        address[] strategies;
        mapping(address => uint256) balances;
        mapping(address => uint256) index;
        mapping(address => uint256) caps;
    }

    // vault => Vault
    mapping(address => VaultDetail) internal _vaultDetails;
    // strategy => vault
    mapping(address => address) internal _vaultStrategies;

    /**
     * @notice Logged when harvest is called for a strategy
     */
    event Harvest(address indexed strategy);

    /**
     * @notice Logged when a strategy is added for a vault
     */
    event StrategyAdded(address indexed vault, address indexed strategy, uint256 cap);

    /**
     * @notice Logged when a strategy is removed for a vault
     */
    event StrategyRemoved(address indexed vault, address indexed strategy);

    /**
     * @notice Logged when strategies are reordered for a vault
     */
    event StrategiesReordered(
        address indexed vault,
        address indexed strategy1,
        address indexed strategy2
    );

    /**
     * @param _manager The address of the manager
     */
    constructor(
        address _manager
    )
        public
    {
        manager = IManager(_manager);
        globalInvestEnabled = true;
        maxStrategies = 10;
    }

    /**
     * STRATEGIST-ONLY FUNCTIONS
     */

    /**
     * @notice Adds a strategy for a given vault
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     * @param _cap The cap of the strategy
     * @param _timeout The timeout between harvests
     */
    function addStrategy(
        address _vault,
        address _strategy,
        uint256 _cap,
        uint256 _timeout
    )
        external
        notHalted
        onlyStrategist
        onlyStrategy(_strategy)
    {
        require(manager.allowedVaults(_vault), "!_vault");
        require(_vaultDetails[_vault].converter != address(0), "!converter");
        // checking if strategy is already added
        require(_vaultStrategies[_strategy] == address(0), "Strategy is already added"); 
        // get the index of the newly added strategy
        uint256 index = _vaultDetails[_vault].strategies.length;
        // ensure we haven't added too many strategies already
        require(index < maxStrategies, "!maxStrategies");
        // push the strategy to the array of strategies
        _vaultDetails[_vault].strategies.push(_strategy);
        // set the cap
        _vaultDetails[_vault].caps[_strategy] = _cap;
        // set the index
        _vaultDetails[_vault].index[_strategy] = index;
        // store the mapping of strategy to the vault
        _vaultStrategies[_strategy] = _vault;
        if (_timeout > 0) {
            // add it to the harvester
            IHarvester(manager.harvester()).addStrategy(_vault, _strategy, _timeout);
        }
        emit StrategyAdded(_vault, _strategy, _cap);
    }

    /**
     * @notice Withdraws token from a strategy to the treasury address as returned by the manager
     * @param _strategy The address of the strategy
     * @param _token The address of the token
     */
    function inCaseStrategyGetStuck(
        address _strategy,
        address _token
    )
        external
        onlyStrategist
    {
        IStrategy(_strategy).withdraw(_token);
        IERC20(_token).safeTransfer(
            manager.treasury(),
            IERC20(_token).balanceOf(address(this))
        );
    }

    /**
     * @notice Withdraws token from the controller to the treasury
     * @param _token The address of the token
     * @param _amount The amount that will be withdrawn
     */
    function inCaseTokensGetStuck(
        address _token,
        uint256 _amount
    )
        external
        onlyStrategist
    {
        IERC20(_token).safeTransfer(manager.treasury(), _amount);
    }

    /**
     * @notice Removes a strategy for a given token
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
        notHalted
        onlyStrategist
    {
        require(manager.allowedVaults(_vault), "!_vault");
        VaultDetail storage vaultDetail = _vaultDetails[_vault];
        // get the index of the strategy to remove
        uint256 index = vaultDetail.index[_strategy];
        // get the index of the last strategy
        uint256 tail = vaultDetail.strategies.length.sub(1);
        // get the address of the last strategy
        address replace = vaultDetail.strategies[tail];
        // replace the removed strategy with the tail
        vaultDetail.strategies[index] = replace;
        // set the new index for the replaced strategy
        vaultDetail.index[replace] = index;
        // remove the duplicate replaced strategy
        vaultDetail.strategies.pop();
        // remove the strategy's index
        delete vaultDetail.index[_strategy];
        // remove the strategy's cap
        delete vaultDetail.caps[_strategy];
        // remove the strategy's balance
        delete vaultDetail.balances[_strategy];
        // remove the mapping of strategy to the vault
        delete _vaultStrategies[_strategy];
        // pull funds from the removed strategy to the vault
        IStrategy(_strategy).withdrawAll();
        // remove the strategy from the harvester
        IHarvester(manager.harvester()).removeStrategy(_vault, _strategy, _timeout);
        emit StrategyRemoved(_vault, _strategy);
    }

    /**
     * @notice Reorders two strategies for a given vault
     * @param _vault The address of the vault
     * @param _strategy1 The address of the first strategy
     * @param _strategy2 The address of the second strategy
     */
    function reorderStrategies(
        address _vault,
        address _strategy1,
        address _strategy2
    )
        external
        notHalted
        onlyStrategist
    {
        require(manager.allowedVaults(_vault), "!_vault");
        require(_vaultStrategies[_strategy1] == _vault, "!_strategy1");
        require(_vaultStrategies[_strategy2] == _vault, "!_strategy2");
        VaultDetail storage vaultDetail = _vaultDetails[_vault];
        // get the indexes of the strategies
        uint256 index1 = vaultDetail.index[_strategy1];
        uint256 index2 = vaultDetail.index[_strategy2];
        // set the new addresses at their indexes
        vaultDetail.strategies[index1] = _strategy2;
        vaultDetail.strategies[index2] = _strategy1;
        // update indexes
        vaultDetail.index[_strategy1] = index2;
        vaultDetail.index[_strategy2] = index1;
        emit StrategiesReordered(_vault, _strategy1, _strategy2);
    }

    /**
     * @notice Sets/updates the cap of a strategy for a vault
     * @dev If the balance of the strategy is greater than the new cap (except if
     * the cap is 0), then withdraw the difference from the strategy to the vault.
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     * @param _cap The new cap of the strategy
     */
    function setCap(
        address _vault,
        address _strategy,
        uint256 _cap,
        address _convert
    )
        external
        notHalted
        onlyStrategist
        onlyStrategy(_strategy)
    {
        _vaultDetails[_vault].caps[_strategy] = _cap;
        uint256 _balance = IStrategy(_strategy).balanceOf();
        // send excess funds (over cap) back to the vault
        if (_balance > _cap && _cap != 0) {
            uint256 _diff = _balance.sub(_cap);
            IStrategy(_strategy).withdraw(_diff);
            updateBalance(_vault, _strategy);
            _balance = IStrategy(_strategy).balanceOf();
            _vaultDetails[_vault].balance = _vaultDetails[_vault].balance.sub(_diff);
            address _want = IStrategy(_strategy).want();
            _balance = IERC20(_want).balanceOf(address(this));
            if (_convert != address(0)) {
                IConverter _converter = IConverter(_vaultDetails[_vault].converter);
                IERC20(_want).safeTransfer(address(_converter), _balance);
                _balance = _converter.convert(_want, _convert, _balance, 1);
                IERC20(_convert).safeTransfer(_vault, _balance);
            } else {
                IERC20(_want).safeTransfer(_vault, _balance);
            }
        }
    }

    /**
     * @notice Sets/updates the converter for a given vault
     * @param _vault The address of the vault
     * @param _converter The address of the converter
     */
    function setConverter(
        address _vault,
        address _converter
    )
        external
        notHalted
        onlyStrategist
    {
        require(manager.allowedConverters(_converter), "!allowedConverters");
        _vaultDetails[_vault].converter = _converter;
    }

    /**
     * @notice Sets/updates the global invest enabled flag
     * @param _investEnabled The new bool of the invest enabled flag
     */
    function setInvestEnabled(
        bool _investEnabled
    )
        external
        notHalted
        onlyStrategist
    {
        globalInvestEnabled = _investEnabled;
    }

    /**
     * @notice Sets/updates the maximum number of strategies for a vault
     * @param _maxStrategies The new value of the maximum strategies
     */
    function setMaxStrategies(
        uint256 _maxStrategies
    )
        external
        notHalted
        onlyStrategist
    {
        maxStrategies = _maxStrategies;
    }

    function skim(
        address _strategy
    )
        external
        onlyStrategist
        onlyStrategy(_strategy)
    {
        address _want = IStrategy(_strategy).want();
        IStrategy(_strategy).skim();
        IERC20(_want).safeTransfer(_vaultStrategies[_strategy], IERC20(_want).balanceOf(address(this)));
    }

    /**
     * @notice Withdraws all funds from a strategy
     * @param _strategy The address of the strategy
     * @param _convert The token address to convert to
     */
    function withdrawAll(
        address _strategy,
        address _convert
    )
        external
        override
        onlyStrategist
        onlyStrategy(_strategy)
    {
        address _want = IStrategy(_strategy).want();
        IStrategy(_strategy).withdrawAll();
        uint256 _amount = IERC20(_want).balanceOf(address(this));
        address _vault = _vaultStrategies[_strategy];
        updateBalance(_vault, _strategy);
        if (_convert != address(0)) {
            IConverter _converter = IConverter(_vaultDetails[_vault].converter);
            IERC20(_want).safeTransfer(address(_converter), _amount);
            _amount = _converter.convert(_want, _convert, _amount, 1);
            IERC20(_convert).safeTransfer(_vault, _amount);
        } else {
            IERC20(_want).safeTransfer(_vault, _amount);
        }
        uint256 _balance = _vaultDetails[_vault].balance;
        if (_balance >= _amount) {
            _vaultDetails[_vault].balance = _balance.sub(_amount);
        } else {
            _vaultDetails[_vault].balance = 0;
        }
    }

    /**
     * HARVESTER-ONLY FUNCTIONS
     */

    /**
     * @notice Harvests the specified strategy
     * @param _strategy The address of the strategy
     */
    function harvestStrategy(
        address _strategy,
        uint256 _estimatedWETH,
        uint256 _estimatedYAXIS
    )
        external
        override
        notHalted
        onlyHarvester
        onlyStrategy(_strategy)
    {
        uint256 _before = IStrategy(_strategy).balanceOf();
        IStrategy(_strategy).harvest(_estimatedWETH, _estimatedYAXIS);
        uint256 _after = IStrategy(_strategy).balanceOf();
        address _vault = _vaultStrategies[_strategy];
        _vaultDetails[_vault].balance = _vaultDetails[_vault].balance.add(_after.sub(_before));
        _vaultDetails[_vault].balances[_strategy] = _after;
        emit Harvest(_strategy);
    }

    /**
     * VAULT-ONLY FUNCTIONS
     */

    /**
     * @notice Invests funds into a strategy
     * @param _strategy The address of the strategy
     * @param _token The address of the token
     * @param _amount The amount that will be invested
     */
    function earn(
        address _strategy,
        address _token,
        uint256 _amount
    )
        external
        override
        notHalted
        onlyStrategy(_strategy)
        onlyVault(_token)
    {
        // get the want token of the strategy
        address _want = IStrategy(_strategy).want();
        if (_want != _token) {
            IConverter _converter = IConverter(_vaultDetails[msg.sender].converter);
            IERC20(_token).safeTransfer(address(_converter), _amount);
            // TODO: do estimation for received
            _amount = _converter.convert(_token, _want, _amount, 1);
            IERC20(_want).safeTransfer(_strategy, _amount);
        } else {
            IERC20(_token).safeTransfer(_strategy, _amount);
        }
        _vaultDetails[msg.sender].balance = _vaultDetails[msg.sender].balance.add(_amount);
        // call the strategy deposit function
        IStrategy(_strategy).deposit();
        updateBalance(msg.sender, _strategy);
    }

    /**
     * @notice Withdraws funds from a strategy
     * @dev If the withdraw amount is greater than the first strategy given
     * by getBestStrategyWithdraw, this function will loop over strategies
     * until the requested amount is met.
     * @param _token The address of the token
     * @param _amount The amount that will be withdrawn
     */
    function withdraw(
        address _token,
        uint256 _amount
    )
        external
        override
        onlyVault(_token)
    {
        (
            address[] memory _strategies,
            uint256[] memory _amounts
        ) = getBestStrategyWithdraw(_token, _amount);
        for (uint i = 0; i < _strategies.length; i++) {
            // getBestStrategyWithdraw will return arrays larger than needed
            // if this happens, simply exit the loop
            if (_strategies[i] == address(0)) {
                break;
            }
            IStrategy(_strategies[i]).withdraw(_amounts[i]);
            updateBalance(msg.sender, _strategies[i]);
            address _want = IStrategy(_strategies[i]).want();
            if (_want != _token) {
                address _converter = _vaultDetails[msg.sender].converter;
                IERC20(_want).safeTransfer(_converter, _amounts[i]);
                // TODO: do estimation for received
                IConverter(_converter).convert(_want, _token, _amounts[i], 1);
            }
        }
        _amount = IERC20(_token).balanceOf(address(this));
        _vaultDetails[msg.sender].balance = _vaultDetails[msg.sender].balance.sub(_amount);
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }

    /**
     * EXTERNAL VIEW FUNCTIONS
     */

    /**
     * @notice Returns the rough balance of the sum of all strategies for a given vault
     * @dev This function is optimized to prevent looping over all strategy balances,
     * and instead the controller tracks the earn, withdraw, and harvest amounts.
     */
    function balanceOf()
        external
        view
        override
        returns (uint256 _balance)
    {
        return _vaultDetails[msg.sender].balance;
    }

    /**
     * @notice Returns the converter assigned for the given vault
     * @param _vault Address of the vault
     */
    function converter(
        address _vault
    )
        external
        view
        override
        returns (address)
    {
        return _vaultDetails[_vault].converter;
    }

    /**
     * @notice Returns the cap of a strategy for a given vault
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     */
    function getCap(
        address _vault,
        address _strategy
    )
        external
        view
        returns (uint256)
    {
        return _vaultDetails[_vault].caps[_strategy];
    }

    /**
     * @notice Returns whether investing is enabled for the calling vault
     * @dev Should be called by the vault
     */
    function investEnabled()
        external
        view
        override
        returns (bool)
    {
        if (globalInvestEnabled) {
            return _vaultDetails[msg.sender].strategies.length > 0;
        }
        return false;
    }

    /**
     * @notice Returns all the strategies for a given vault
     * @param _vault The address of the vault
     */
    function strategies(
        address _vault
    )
        external
        view
        returns (address[] memory)
    {
        return _vaultDetails[_vault].strategies;
    }

    /**
     * @notice Returns the length of the strategies of the calling vault
     * @dev This function is expected to be called by a vault
     */
    function strategies()
        external
        view
        override
        returns (uint256)
    {
        return _vaultDetails[msg.sender].strategies.length;
    }

    /**
     * INTERNAL FUNCTIONS
     */

    /**
     * @notice Returns the best (optimistic) strategy for funds to be withdrawn from
     * @dev Since Solidity doesn't support dynamic arrays in memory, the returned arrays
     * from this function will always be the same length as the amount of strategies for
     * a token. Check that _strategies[i] != address(0) when consuming to know when to
     * break out of the loop.
     * @param _token The address of the token
     * @param _amount The amount that will be withdrawn
     */
    function getBestStrategyWithdraw(
        address _token,
        uint256 _amount
    )
        internal
        view
        returns (
            address[] memory _strategies,
            uint256[] memory _amounts
        )
    {
        // get the length of strategies for a single token
        address _vault = manager.vaults(_token);
        uint256 k = _vaultDetails[_vault].strategies.length;
        // initialize fixed-length memory arrays
        _strategies = new address[](k);
        _amounts = new uint256[](k);
        address _strategy;
        uint256 _balance;
        // scan forward from the the beginning of strategies
        for (uint i = 0; i < k; i++) {
            _strategy = _vaultDetails[_vault].strategies[i];
            _strategies[i] = _strategy;
            // get the balance of the strategy
            _balance = _vaultDetails[_vault].balances[_strategy];
            // if the strategy doesn't have the balance to cover the withdraw
            if (_balance < _amount) {
                // withdraw what we can and add to the _amounts
                _amounts[i] = _balance;
                _amount = _amount.sub(_balance);
            } else {
                // stop scanning if the balance is more than the withdraw amount
                _amounts[i] = _amount;
                break;
            }
        }
    }

    /**
     * @notice Updates the stored balance of a given strategy for a vault
     * @param _vault The address of the vault
     * @param _strategy The address of the strategy
     */
    function updateBalance(
        address _vault,
        address _strategy
    )
        internal
    {
        _vaultDetails[_vault].balances[_strategy] = IStrategy(_strategy).balanceOf();
    }

    /**
     * MODIFIERS
     */

    /**
     * @notice Reverts if the protocol is halted
     */
    modifier notHalted() {
        require(!manager.halted(), "halted");
        _;
    }

    /**
     * @notice Reverts if the caller is not governance
     */
    modifier onlyGovernance() {
        require(msg.sender == manager.governance(), "!governance");
        _;
    }

    /**
     * @notice Reverts if the caller is not the strategist
     */
    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }

    /**
     * @notice Reverts if the strategy is not allowed in the manager
     */
    modifier onlyStrategy(address _strategy) {
        require(manager.allowedStrategies(_strategy), "!allowedStrategy");
        _;
    }

    /**
     * @notice Reverts if the caller is not the harvester
     */
    modifier onlyHarvester() {
        require(msg.sender == manager.harvester(), "!harvester");
        _;
    }

    /**
     * @notice Reverts if the caller is not the vault for the given token
     */
    modifier onlyVault(address _token) {
        require(msg.sender == manager.vaults(_token), "!vault");
        _;
    }
}
