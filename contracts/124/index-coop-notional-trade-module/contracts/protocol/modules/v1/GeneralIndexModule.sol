/*
    Copyright 2021 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;
pragma experimental "ABIEncoderV2";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { AddressArrayUtils } from "../../../lib/AddressArrayUtils.sol";
import { IController } from "../../../interfaces/IController.sol";
import { IIndexExchangeAdapter } from "../../../interfaces/IIndexExchangeAdapter.sol";
import { Invoke } from "../../lib/Invoke.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { IWETH } from "../../../interfaces/external/IWETH.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";
import { Position } from "../../lib/Position.sol";
import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";
import { Uint256ArrayUtils } from "../../../lib/Uint256ArrayUtils.sol";


/**
 * @title GeneralIndexModule
 * @author Set Protocol
 *
 * Smart contract that facilitates rebalances for indices. Manager can update allocation by calling startRebalance().
 * There is no "end" to a rebalance, however once there are no more tokens to sell the rebalance is effectively over
 * until the manager calls startRebalance() again with a new allocation. Once a new allocation is passed in, allowed
 * traders can submit rebalance transactions by calling trade() and specifying the component they wish to rebalance.
 * All parameterizations for a trade are set by the manager ahead of time, including max trade size, coolOffPeriod bet-
 * ween trades, and exchange to trade on. WETH is used as the quote asset for all trades, near the end of rebalance
 * tradeRemaingingWETH() or raiseAssetTargets() can be called to clean up any excess WETH positions. Once a component's
 * target allocation is met any further attempted trades of that component will revert.
 *
 * SECURITY ASSUMPTION:
 *  - Works with following modules: StreamingFeeModule, BasicIssuanceModule (any other module additions to Sets using
 *    this module need to be examined separately)
 */
