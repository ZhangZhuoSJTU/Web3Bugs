// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { HubbleBase } from "./legos/HubbleBase.sol";
import {
    ERC20Detailed,
    IClearingHouse,
    IInsuranceFund,
    IOracle,
    IRegistry,
    IMarginAccount,
    IERC20FlexibleSupply
} from "./Interfaces.sol";

/**
* @title This contract is used for posting margin (collateral), realizing PnL etc.
* @notice Most notable operations include addMargin, removeMargin and liquidations
*/
contract MarginAccount is IMarginAccount, HubbleBase {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using SafeCast for int256;

    // Hubble vUSD is necessitated to be the first whitelisted collateral
    uint constant VUSD_IDX = 0;

    // used for all usd based values
    uint constant PRECISION = 1e6;

    error NOT_LIQUIDATABLE(IMarginAccount.LiquidationStatus);

    /**
    * @dev This is only used to group variables to avoid a solidity stack too deep error
    *   incentivePerDollar How many $ liquidator gets for each $ they repay e.g. they might get $1.05 for every $1 liquidation. >= PRECISION
    *   repayAble The maximum debt that can be settled for an account undergoing a liquidation
    *   priceCollateral Most recent oracle price (chainlink) of the collateral that is being seized for an account undergoing a liquidation
    *   decimals Decimals for the collateral being seized
    */
    struct LiquidationBuffer {
        LiquidationStatus status;
        uint8 decimals;
        uint incentivePerDollar;
        uint repayAble;
        uint priceCollateral;
    }

    /* ****************** */
    /*       Storage      */
    /* ****************** */

    IClearingHouse public clearingHouse;
    IOracle public oracle;
    IInsuranceFund public insuranceFund;
    IERC20FlexibleSupply public vusd;
    uint public credit;

    /// @notice Array of supported collateral
    Collateral[] public supportedCollateral;

    /**
    * @notice How many $ liquidator gets for each $ they repay e.g. they might get $1.05 for every $1 liquidation
    * @dev In the above scenario, this value will be %0.05 i.e. 5 cents incentive per dollar repayed
    */
    uint public liquidationIncentive;

    /**
    * @notice Maps index in supportedCollateral => trader => balance
    * @dev equivalent to margin(uint idx, address user)
    */
    mapping(uint => mapping(address => int)) override public margin;

    uint256[50] private __gap;

    /* ****************** */
    /*       Events       */
    /* ****************** */

    /// @notice Emitted when user adds margin for any of the supported collaterals
    event MarginAdded(address indexed trader, uint256 indexed idx, uint amount, uint256 timestamp);

    /// @notice Emitted when user removes margin for any of the supported collaterals
    event MarginRemoved(address indexed trader, uint256 indexed idx, uint256 amount, uint256 timestamp);

    /**
    * @notice Mutates trader's vUSD balance
    * @param trader Account who is realizing PnL
    * @param realizedPnl Increase or decrease trader's vUSD balace by. +ve/-ve value means vUSD is added/removed respectively from trader's margin
    */
    event PnLRealized(address indexed trader, int256 realizedPnl, uint256 timestamp);

    /**
    * @notice Emitted when a trader's margin account is liquidated i.e. their vUSD debt is repayed in exchange for their collateral
    * @param trader Trader whose margin account was liquidated
    * @param idx Index of the collateral that was seized during the liquidation
    * @param seizeAmount Amount of the collateral that was seized during the liquidation
    * @param repayAmount The debt that was repayed
    */
    event MarginAccountLiquidated(address indexed trader, uint indexed idx, uint seizeAmount, uint repayAmount, uint256 timestamp);

    /**
    * @notice Emitted when funds from insurance fund are tasked to settle system's bad debt
    * @param trader Account for which the bad debt was settled
    * @param seized Collateral amounts that were seized
    * @param repayAmount Debt that was settled. it's exactly equal to -vUSD when vUSD < 0
    */
    event SettledBadDebt(address indexed trader, uint[] seized, uint repayAmount, uint256 timestamp);

    modifier onlyClearingHouse() {
        require(_msgSender() == address(clearingHouse), "Only clearingHouse");
        _;
    }

    constructor(address _trustedForwarder) HubbleBase(_trustedForwarder) {}

    function initialize(
        address _governance,
        address _vusd
    ) external initializer {
        _setGovernace(_governance);
        _addCollateral(_vusd, PRECISION); // weight = 1 * PRECISION
        vusd = IERC20FlexibleSupply(_vusd);
    }

    /* ****************** */
    /*       Margin       */
    /* ****************** */

    /**
    * @notice Post margin
    * @param idx Index of the supported collateral
    * @param amount Amount to deposit (scaled same as the asset)
    */
    function addMargin(uint idx, uint amount) override external whenNotPaused {
        addMarginFor(idx, amount, _msgSender());
    }

    /**
    * @notice Post margin for another account
    * @param idx Index of the supported collateral
    * @param amount Amount to deposit (scaled same as the asset)
    * @param to Account to post margin for
    */
    function addMarginFor(uint idx, uint amount, address to) override public whenNotPaused {
        require(amount > 0, "Add non-zero margin");
        // will revert for idx >= supportedCollateral.length
        if (idx == VUSD_IDX) {
            _transferInVusd(_msgSender(), amount);
        } else {
            supportedCollateral[idx].token.safeTransferFrom(_msgSender(), address(this), amount);
        }
        margin[idx][to] += amount.toInt256();
        emit MarginAdded(to, idx, amount, _blockTimestamp());
    }

    /**
    * @notice Withdraw margin.
    *   Collateral can not be withdrawn if vUSD balance is < 0.
    * @dev If the contract has insufficient vUSD balance, a loan is taken from the vUSD contract.
    * @param idx Index of the supported collateral
    * @param amount Amount to withdraw (scaled same as the asset)
    */
    function removeMargin(uint idx, uint256 amount) override external whenNotPaused {
        address trader = _msgSender();

        // credit funding payments
        clearingHouse.updatePositions(trader);

        require(margin[VUSD_IDX][trader] >= 0, "Cannot remove margin when vusd balance is negative");
        require(margin[idx][trader] >= amount.toInt256(), "Insufficient balance");

        margin[idx][trader] -= amount.toInt256();

        // Check minimum margin requirement after withdrawal
        require(clearingHouse.isAboveMinAllowableMargin(trader), "MA.removeMargin.Below_MM");

        if (idx == VUSD_IDX) {
            _transferOutVusd(trader, amount);
        } else {
            supportedCollateral[idx].token.safeTransfer(trader, amount);
        }
        emit MarginRemoved(trader, idx, amount, _blockTimestamp());
    }

    /**
    * @notice Invoked to realize PnL, credit/debit funding payments, pay trade and liquidation fee
    * @dev Will only make a change to VUSD balance.
    *   only clearingHouse is authorized to call.
    * @param trader Account to realize PnL for
    * @param realizedPnl Amount to credit/debit
    */
    function realizePnL(address trader, int256 realizedPnl)
        override
        external
        onlyClearingHouse
    {
        // -ve PnL will reduce balance
        if (realizedPnl != 0) {
            margin[VUSD_IDX][trader] += realizedPnl;
            emit PnLRealized(trader, realizedPnl, _blockTimestamp());
        }
    }

    function transferOutVusd(address recipient, uint amount)
        override
        external
        onlyClearingHouse
    {
        _transferOutVusd(recipient, amount);
    }

    /* ****************** */
    /*    Liquidations    */
    /* ****************** */

    /**
    * @notice Determines if a trader's margin account can be liquidated now
    * @param trader Account to check liquidation status for
    * @param includeFunding whether to include funding payments before checking liquidation status
    * @return _isLiquidatable Whether the account can be liquidated; reason if not
    * @return repayAmount Trader's debt i.e. the max amount that they can be liquidated for
    * @return incentivePerDollar How many $ liquidator gets for each $ they repay
    *   e.g. they might get $1.05 for every $1 that is repayed.
    */
    function isLiquidatable(address trader, bool includeFunding)
        override
        public
        view
        returns(IMarginAccount.LiquidationStatus _isLiquidatable, uint repayAmount, uint incentivePerDollar)
    {
        int vusdBal = margin[VUSD_IDX][trader];
        if (includeFunding) {
            vusdBal -= clearingHouse.getTotalFunding(trader);
        }
        if (vusdBal >= 0) { // nothing to liquidate
            return (IMarginAccount.LiquidationStatus.NO_DEBT, 0, 0);
        }

        (uint256 notionalPosition,) = clearingHouse.getTotalNotionalPositionAndUnrealizedPnl(trader);
        if (notionalPosition != 0) { // Liquidate positions before liquidating margin account
            return (IMarginAccount.LiquidationStatus.OPEN_POSITIONS, 0, 0);
        }

        (int256 weighted, int256 spot) = weightedAndSpotCollateral(trader);
        if (weighted >= 0) {
            return (IMarginAccount.LiquidationStatus.ABOVE_THRESHOLD, 0, 0);
        }

        // _isLiquidatable = IMarginAccount.LiquidationStatus.IS_LIQUIDATABLE;
        repayAmount = (-vusdBal).toUint256();
        incentivePerDollar = PRECISION; // get atleast $1 worth of collateral for every $1 paid

        if (spot > 0) {
            /**
                Liquidation scenario B, where Cw < |vUSD| < Cusd
                => Cw - |vUSD| < 0
                => Cw + vUSD (=weighted) < 0; since vUSD < 0
                Max possible liquidationIncentive (for repaying |vUSD|) is Cusd
            */
            incentivePerDollar += _min(
                liquidationIncentive, // incentivePerDollar = PRECISION + liquidationIncentive <= 1.1
                // divide up all the extra dollars in proportion to repay amount
                // note that spot value here is inclusive of the -ve vUSD value
                spot.toUint256() * PRECISION / repayAmount
            );
        } /* else {
            Since the protocol is already in deficit we don't have any money to give out as liquidationIncentive
            Liquidation scenario C, where Cusd <= |vUSD|
            => Cusd - |vUSD| <= 0
            => Cusd + vUSD (=spot) <= 0; since vUSD < 0

            @todo consider providing some incentive from insurance fund to execute a liquidation in this scenario.
            That fee is basically provided so that insurance fund has to settle a lower bad debt and seize lesser amount of assets.
            (because seized assets then need to sold/auctioned off, so that's extra work)
        } */
    }

    /**
    * @notice Liquidate a trader while mentioning the exact repay amount while capping "slippage" on the seized collateral
    *   This maybe be considered as a "swapExactInput" operation.
    *   It's required that trader has no open positions.
    * @param trader Account to liquidate
    * @param repay Amount to repay
    * @param idx Index of the collateral to seize
    * @param minSeizeAmount Min collateral output amount
    */
    function liquidateExactRepay(address trader, uint repay, uint idx, uint minSeizeAmount) external whenNotPaused {
        clearingHouse.updatePositions(trader); // credits/debits funding
        LiquidationBuffer memory buffer = _getLiquidationInfo(trader, idx);
        if (buffer.status != IMarginAccount.LiquidationStatus.IS_LIQUIDATABLE) {
            revert NOT_LIQUIDATABLE(buffer.status);
        }
        _liquidateExactRepay(buffer, trader, repay, idx, minSeizeAmount);
    }

    /**
    * @notice Liquidate a trader while mentioning the exact collateral amount to be seized while capping "slippage" on the repay amount.
    *   This maybe be considered as a "swapExactOutput" operation.
    *   It's required that trader has no open positions.
    * @param trader Account to liquidate
    * @param maxRepay Max vUSD input amount
    * @param idx Index of the collateral to seize
    * @param seize Exact collateral amount desired to be seized
    */
    function liquidateExactSeize(address trader, uint maxRepay, uint idx, uint seize) external whenNotPaused {
        clearingHouse.updatePositions(trader); // credits/debits funding
        LiquidationBuffer memory buffer = _getLiquidationInfo(trader, idx);
        if (buffer.status != IMarginAccount.LiquidationStatus.IS_LIQUIDATABLE) {
            revert NOT_LIQUIDATABLE(buffer.status);
        }
        _liquidateExactSeize(buffer, trader, maxRepay, idx, seize);
    }

    /**
    * @notice Either seize all available collateral
    *   OR settle debt completely with (most likely) left over collateral.
    *   It's required that trader has no open positions.
    *   Seized collateral at it's current oracle price should be acceptable to the liquidator.
    * @param trader Account to liquidate
    * @param maxRepay Max vUSD input amount
    * @param idxs Indices of the collateral to seize
    */
    function liquidateFlexible(address trader, uint maxRepay, uint[] calldata idxs) external whenNotPaused {
        clearingHouse.updatePositions(trader); // credits/debits funding
        uint repayed;
        for (uint i = 0; i < idxs.length; i++) {
            LiquidationBuffer memory buffer = _getLiquidationInfo(trader, idxs[i]);
            // revert only if trader has open positions, otherwise fail silently
            if (buffer.status == IMarginAccount.LiquidationStatus.OPEN_POSITIONS) {
                revert NOT_LIQUIDATABLE(buffer.status);
            }
            if (buffer.status != IMarginAccount.LiquidationStatus.IS_LIQUIDATABLE) {
                break;
            }
            repayed = _liquidateFlexible(trader, maxRepay, idxs[i]);
            maxRepay -= repayed;
        }
    }

    /**
    * @notice Invoke a bad debt settlement using the insurance fund.
    *   It's required that trader has no open positions when settling bad debt.
    * @dev Debt is said to be bad when the spot value of user's collateral is not enough to cover their -ve vUSD balance
    *   Since there are no open positions, debit/credit funding payments is not required.
    * @param trader Account for which the bad debt needs to be settled
    */
    function settleBadDebt(address trader) external whenNotPaused {
        (uint256 notionalPosition,) = clearingHouse.getTotalNotionalPositionAndUnrealizedPnl(trader);
        require(notionalPosition == 0, "Liquidate positions before settling bad debt");

        // The spot value of their collateral minus their vUSD obligation is a negative value
        require(getSpotCollateralValue(trader) < 0, "Above bad debt threshold");

        int vusdBal = margin[VUSD_IDX][trader];

        // this check is not strictly required because getSpotCollateralValue(trader) < 0 is a stronger assertion
        require(vusdBal < 0, "Nothing to repay");

        uint badDebt = (-vusdBal).toUint256();
        Collateral[] memory assets = supportedCollateral;

        // This pulls the obligation
        insuranceFund.seizeBadDebt(badDebt);
        margin[VUSD_IDX][trader] = 0;

        // Insurance fund gets all the available collateral
        uint[] memory seized = new uint[](assets.length);
        for (uint i = 1 /* skip vusd */; i < assets.length; i++) {
            int amount = margin[i][trader];
            if (amount > 0) {
                margin[i][trader] = 0;
                assets[i].token.safeTransfer(address(insuranceFund), amount.toUint256());
                seized[i] = amount.toUint256();
            }
        }
        emit SettledBadDebt(trader, seized, badDebt, _blockTimestamp());
    }

    /* ********************* */
    /* Liquidations Internal */
    /* ********************* */

    /**
    * @dev This function wil either seize all available collateral of type idx
    * OR settle debt completely with (most likely) left over collateral
    * @return Debt repayed <= repayble i.e. user's max debt
    */
    function _liquidateFlexible(address trader, uint maxRepay, uint idx) internal whenNotPaused returns(uint /* repayed */) {
        LiquidationBuffer memory buffer = _getLiquidationInfo(trader, idx);

        // Q. Can user's margin cover the entire debt?
        uint repay = _seizeToRepay(buffer, margin[idx][trader].toUint256());

        // A.1 Yes, it can cover the entire debt. Settle repayAble
        if (repay >= buffer.repayAble) {
            _liquidateExactRepay(
                buffer,
                trader,
                buffer.repayAble, // exact repay amount
                idx,
                0 // minSeizeAmount=0 implies accept whatever the oracle price is
            );
            return buffer.repayAble; // repayed exactly repayAble and 0 is left to repay now
        }

        // A.2 No, collateral can not cover the entire debt. Seize all of it.
        return _liquidateExactSeize(
            buffer,
            trader,
            maxRepay,
            idx,
            margin[idx][trader].toUint256()
        );
    }

    function _liquidateExactRepay(
        LiquidationBuffer memory buffer,
        address trader,
        uint repay,
        uint idx,
        uint minSeizeAmount
    )
        internal
        returns (uint seized)
    {
        // determine the seizable collateral amount on the basis of the most recent chainlink price feed
        seized = _min(
            _scaleDecimals(repay * buffer.incentivePerDollar, buffer.decimals - 6) / buffer.priceCollateral,
            // can't seize more than available
            // this also protects the liquidator in the scenario that they were front-run and only a small seize isn't worth it for them
            margin[idx][trader].toUint256()
        );
        require(seized >= minSeizeAmount, "Not seizing enough");
        _executeLiquidation(trader, repay, idx, seized, buffer.repayAble);
    }

    function _liquidateExactSeize(
        LiquidationBuffer memory buffer,
        address trader,
        uint maxRepay,
        uint idx,
        uint seize
    )
        internal
        returns (uint repay)
    {
        repay = _seizeToRepay(buffer, seize);
        require(repay <= maxRepay, "Need to repay more to seize that much");
        _executeLiquidation(trader, repay, idx, seize, buffer.repayAble);
    }

    /**
    * @dev reverts if margin account is not liquidatable
    */
    function _getLiquidationInfo(address trader, uint idx) internal view returns (LiquidationBuffer memory buffer) {
        require(idx > VUSD_IDX && idx < supportedCollateral.length, "collateral not seizable");
        (buffer.status, buffer.repayAble, buffer.incentivePerDollar) = isLiquidatable(trader, false);
        if (buffer.status == IMarginAccount.LiquidationStatus.IS_LIQUIDATABLE) {
            Collateral memory coll = supportedCollateral[idx];
            buffer.priceCollateral = oracle.getUnderlyingPrice(address(coll.token)).toUint256();
            buffer.decimals = coll.decimals;
        }
    }

    /**
    * @dev Peform the actual liquidation.
    *   1. Pull the repay amount from liquidator's account and credit trader's VUSD margin
    *   2. Debit the seize amount and transfer to liquidator
    * @return The debt that is leftover to be paid
    */
    function _executeLiquidation(address trader, uint repay, uint idx, uint seize, uint repayAble)
        internal
        returns (uint /* left over repayable */)
    {
        if (repay == 0 || seize == 0) { // provides more flexibility, so prefer not reverting
            return repayAble;
        }

        _transferInVusd(_msgSender(), repay);
        margin[VUSD_IDX][trader] += repay.toInt256();

        margin[idx][trader] -= seize.toInt256();
        supportedCollateral[idx].token.safeTransfer(_msgSender(), seize);

        emit MarginAccountLiquidated(trader, idx, seize, repay, _blockTimestamp());
        return repayAble - repay; // will ensure that the liquidator isn't repaying more than user's debt (and seizing a bigger amount of their collateral)
    }

    function _seizeToRepay(LiquidationBuffer memory buffer, uint seize) internal pure returns (uint repay) {
        repay = seize * buffer.priceCollateral / (10 ** buffer.decimals);
        if (buffer.incentivePerDollar > 0) {
            repay = repay * PRECISION / buffer.incentivePerDollar;
        }
    }

    /* ****************** */
    /*        View        */
    /* ****************** */

    function getSpotCollateralValue(address trader) override public view returns(int256 spot) {
        (,spot) = weightedAndSpotCollateral(trader);
    }

    function getNormalizedMargin(address trader) override public view returns(int256 weighted) {
        (weighted,) = weightedAndSpotCollateral(trader);
    }

    function weightedAndSpotCollateral(address trader)
        public
        view
        returns (int256 weighted, int256 spot)
    {
        Collateral[] memory assets = supportedCollateral;
        Collateral memory _collateral;

        for (uint i = 0; i < assets.length; i++) {
            _collateral = assets[i];

            int numerator = margin[i][trader] * oracle.getUnderlyingPrice(address(assets[i].token));
            uint denomDecimals = _collateral.decimals;

            spot += (numerator / int(10 ** denomDecimals));
            weighted += (numerator * _collateral.weight.toInt256() / int(10 ** (denomDecimals + 6)));
        }
    }

    /* ****************** */
    /*     UI Helpers     */
    /* ****************** */

    function supportedAssets() external view override returns (Collateral[] memory) {
        return supportedCollateral;
    }

    function supportedAssetsLen() override external view returns (uint) {
        return supportedCollateral.length;
    }

    /* ****************** */
    /*    Misc Internal   */
    /* ****************** */

    function _addCollateral(address _coin, uint _weight) internal {
        require(_weight <= PRECISION, "weight > 1e6");

        Collateral[] memory _collaterals = supportedCollateral;
        for (uint i = 0; i < _collaterals.length; i++) {
            require(address(_collaterals[i].token) != _coin, "collateral exists");
        }
        supportedCollateral.push(
            Collateral({
                token: IERC20(_coin),
                weight: _weight,
                decimals: ERC20Detailed(_coin).decimals() // will fail if .decimals() is not defined on the contract
            })
        );
    }

    function _scaleDecimals(uint256 amount, uint8 decimals) internal pure returns(uint256) {
        return amount * (10 ** decimals);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _transferInVusd(address from, uint amount) internal {
        IERC20(address(vusd)).safeTransferFrom(from, address(this), amount);
        if (credit > 0) {
            uint toBurn = Math.min(vusd.balanceOf(address(this)), credit);
            credit -= toBurn;
            vusd.burn(toBurn);
        }
    }

    function _transferOutVusd(address recipient, uint amount) internal {
        uint bal = vusd.balanceOf(address(this));
        if (bal < amount) {
            // Say there are 2 traders, Alice and Bob.
            // Alice has a profitable position and realizes their PnL in form of vusd margin.
            // But bob has not yet realized their -ve PnL.
            // In that case we'll take a credit from vusd contract, which will eventually be returned when Bob pays their debt back.
            uint _credit = amount - bal;
            credit += _credit;
            vusd.mint(address(this), _credit);
        }
        IERC20(address(vusd)).safeTransfer(recipient, amount);
    }

    /* ****************** */
    /*     Governance     */
    /* ****************** */

    function syncDeps(address _registry, uint _liquidationIncentive) public onlyGovernance {
        // protecting against setting a very high liquidation incentive. Max 10%
        require(_liquidationIncentive <= PRECISION / 10, "MA.syncDeps.LI_GT_10_percent");
        IRegistry registry = IRegistry(_registry);
        require(registry.marginAccount() == address(this), "Incorrect setup");

        clearingHouse = IClearingHouse(registry.clearingHouse());
        oracle = IOracle(registry.oracle());
        insuranceFund = IInsuranceFund(registry.insuranceFund());
        liquidationIncentive = _liquidationIncentive;
    }

    function whitelistCollateral(address _coin, uint _weight) external onlyGovernance {
        _addCollateral(_coin, _weight);
    }

    // function to change weight of an asset
    function changeCollateralWeight(uint idx, uint _weight) external onlyGovernance {
        require(_weight <= PRECISION, "weight > 1e6");
        require(idx < supportedCollateral.length, "Collateral not supported");
        supportedCollateral[idx].weight = _weight;
    }
}