contract GeneralIndexModule is ModuleBase, ReentrancyGuard {
    using SafeCast for int256;
    using SafeCast for uint256;
    using SafeMath for uint256;
    using Position for uint256;
    using Math for uint256;
    using Position for ISetToken;
    using Invoke for ISetToken;
    using AddressArrayUtils for address[];
    using AddressArrayUtils for IERC20[];
    using Uint256ArrayUtils for uint256[];

    /* ============ Struct ============ */

    struct TradeExecutionParams {
        uint256 targetUnit;              // Target unit of component for Set
        uint256 maxSize;                 // Max trade size in precise units
        uint256 coolOffPeriod;           // Required time between trades for the asset
        uint256 lastTradeTimestamp;      // Timestamp of last trade
        string exchangeName;             // Name of exchange adapter
        bytes exchangeData;              // Arbitrary data that can be used to encode exchange specific settings (fee tier) or features (multi-hop)
    }

    struct TradePermissionInfo {
        bool anyoneTrade;                               // Boolean indicating if anyone can execute a trade
        address[] tradersHistory;                       // Tracks permissioned traders to be deleted on module removal
        mapping(address => bool) tradeAllowList;        // Mapping indicating which addresses are allowed to execute trade
    }

    struct RebalanceInfo {
        uint256 positionMultiplier;         // Position multiplier at the beginning of rebalance
        uint256 raiseTargetPercentage;      // Amount to raise all unit targets by if allowed (in precise units)
        address[] rebalanceComponents;      // Array of components involved in rebalance
    }

    struct TradeInfo {
        ISetToken setToken;                         // Instance of SetToken
        IIndexExchangeAdapter exchangeAdapter;      // Instance of Exchange Adapter
        address sendToken;                          // Address of token being sold
        address receiveToken;                       // Address of token being bought
        bool isSendTokenFixed;                      // Boolean indicating fixed asset is send token
        uint256 setTotalSupply;                     // Total supply of Set (in precise units)
        uint256 totalFixedQuantity;                 // Total quantity of fixed asset being traded
        uint256 sendQuantity;                       // Units of component sent to the exchange
        uint256 floatingQuantityLimit;              // Max/min amount of floating token spent/received during trade
        uint256 preTradeSendTokenBalance;           // Total initial balance of token being sold
        uint256 preTradeReceiveTokenBalance;        // Total initial balance of token being bought
        bytes exchangeData;                         // Arbitrary data for executing trade on given exchange
    }

    /* ============ Events ============ */

    event TradeMaximumUpdated(ISetToken indexed _setToken, address indexed _component, uint256 _newMaximum);
    event AssetExchangeUpdated(ISetToken indexed _setToken, address indexed _component, string _newExchangeName);
    event CoolOffPeriodUpdated(ISetToken indexed _setToken, address indexed _component, uint256 _newCoolOffPeriod);
    event ExchangeDataUpdated(ISetToken indexed _setToken, address indexed _component, bytes _newExchangeData);
    event RaiseTargetPercentageUpdated(ISetToken indexed _setToken, uint256 indexed _raiseTargetPercentage);
    event AssetTargetsRaised(ISetToken indexed _setToken, uint256 indexed positionMultiplier);

    event AnyoneTradeUpdated(ISetToken indexed _setToken, bool indexed _status);
    event TraderStatusUpdated(ISetToken indexed _setToken, address indexed _trader, bool _status);

    event TradeExecuted(
        ISetToken indexed _setToken,
        address indexed _sellComponent,
        address indexed _buyComponent,
        IIndexExchangeAdapter _exchangeAdapter,
        address _executor,
        uint256 _netAmountSold,
        uint256 _netAmountReceived,
        uint256 _protocolFee
    );

    event RebalanceStarted(
        ISetToken indexed _setToken,
        address[] aggregateComponents,
        uint256[] aggregateTargetUnits,
        uint256 indexed positionMultiplier
    );

    /* ============ Constants ============ */

    uint256 private constant GENERAL_INDEX_MODULE_PROTOCOL_FEE_INDEX = 0;                   // Id of protocol fee % assigned to this module in the Controller

    /* ============ State Variables ============ */

    mapping(ISetToken => mapping(IERC20 => TradeExecutionParams)) public executionInfo;     // Mapping of SetToken to execution parameters of each asset on SetToken
    mapping(ISetToken => TradePermissionInfo) public permissionInfo;                        // Mapping of SetToken to trading permissions
    mapping(ISetToken => RebalanceInfo) public rebalanceInfo;                               // Mapping of SetToken to relevant data for current rebalance
    IWETH public immutable weth;                                                            // Weth contract address

    /* ============ Modifiers ============ */

    modifier onlyAllowedTrader(ISetToken _setToken) {
        _validateOnlyAllowedTrader(_setToken);
        _;
    }

    modifier onlyEOAIfUnrestricted(ISetToken _setToken) {
        _validateOnlyEOAIfUnrestricted(_setToken);
        _;
    }

    /* ============ Constructor ============ */

    constructor(IController _controller, IWETH _weth) public ModuleBase(_controller) {
        weth = _weth;
    }

    /* ============ External Functions ============ */

    /**
     * MANAGER ONLY: Changes the target allocation of the Set, opening it up for trading by the Sets designated traders. The manager
     * must pass in any new components and their target units (units defined by the amount of that component the manager wants in 10**18
     * units of a SetToken). Old component target units must be passed in, in the current order of the components array on the
     * SetToken. If a component is being removed it's index in the _oldComponentsTargetUnits should be set to 0. Additionally, the
     * positionMultiplier is passed in, in order to adjust the target units in the event fees are accrued or some other activity occurs
     * that changes the positionMultiplier of the Set. This guarantees the same relative allocation between all the components.
     *
     * @param _setToken                         Address of the SetToken to be rebalanced
     * @param _newComponents                    Array of new components to add to allocation
     * @param _newComponentsTargetUnits         Array of target units at end of rebalance for new components, maps to same index of _newComponents array
     * @param _oldComponentsTargetUnits         Array of target units at end of rebalance for old component, maps to same index of
     *                                               _setToken.getComponents() array, if component being removed set to 0.
     * @param _positionMultiplier               Position multiplier when target units were calculated, needed in order to adjust target units
     *                                               if fees accrued
     */
    function startRebalance(
        ISetToken _setToken,
        address[] calldata _newComponents,
        uint256[] calldata _newComponentsTargetUnits,
        uint256[] calldata _oldComponentsTargetUnits,
        uint256 _positionMultiplier
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        ( address[] memory aggregateComponents, uint256[] memory aggregateTargetUnits ) = _getAggregateComponentsAndUnits(
            _setToken.getComponents(),
            _newComponents,
            _newComponentsTargetUnits,
            _oldComponentsTargetUnits
        );

        for (uint256 i = 0; i < aggregateComponents.length; i++) {
            require(!_setToken.hasExternalPosition(aggregateComponents[i]), "External positions not allowed");
            executionInfo[_setToken][IERC20(aggregateComponents[i])].targetUnit = aggregateTargetUnits[i];
        }

        rebalanceInfo[_setToken].rebalanceComponents = aggregateComponents;
        rebalanceInfo[_setToken].positionMultiplier = _positionMultiplier;

        emit RebalanceStarted(_setToken, aggregateComponents, aggregateTargetUnits, _positionMultiplier);
    }

    /**
     * ACCESS LIMITED: Calling trade() pushes the current component units closer to the target units defined by the manager in startRebalance().
     * Only approved addresses can call, if anyoneTrade is false then contracts are allowed to call otherwise calling address must be EOA.
     *
     * Trade can be called at anytime but will revert if the passed component's target unit is met or cool off period hasn't passed. Trader can pass
     * in a max/min amount of ETH spent/received in the trade based on if the component is being bought/sold in order to prevent sandwich attacks.
     * The parameters defined by the manager are used to determine which exchange will be used and the size of the trade. Trade size will default
     * to max trade size unless the max trade size would exceed the target, then an amount that would match the target unit is traded. Protocol fees,
     * if enabled, are collected in the token received in a trade.
     *
     * @param _setToken             Address of the SetToken
     * @param _component            Address of SetToken component to trade
     * @param _ethQuantityLimit     Max/min amount of ETH spent/received during trade
     */
    function trade(
        ISetToken _setToken,
        IERC20 _component,
        uint256 _ethQuantityLimit
    )
        external
        nonReentrant
        onlyAllowedTrader(_setToken)
        onlyEOAIfUnrestricted(_setToken)
        virtual
    {
        _validateTradeParameters(_setToken, _component);

        TradeInfo memory tradeInfo = _createTradeInfo(_setToken, _component, _ethQuantityLimit);

        _executeTrade(tradeInfo);

        uint256 protocolFee = _accrueProtocolFee(tradeInfo);

        (uint256 netSendAmount, uint256 netReceiveAmount) = _updatePositionStateAndTimestamp(tradeInfo, _component);

        emit TradeExecuted(
            tradeInfo.setToken,
            tradeInfo.sendToken,
            tradeInfo.receiveToken,
            tradeInfo.exchangeAdapter,
            msg.sender,
            netSendAmount,
            netReceiveAmount,
            protocolFee
        );
    }

    /**
     * ACCESS LIMITED: Only callable when 1) there are no more components to be sold and, 2) entire remaining WETH amount (above WETH target) can be
     * traded such that resulting inflows won't exceed component's maxTradeSize nor overshoot the target unit. To be used near the end of rebalances
     * when a component's calculated trade size is greater in value than remaining WETH.
     *
     * Only approved addresses can call, if anyoneTrade is false then contracts are allowed to call otherwise calling address must be EOA. Trade
     * can be called at anytime but will revert if the passed component's target unit is met or cool off period hasn't passed. Like with trade()
     * a minimum component receive amount can be set.
     *
     * @param _setToken                     Address of the SetToken
     * @param _component                    Address of the SetToken component to trade
     * @param _minComponentReceived        Min amount of component received during trade
     */
    function tradeRemainingWETH(
        ISetToken _setToken,
        IERC20 _component,
        uint256 _minComponentReceived
    )
        external
        nonReentrant
        onlyAllowedTrader(_setToken)
        onlyEOAIfUnrestricted(_setToken)
        virtual
    {
        require(_noTokensToSell(_setToken), "Sell other set components first");
        require(
            executionInfo[_setToken][weth].targetUnit < _getDefaultPositionRealUnit(_setToken, weth),
            "WETH is below target unit"
        );

        _validateTradeParameters(_setToken, _component);

        TradeInfo memory tradeInfo = _createTradeRemainingInfo(_setToken, _component, _minComponentReceived);

        _executeTrade(tradeInfo);

        uint256 protocolFee = _accrueProtocolFee(tradeInfo);
        (uint256 netSendAmount, uint256 netReceiveAmount) = _updatePositionStateAndTimestamp(tradeInfo, _component);

        require(
            netReceiveAmount.add(protocolFee) < executionInfo[_setToken][_component].maxSize,
            "Trade amount > max trade size"
        );

        _validateComponentPositionUnit(_setToken, _component);

        emit TradeExecuted(
            tradeInfo.setToken,
            tradeInfo.sendToken,
            tradeInfo.receiveToken,
            tradeInfo.exchangeAdapter,
            msg.sender,
            netSendAmount,
            netReceiveAmount,
            protocolFee
        );
    }

    /**
     * ACCESS LIMITED: For situation where all target units met and remaining WETH, uniformly raise targets by same percentage by applying
     * to logged positionMultiplier in RebalanceInfo struct, in order to allow further trading. Can be called multiple times if necessary,
     * targets are increased by amount specified by raiseAssetTargetsPercentage as set by manager. In order to reduce tracking error
     * raising the target by a smaller amount allows greater granularity in finding an equilibrium between the excess ETH and components
     * that need to be bought. Raising the targets too much could result in vastly under allocating to WETH as more WETH than necessary is
     * spent buying the components to meet their new target.
     *
     * @param _setToken             Address of the SetToken
     */
    function raiseAssetTargets(ISetToken _setToken) external onlyAllowedTrader(_setToken) virtual {
        require(
            _allTargetsMet(_setToken)
            && _getDefaultPositionRealUnit(_setToken, weth) > _getNormalizedTargetUnit(_setToken, weth),
            "Targets not met or ETH =~ 0"
        );

        // positionMultiplier / (10^18 + raiseTargetPercentage)
        // ex: (10 ** 18) / ((10 ** 18) + ether(.0025)) => 997506234413965087
        rebalanceInfo[_setToken].positionMultiplier = rebalanceInfo[_setToken].positionMultiplier.preciseDiv(
            PreciseUnitMath.preciseUnit().add(rebalanceInfo[_setToken].raiseTargetPercentage)
        );
        emit AssetTargetsRaised(_setToken, rebalanceInfo[_setToken].positionMultiplier);
    }

    /**
     * MANAGER ONLY: Set trade maximums for passed components of the SetToken. Can be called at anytime.
     * Note: Trade maximums must be set before rebalance can begin properly - they are zero by
     * default and trades will not execute if a component's trade size is greater than the maximum.
     *
     * @param _setToken             Address of the SetToken
     * @param _components           Array of components
     * @param _tradeMaximums        Array of trade maximums mapping to correct component
     */
    function setTradeMaximums(
        ISetToken _setToken,
        address[] memory _components,
        uint256[] memory _tradeMaximums
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        _components.validatePairsWithArray(_tradeMaximums);

        for (uint256 i = 0; i < _components.length; i++) {
            executionInfo[_setToken][IERC20(_components[i])].maxSize = _tradeMaximums[i];
            emit TradeMaximumUpdated(_setToken, _components[i], _tradeMaximums[i]);
        }
    }

    /**
     * MANAGER ONLY: Set exchange for passed components of the SetToken. Can be called at anytime.
     *
     * @param _setToken             Address of the SetToken
     * @param _components           Array of components
     * @param _exchangeNames        Array of exchange names mapping to correct component
     */
    function setExchanges(
        ISetToken _setToken,
        address[] memory _components,
        string[] memory _exchangeNames
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        _components.validatePairsWithArray(_exchangeNames);

        for (uint256 i = 0; i < _components.length; i++) {
            if (_components[i] != address(weth)) {

                require(
                    controller.getIntegrationRegistry().isValidIntegration(address(this), _exchangeNames[i]),
                    "Unrecognized exchange name"
                );

                executionInfo[_setToken][IERC20(_components[i])].exchangeName = _exchangeNames[i];
                emit AssetExchangeUpdated(_setToken, _components[i], _exchangeNames[i]);
            }
        }
    }

    /**
     * MANAGER ONLY: Set cool off periods for passed components of the SetToken. Can be called at any time.
     *
     * @param _setToken             Address of the SetToken
     * @param _components           Array of components
     * @param _coolOffPeriods       Array of cool off periods to correct component
     */
    function setCoolOffPeriods(
        ISetToken _setToken,
        address[] memory _components,
        uint256[] memory _coolOffPeriods
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        _components.validatePairsWithArray(_coolOffPeriods);

        for (uint256 i = 0; i < _components.length; i++) {
            executionInfo[_setToken][IERC20(_components[i])].coolOffPeriod = _coolOffPeriods[i];
            emit CoolOffPeriodUpdated(_setToken, _components[i], _coolOffPeriods[i]);
        }
    }

    /**
     * MANAGER ONLY: Set arbitrary byte data on a per asset basis that can be used to pass exchange specific settings (i.e. specifying
     * fee tiers) or exchange specific features (enabling multi-hop trades). Can be called at any time.
     *
     * @param _setToken             Address of the SetToken
     * @param _components           Array of components
     * @param _exchangeData         Array of exchange specific arbitrary bytes data
     */
    function setExchangeData(
        ISetToken _setToken,
        address[] memory _components,
        bytes[] memory _exchangeData
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        _components.validatePairsWithArray(_exchangeData);

        for (uint256 i = 0; i < _components.length; i++) {
            executionInfo[_setToken][IERC20(_components[i])].exchangeData = _exchangeData[i];
            emit ExchangeDataUpdated(_setToken, _components[i], _exchangeData[i]);
        }
    }

    /**
     * MANAGER ONLY: Set amount by which all component's targets units would be raised. Can be called at any time.
     *
     * @param _setToken                     Address of the SetToken
     * @param _raiseTargetPercentage        Amount to raise all component's unit targets by (in precise units)
     */
    function setRaiseTargetPercentage(
        ISetToken _setToken,
        uint256 _raiseTargetPercentage
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        require(_raiseTargetPercentage > 0, "Target percentage must be > 0");
        rebalanceInfo[_setToken].raiseTargetPercentage = _raiseTargetPercentage;
        emit RaiseTargetPercentageUpdated(_setToken, _raiseTargetPercentage);
    }

    /**
     * MANAGER ONLY: Toggles ability for passed addresses to call trade() or tradeRemainingWETH(). Can be called at any time.
     *
     * @param _setToken          Address of the SetToken
     * @param _traders           Array trader addresses to toggle status
     * @param _statuses          Booleans indicating if matching trader can trade
     */
    function setTraderStatus(
        ISetToken _setToken,
        address[] memory _traders,
        bool[] memory _statuses
    )
        external
        onlyManagerAndValidSet(_setToken)
    {
        _traders.validatePairsWithArray(_statuses);

        for (uint256 i = 0; i < _traders.length; i++) {
            _updateTradersHistory(_setToken, _traders[i], _statuses[i]);
            permissionInfo[_setToken].tradeAllowList[_traders[i]] = _statuses[i];
            emit TraderStatusUpdated(_setToken, _traders[i], _statuses[i]);
        }
    }

    /**
     * MANAGER ONLY: Toggle whether anyone can trade, if true bypasses the traderAllowList. Can be called at anytime.
     *
     * @param _setToken         Address of the SetToken
     * @param _status           Boolean indicating if anyone can trade
     */
    function setAnyoneTrade(ISetToken _setToken, bool _status) external onlyManagerAndValidSet(_setToken) {
        permissionInfo[_setToken].anyoneTrade = _status;
        emit AnyoneTradeUpdated(_setToken, _status);
    }

    /**
     * MANAGER ONLY: Called to initialize module to SetToken in order to allow GeneralIndexModule access for rebalances.
     * Grabs the current units for each asset in the Set and set's the targetUnit to that unit in order to prevent any
     * trading until startRebalance() is explicitly called. Position multiplier is also logged in order to make sure any
     * position multiplier changes don't unintentionally open the Set for rebalancing.
     *
     * @param _setToken         Address of the Set Token
     */
    function initialize(ISetToken _setToken)
        external
        onlySetManager(_setToken, msg.sender)
        onlyValidAndPendingSet(_setToken)
    {
        ISetToken.Position[] memory positions = _setToken.getPositions();

        for (uint256 i = 0; i < positions.length; i++) {
            ISetToken.Position memory position = positions[i];
            require(position.positionState == 0, "External positions not allowed");
            executionInfo[_setToken][IERC20(position.component)].targetUnit = position.unit.toUint256();
            executionInfo[_setToken][IERC20(position.component)].lastTradeTimestamp = 0;
        }

        rebalanceInfo[_setToken].positionMultiplier = _setToken.positionMultiplier().toUint256();
        _setToken.initializeModule();
    }

    /**
     * Called by a SetToken to notify that this module was removed from the SetToken.
     * Clears the rebalanceInfo and permissionsInfo of the calling SetToken.
     * IMPORTANT: SetToken's execution settings, including trade maximums and exchange names,
     * are NOT DELETED. Restoring a previously removed module requires that care is taken to
     * initialize execution settings appropriately.
     */
    function removeModule() external override {
        TradePermissionInfo storage tokenPermissionInfo = permissionInfo[ISetToken(msg.sender)];

        for (uint i = 0; i < tokenPermissionInfo.tradersHistory.length; i++) {
            tokenPermissionInfo.tradeAllowList[tokenPermissionInfo.tradersHistory[i]] = false;
        }

        delete rebalanceInfo[ISetToken(msg.sender)];
        delete permissionInfo[ISetToken(msg.sender)];
    }

    /* ============ External View Functions ============ */

    /**
     * Get the array of SetToken components involved in rebalance.
     *
     * @param _setToken         Address of the SetToken
     *
     * @return address[]        Array of _setToken components involved in rebalance
     */
    function getRebalanceComponents(ISetToken _setToken)
        external
        view
        onlyValidAndInitializedSet(_setToken)
        returns (address[] memory)
    {
        return rebalanceInfo[_setToken].rebalanceComponents;
    }

    /**
     * Calculates the amount of a component that is going to be traded and whether the component is being bought
     * or sold. If currentUnit and targetUnit are the same, function will revert.
     *
     * @param _setToken                 Instance of the SetToken to rebalance
     * @param _component                IERC20 component to trade
     *
     * @return isSendTokenFixed         Boolean indicating fixed asset is send token
     * @return componentQuantity        Amount of component being traded
     */
    function getComponentTradeQuantityAndDirection(
        ISetToken _setToken,
        IERC20 _component
    )
        external
        view
        onlyValidAndInitializedSet(_setToken)
        returns (bool, uint256)
    {
        require(
            rebalanceInfo[_setToken].rebalanceComponents.contains(address(_component)),
            "Component not recognized"
        );
        uint256 totalSupply = _setToken.totalSupply();
        return _calculateTradeSizeAndDirection(_setToken, _component, totalSupply);
    }


    /**
     * Get if a given address is an allowed trader.
     *
     * @param _setToken         Address of the SetToken
     * @param _trader           Address of the trader
     *
     * @return bool             True if _trader is allowed to trade, else false
     */
    function getIsAllowedTrader(ISetToken _setToken, address _trader)
        external
        view
        onlyValidAndInitializedSet(_setToken)
        returns (bool)
    {
        return _isAllowedTrader(_setToken, _trader);
    }

    /**
     * Get the list of traders who are allowed to call trade(), tradeRemainingWeth(), and raiseAssetTarget()
     *
     * @param _setToken         Address of the SetToken
     *
     * @return address[]
     */
    function getAllowedTraders(ISetToken _setToken)
        external
        view
        onlyValidAndInitializedSet(_setToken)
        returns (address[] memory)
    {
        return permissionInfo[_setToken].tradersHistory;
    }

    /* ============ Internal Functions ============ */

    /**
     * A rebalance is a multi-step process in which current Set components are sold for a
     * bridge asset (WETH) before buying target components in the correct amount to achieve
     * the desired balance between elements in the set.
     *
     *        Step 1        |       Step 2
     * -------------------------------------------
     * Component --> WETH   |   WETH --> Component
     * -------------------------------------------
     *
     * The syntax we use frames this as trading from a "fixed" amount of one component to a
     * "fixed" amount of another via a "floating limit" which is *either* the maximum size of
     * the trade we want to make (trades may be tranched to avoid moving markets) OR the minimum
     * amount of tokens we expect to receive. The different meanings of the floating limit map to
     * the trade sequence as below:
     *
     * Step 1: Component --> WETH
     * ----------------------------------------------------------
     *                     | Fixed  |     Floating limit        |
     * ----------------------------------------------------------
     * send  (Component)   |  YES   |                           |
     * recieve (WETH)      |        |   Min WETH to receive     |
     * ----------------------------------------------------------
     *
     * Step 2: WETH --> Component
     * ----------------------------------------------------------
     *                     |  Fixed  |    Floating limit        |
     * ----------------------------------------------------------
     * send  (WETH)        |   NO    |  Max WETH to send        |
     * recieve (Component) |   YES   |                          |
     * ----------------------------------------------------------
     *
     * Additionally, there is an edge case where price volatility during a rebalance
     * results in remaining WETH which needs to be allocated proportionately. In this case
     * the values are as below:
     *
     * Edge case: Remaining WETH --> Component
     * ----------------------------------------------------------
     *                     | Fixed  |    Floating limit         |
     * ----------------------------------------------------------
     * send  (WETH)        |  YES   |                           |
     * recieve (Component) |        | Min component to receive  |
     * ----------------------------------------------------------
    */

    /**
     * Create and return TradeInfo struct. This function reverts if the target has already been met.
     * If this is a trade from component into WETH, sell the total fixed component quantity
     * and expect to receive an ETH amount the user has specified (or more). If it's a trade from
     * WETH into a component, sell the lesser of: the user's WETH limit OR the SetToken's
     * remaining WETH balance and expect to receive a fixed component quantity.
     *
     * @param _setToken             Instance of the SetToken to rebalance
     * @param _component            IERC20 component to trade
     * @param _ethQuantityLimit     Max/min amount of weth spent/received during trade
     *
     * @return tradeInfo            Struct containing data for trade
     */
    function _createTradeInfo(
        ISetToken _setToken,
        IERC20 _component,
        uint256 _ethQuantityLimit
    )
        internal
        view
        virtual
        returns (TradeInfo memory tradeInfo)
    {
        tradeInfo = _getDefaultTradeInfo(_setToken, _component, true);

        if (tradeInfo.isSendTokenFixed){
            tradeInfo.sendQuantity = tradeInfo.totalFixedQuantity;
            tradeInfo.floatingQuantityLimit = _ethQuantityLimit;
        } else {
            tradeInfo.sendQuantity = _ethQuantityLimit.min(tradeInfo.preTradeSendTokenBalance);
            tradeInfo.floatingQuantityLimit = tradeInfo.totalFixedQuantity;
        }
    }

    /**
     * Create and return TradeInfo struct. This function does NOT check if the WETH target has been met.
     *
     * @param _setToken                     Instance of the SetToken to rebalance
     * @param _component                    IERC20 component to trade
     * @param _minComponentReceived         Min amount of component received during trade
     *
     * @return tradeInfo                    Struct containing data for tradeRemaining info
     */
    function _createTradeRemainingInfo(
        ISetToken _setToken,
        IERC20 _component,
        uint256 _minComponentReceived
    )
        internal
        view
        returns (TradeInfo memory tradeInfo)
    {
        tradeInfo = _getDefaultTradeInfo(_setToken, _component, false);

        (,,
            uint256 currentNotional,
            uint256 targetNotional
        ) = _getUnitsAndNotionalAmounts(_setToken, weth, tradeInfo.setTotalSupply);

        tradeInfo.sendQuantity =  currentNotional.sub(targetNotional);
        tradeInfo.floatingQuantityLimit = _minComponentReceived;
        tradeInfo.isSendTokenFixed = true;
    }

    /**
     * Create and returns a partial TradeInfo struct with all fields that overlap between `trade`
     * and `tradeRemaining` info constructors filled in. Values for `sendQuantity` and `floatingQuantityLimit`
     * are derived separately, outside this method. `trade` requires that trade size and direction are
     * calculated, whereas `tradeRemaining` automatically sets WETH as the sendToken and _component
     * as receiveToken.
     *
     * @param _setToken                     Instance of the SetToken to rebalance
     * @param _component                    IERC20 component to trade
     * @param  calculateTradeDirection      Indicates whether method should calculate trade size and direction
     *
     * @return tradeInfo                    Struct containing partial data for trade
     */
    function _getDefaultTradeInfo(ISetToken _setToken, IERC20 _component, bool calculateTradeDirection)
        internal
        view
        returns (TradeInfo memory tradeInfo)
    {
        tradeInfo.setToken = _setToken;
        tradeInfo.setTotalSupply = _setToken.totalSupply();
        tradeInfo.exchangeAdapter = _getExchangeAdapter(_setToken, _component);
        tradeInfo.exchangeData = executionInfo[_setToken][_component].exchangeData;

        if(calculateTradeDirection){
            (
                tradeInfo.isSendTokenFixed,
                tradeInfo.totalFixedQuantity
            ) = _calculateTradeSizeAndDirection(_setToken, _component, tradeInfo.setTotalSupply);
        }

        if (tradeInfo.isSendTokenFixed){
            tradeInfo.sendToken = address(_component);
            tradeInfo.receiveToken = address(weth);
        } else {
            tradeInfo.sendToken = address(weth);
            tradeInfo.receiveToken = address(_component);
        }

        tradeInfo.preTradeSendTokenBalance = IERC20(tradeInfo.sendToken).balanceOf(address(_setToken));
        tradeInfo.preTradeReceiveTokenBalance = IERC20(tradeInfo.receiveToken).balanceOf(address(_setToken));
    }

    /**
     * Function handles all interactions with exchange. All GeneralIndexModule adapters must allow for selling or buying a fixed
     * quantity of a token in return for a non-fixed (floating) quantity of a token. If `isSendTokenFixed` is true then the adapter
     * will choose the exchange interface associated with inputting a fixed amount, otherwise it will select the interface used for
     * receiving a fixed amount. Any other exchange specific data can also be created by calling generateDataParam function.
     *
     * @param _tradeInfo            Struct containing trade information used in internal functions
     */
    function _executeTrade(TradeInfo memory _tradeInfo) internal virtual {
        _tradeInfo.setToken.invokeApprove(
            _tradeInfo.sendToken,
            _tradeInfo.exchangeAdapter.getSpender(),
            _tradeInfo.sendQuantity
        );

        (
            address targetExchange,
            uint256 callValue,
            bytes memory methodData
        ) = _tradeInfo.exchangeAdapter.getTradeCalldata(
            _tradeInfo.sendToken,
            _tradeInfo.receiveToken,
            address(_tradeInfo.setToken),
            _tradeInfo.isSendTokenFixed,
            _tradeInfo.sendQuantity,
            _tradeInfo.floatingQuantityLimit,
            _tradeInfo.exchangeData
        );

        _tradeInfo.setToken.invoke(targetExchange, callValue, methodData);
    }

    /**
     * Retrieve fee from controller and calculate total protocol fee and send from SetToken to protocol recipient.
     * The protocol fee is collected from the amount of received token in the trade.
     *
     * @param _tradeInfo                Struct containing trade information used in internal functions
     *
     * @return protocolFee              Amount of receive token taken as protocol fee
     */
    function _accrueProtocolFee(TradeInfo memory _tradeInfo) internal returns (uint256 protocolFee) {
        uint256 exchangedQuantity =  IERC20(_tradeInfo.receiveToken)
            .balanceOf(address(_tradeInfo.setToken))
            .sub(_tradeInfo.preTradeReceiveTokenBalance);

        protocolFee = getModuleFee(GENERAL_INDEX_MODULE_PROTOCOL_FEE_INDEX, exchangedQuantity);
        payProtocolFeeFromSetToken(_tradeInfo.setToken, _tradeInfo.receiveToken, protocolFee);
    }

    /**
     * Update SetToken positions and executionInfo's last trade timestamp. This function is intended
     * to be called after the fees have been accrued, hence it returns the amount of tokens bought net of fees.
     *
     * @param _tradeInfo                Struct containing trade information used in internal functions
     * @param _component                IERC20 component which was traded
     *
     * @return netSendAmount            Amount of sendTokens used in the trade
     * @return netReceiveAmount         Amount of receiveTokens received in the trade (net of fees)
     */
    function _updatePositionStateAndTimestamp(TradeInfo memory _tradeInfo, IERC20 _component)
        internal
        returns (uint256 netSendAmount, uint256 netReceiveAmount)
    {
        (uint256 postTradeSendTokenBalance,,) = _tradeInfo.setToken.calculateAndEditDefaultPosition(
            _tradeInfo.sendToken,
            _tradeInfo.setTotalSupply,
            _tradeInfo.preTradeSendTokenBalance
        );
        (uint256 postTradeReceiveTokenBalance,,) = _tradeInfo.setToken.calculateAndEditDefaultPosition(
            _tradeInfo.receiveToken,
            _tradeInfo.setTotalSupply,
            _tradeInfo.preTradeReceiveTokenBalance
        );

        netSendAmount = _tradeInfo.preTradeSendTokenBalance.sub(postTradeSendTokenBalance);
        netReceiveAmount = postTradeReceiveTokenBalance.sub(_tradeInfo.preTradeReceiveTokenBalance);

        executionInfo[_tradeInfo.setToken][_component].lastTradeTimestamp = block.timestamp;
    }

    /**
     * Adds or removes newly permissioned trader to/from permissionsInfo traderHistory. It's
     * necessary to verify that traderHistory contains the address because AddressArrayUtils will
     * throw when attempting to remove a non-element and it's possible someone can set a new
     * trader's status to false.
     *
     * @param _setToken                         Instance of the SetToken
     * @param _trader                           Trader whose permission is being set
     * @param _status                           Boolean permission being set

     */
    function _updateTradersHistory(ISetToken _setToken, address _trader, bool _status) internal {
        if (_status && !permissionInfo[_setToken].tradersHistory.contains(_trader)) {
            permissionInfo[_setToken].tradersHistory.push(_trader);
        } else if(!_status && permissionInfo[_setToken].tradersHistory.contains(_trader)) {
            permissionInfo[_setToken].tradersHistory.removeStorage(_trader);
        }
    }

    /**
     * Calculates the amount of a component is going to be traded and whether the component is being bought or sold.
     * If currentUnit and targetUnit are the same, function will revert.
     *
     * @param _setToken                 Instance of the SetToken to rebalance
     * @param _component                IERC20 component to trade
     * @param _totalSupply              Total supply of _setToken
     *
     * @return isSendTokenFixed         Boolean indicating fixed asset is send token
     * @return totalFixedQuantity       Amount of fixed token to send or receive
     */
    function _calculateTradeSizeAndDirection(
        ISetToken _setToken,
        IERC20 _component,
        uint256 _totalSupply
    )
        internal
        view
        returns (bool isSendTokenFixed, uint256 totalFixedQuantity)
    {
        uint256 protocolFee = controller.getModuleFee(address(this), GENERAL_INDEX_MODULE_PROTOCOL_FEE_INDEX);
        uint256 componentMaxSize = executionInfo[_setToken][_component].maxSize;

        (
            uint256 currentUnit,
            uint256 targetUnit,
            uint256 currentNotional,
            uint256 targetNotional
        ) = _getUnitsAndNotionalAmounts(_setToken, _component, _totalSupply);

        require(currentUnit != targetUnit, "Target already met");

        isSendTokenFixed = targetNotional < currentNotional;

        // In order to account for fees taken by protocol when buying the notional difference between currentUnit
        // and targetUnit is divided by (1 - protocolFee) to make sure that targetUnit can be met. Failure to
        // do so would lead to never being able to meet target of components that need to be bought.
        //
        // ? - lesserOf: (componentMaxSize, (currentNotional - targetNotional))
        // : - lesserOf: (componentMaxSize, (targetNotional - currentNotional) / 10 ** 18 - protocolFee)
        totalFixedQuantity = isSendTokenFixed
            ? componentMaxSize.min(currentNotional.sub(targetNotional))
            : componentMaxSize.min(targetNotional.sub(currentNotional).preciseDiv(PreciseUnitMath.preciseUnit().sub(protocolFee)));
    }

    /**
     * Check if all targets are met.
     *
     * @param _setToken             Instance of the SetToken to be rebalanced
     *
     * @return bool                 True if all component's target units have been met, otherwise false
     */
    function _allTargetsMet(ISetToken _setToken) internal view returns (bool) {
        address[] memory rebalanceComponents = rebalanceInfo[_setToken].rebalanceComponents;

        for (uint256 i = 0; i < rebalanceComponents.length; i++) {
            if (_targetUnmet(_setToken, rebalanceComponents[i])) { return false; }
        }
        return true;
    }

    /**
     * Determine if passed address is allowed to call trade for the SetToken. If anyoneTrade set to true anyone can call otherwise
     * needs to be approved.
     *
     * @param _setToken             Instance of SetToken to be rebalanced
     * @param  _trader              Address of the trader who called contract function
     *
     * @return bool                 True if trader is an approved trader for the SetToken
     */
    function _isAllowedTrader(ISetToken _setToken, address _trader) internal view returns (bool) {
        TradePermissionInfo storage permissions = permissionInfo[_setToken];
        return permissions.anyoneTrade || permissions.tradeAllowList[_trader];
    }

    /**
     * Checks if sell conditions are met. The component cannot be WETH and its normalized target
     * unit must be less than its default position real unit
     *
     * @param _setToken                         Instance of the SetToken to be rebalanced
     * @param _component                        Component evaluated for sale
     *
     * @return bool                             True if sell allowed, false otherwise
     */
    function _canSell(ISetToken _setToken, address _component) internal view returns(bool) {
        return (
            _component != address(weth) &&
            (
                _getNormalizedTargetUnit(_setToken, IERC20(_component)) <
                _getDefaultPositionRealUnit(_setToken,IERC20(_component))
            )
        );
    }

    /**
     * Check if there are any more tokens to sell. Since we allow WETH to float around it's target during rebalances it is not checked.
     *
     * @param _setToken             Instance of the SetToken to be rebalanced
     *
     * @return bool                 True if there is not any component that can be sold, otherwise false
     */
    function _noTokensToSell(ISetToken _setToken) internal view returns (bool) {
        address[] memory rebalanceComponents = rebalanceInfo[_setToken].rebalanceComponents;

        for (uint256 i = 0; i < rebalanceComponents.length; i++) {
            if (_canSell(_setToken, rebalanceComponents[i]) ) { return false; }
        }
        return true;
    }

    /**
     * Determines if a target is met. Due to small rounding errors converting between virtual and
     * real unit on SetToken we allow for a 1 wei buffer when checking if target is met. In order to
     * avoid subtraction overflow errors targetUnits of zero check for an exact amount. WETH is not
     * checked as it is allowed to float around its target.
     *
     * @param _setToken                         Instance of the SetToken to be rebalanced
     * @param _component                        Component whose target is evaluated
     *
     * @return bool                             True if component's target units are met, false otherwise
     */
    function _targetUnmet(ISetToken _setToken, address _component) internal view returns(bool) {
        if (_component == address(weth)) return false;

        uint256 normalizedTargetUnit = _getNormalizedTargetUnit(_setToken, IERC20(_component));
        uint256 currentUnit = _getDefaultPositionRealUnit(_setToken, IERC20(_component));

        return (normalizedTargetUnit > 0)
            ? !(normalizedTargetUnit.approximatelyEquals(currentUnit, 1))
            : normalizedTargetUnit != currentUnit;
    }

    /**
     * Validate component position unit has not exceeded it's target unit. This is used during tradeRemainingWETH() to make sure
     * the amount of component bought does not exceed the targetUnit.
     *
     * @param _setToken         Instance of the SetToken
     * @param _component        IERC20 component whose position units are to be validated
     */
    function _validateComponentPositionUnit(ISetToken _setToken, IERC20 _component) internal view {
        uint256 currentUnit = _getDefaultPositionRealUnit(_setToken, _component);
        uint256 targetUnit = _getNormalizedTargetUnit(_setToken, _component);
        require(currentUnit <= targetUnit, "Can not exceed target unit");
    }

    /**
     * Validate that component is a valid component and enough time has elapsed since component's last trade. Traders
     * cannot explicitly trade WETH, it may only implicitly be traded by being the quote asset for other component trades.
     *
     * @param _setToken         Instance of the SetToken
     * @param _component        IERC20 component to be validated
     */
    function _validateTradeParameters(ISetToken _setToken, IERC20 _component) internal view virtual {
        require(address(_component) != address(weth), "Can not explicitly trade WETH");
        require(
            rebalanceInfo[_setToken].rebalanceComponents.contains(address(_component)),
            "Component not part of rebalance"
        );

        TradeExecutionParams memory componentInfo = executionInfo[_setToken][_component];
        require(
            componentInfo.lastTradeTimestamp.add(componentInfo.coolOffPeriod) <= block.timestamp,
            "Component cool off in progress"
        );

        require(!_setToken.hasExternalPosition(address(_component)), "External positions not allowed");
    }

    /**
     * Extends and/or updates the current component set and its target units with new components and targets,
     * Validates inputs, requiring that that new components and new target units arrays are the same size, and
     * that the number of old components target units matches the number of current components. Throws if
     * a duplicate component has been added.
     *
     * @param  _currentComponents               Complete set of current SetToken components
     * @param _newComponents                    Array of new components to add to allocation
     * @param _newComponentsTargetUnits         Array of target units at end of rebalance for new components, maps to same index of _newComponents array
     * @param _oldComponentsTargetUnits         Array of target units at end of rebalance for old component, maps to same index of
     *                                               _setToken.getComponents() array, if component being removed set to 0.
     *
     * @return aggregateComponents              Array of current components extended by new components, without duplicates
     * @return aggregateTargetUnits             Array of old component target units extended by new target units, without duplicates
     */
    function _getAggregateComponentsAndUnits(
        address[] memory _currentComponents,
        address[] calldata _newComponents,
        uint256[] calldata _newComponentsTargetUnits,
        uint256[] calldata _oldComponentsTargetUnits
    )
        internal
        pure
        returns (address[] memory aggregateComponents, uint256[] memory aggregateTargetUnits)
    {
        // Don't use validate arrays because empty arrays are valid
        require(_newComponents.length == _newComponentsTargetUnits.length, "Array length mismatch");
        require(_currentComponents.length == _oldComponentsTargetUnits.length, "Old Components targets missing");

        aggregateComponents = _currentComponents.extend(_newComponents);
        aggregateTargetUnits = _oldComponentsTargetUnits.extend(_newComponentsTargetUnits);

        require(!aggregateComponents.hasDuplicate(), "Cannot duplicate components");
    }

    /**
     * Get the SetToken's default position as uint256
     *
     * @param _setToken         Instance of the SetToken
     * @param _component        IERC20 component to fetch the default position for
     *
     * return uint256           Real unit position
     */
    function _getDefaultPositionRealUnit(ISetToken _setToken, IERC20 _component) internal view returns (uint256) {
        return _setToken.getDefaultPositionRealUnit(address(_component)).toUint256();
    }

    /**
     * Gets exchange adapter address for a component after checking that it exists in the
     * IntegrationRegistry. This method is called during a trade and must validate the adapter
     * because its state may have changed since it was set in a separate transaction.
     *
     * @param _setToken                         Instance of the SetToken to be rebalanced
     * @param _component                        IERC20 component whose exchange adapter is fetched
     *
     * @return IExchangeAdapter                 Adapter address
     */
    function _getExchangeAdapter(ISetToken _setToken, IERC20 _component) internal view returns(IIndexExchangeAdapter) {
        return IIndexExchangeAdapter(getAndValidateAdapter(executionInfo[_setToken][_component].exchangeName));
    }

    /**
     * Calculates and returns the normalized target unit value.
     *
     * @param _setToken             Instance of the SetToken to be rebalanced
     * @param _component            IERC20 component whose normalized target unit is required
     *
     * @return uint256                          Normalized target unit of the component
     */
    function _getNormalizedTargetUnit(ISetToken _setToken, IERC20 _component) internal view returns(uint256) {
        // (targetUnit * current position multiplier) / position multiplier when rebalance started
        return executionInfo[_setToken][_component]
            .targetUnit
            .mul(_setToken.positionMultiplier().toUint256())
            .div(rebalanceInfo[_setToken].positionMultiplier);
    }

    /**
     * Gets unit and notional amount values for current position and target. These are necessary
     * to calculate the trade size and direction for regular trades and the `sendQuantity` for
     * remainingWEth trades.
     *
     * @param _setToken                 Instance of the SetToken to rebalance
     * @param _component                IERC20 component to calculate notional amounts for
     * @param _totalSupply              SetToken total supply
     *
     * @return uint256              Current default position real unit of component
     * @return uint256              Normalized unit of the trade target
     * @return uint256              Current notional amount: total notional amount of SetToken default position
     * @return uint256              Target notional amount: Total SetToken supply * targetUnit
     */
    function _getUnitsAndNotionalAmounts(ISetToken _setToken, IERC20 _component, uint256 _totalSupply)
        internal
        view
        returns (uint256, uint256, uint256, uint256)
    {
        uint256 currentUnit = _getDefaultPositionRealUnit(_setToken, _component);
        uint256 targetUnit = _getNormalizedTargetUnit(_setToken, _component);

        return (
            currentUnit,
            targetUnit,
            _totalSupply.getDefaultTotalNotional(currentUnit),
            _totalSupply.preciseMulCeil(targetUnit)
        );
    }

    /* ============== Modifier Helpers ===============
     * Internal functions used to reduce bytecode size
     */

    /*
     * Trader must be permissioned for SetToken
     */
    function _validateOnlyAllowedTrader(ISetToken _setToken) internal view {
        require(_isAllowedTrader(_setToken, msg.sender), "Address not permitted to trade");
    }

    /*
     * Trade must be an EOA if `anyoneTrade` has been enabled for SetToken on the module.
     */
    function _validateOnlyEOAIfUnrestricted(ISetToken _setToken) internal view {
        if(permissionInfo[_setToken].anyoneTrade) {
            require(msg.sender == tx.origin, "Caller must be EOA Address");
        }
    }
}
