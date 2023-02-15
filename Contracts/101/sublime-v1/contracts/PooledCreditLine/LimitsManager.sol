// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/ILimitsManager.sol';
import '../interfaces/IPriceOracle.sol';

contract LimitsManager is OwnableUpgradeable, ILimitsManager {
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------//

    /**
     * @notice address of USDC token
     */
    address public immutable USDC;

    /**
     * @notice stores the address of price oracle contract
     **/
    IPriceOracle public immutable PRICE_ORACLE;

    //-------------------------------- Constants end --------------------------------//

    //-------------------------------- Variable limits starts --------------------------------//

    /*
     * @notice Used to set the min/max borrow limits for pooled credit lines
     * @dev IMPORTANT: the limit values are in USDC, so need to be converted to borrowAsset
            check how this is used in method _limitBorrowedInUSDC
     */
    Limits borrowAmountUSDCLimits;

    /*
     * @notice Used to set the min/max collateral ratio for pooled credit lines
     */
    Limits idealCollateralRatioLimits;

    /*
     * @notice Used to set the min/max borrow rate for pooled credit lines
     */
    Limits borrowRateLimits;

    /*
     * @notice Used to set the min/max collection period for pooled credit lines
     */
    Limits collectionPeriodLimits;

    /*
     * @notice Used to set the min/max duration of pooled credit lines
     */
    Limits durationLimits;

    /*
     * @notice Used to set the min/max grace period before default for pooled credit lines
     */
    Limits defaultGracePeriodLimits;

    /*
     * @notice Used to set the min/max Penalty rate during grace period for pooled credit lines
     */
    Limits gracePenaltyRateLimits;

    //-------------------------------- Variable limits ends --------------------------------//

    //--------------------------- Limits event start ---------------------------//

    /**
     * @notice emitted when thresholds for one of the parameters is updated
     * @param limitType specifies the parameter whose limits are being updated
     * @param min minimum threshold value for limitType
     * @param max maximum threshold value for limitType
     */
    event LimitsUpdated(string indexed limitType, uint256 min, uint256 max);

    //--------------------------- Limits event end ---------------------------//

    constructor(address _usdc, address _priceOracle) {
        require(_usdc != address(0), 'LM:CON1');
        require(_priceOracle != address(0), 'LM:CON2');
        USDC = _usdc;
        PRICE_ORACLE = IPriceOracle(_priceOracle);
    }

    /**
     * @notice used to initialize the contract
     * @dev can only be called once during the life cycle of the contract
     * @param _owner address of owner who can change global variables
     */
    function initialize(address _owner) external initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_owner);
    }

    //-------------------------------- Limits code starts --------------------------------//

    /**
     * @notice invoked to check if credit lines parameters are within thresholds
     * @dev min or max = 0 is considered as no limit set
     * @param _value supplied value of the parameter
     * @param _limits the limits to check
     */
    function isWithinLimits(uint256 _value, Limits memory _limits) public pure override returns (bool) {
        return (_value >= _limits.min && _value <= _limits.max);
    }

    /*
     * @notice checks if the _borrowLimit and _minBorrowAmount value is within the USDC limits set for the contract
     * @dev this method fetches the price of the borrowAsset in terms of USDC to convert the _borrowLimit and
     *      _minBorrowAmount values in to USDC and compare it with the limits set in the contract
     * @param _borrowAsset address of the borrow asset in the PCL request
     * @param _borrowLimit the maximum borrow amount for the PCL request
     * @param _minBorrowAmount the minimum borrow amount for the PCL request
     */
    function limitBorrowedInUSDC(
        address _borrowAsset,
        uint256 _borrowLimit,
        uint256 _minBorrowAmount
    ) public view override {
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(_borrowAsset, USDC);
        uint256 _maxBorrowAmountInUSDC = _borrowLimit.mul(_ratioOfPrices).div(10**_decimals);
        uint256 _borrowAmountUSDCLimitsMin = borrowAmountUSDCLimits.min;

        require(isWithinLimits(_maxBorrowAmountInUSDC, borrowAmountUSDCLimits), 'PCL:ILB1');

        require(_minBorrowAmount <= _borrowLimit, 'PCL:ILB2');
        uint256 _minBorrowAmountInUSDC = _minBorrowAmount.mul(_ratioOfPrices).div(10**_decimals);
        require(_minBorrowAmountInUSDC >= _borrowAmountUSDCLimitsMin, 'PCL:ILB3');
    }

    /**
     * @notice used to update the thresholds of the borrow limit of the pooled credit line
     * @param _min updated value of the minimum threshold value of the borrow limit in lowest units of USDC
     * @param _max updated value of the maximum threshold value of the borrow limit in lowest units of USDC
     */
    function updateBorrowAmountUSDCLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PCL:UBLL1');
        require(!(borrowAmountUSDCLimits.min == _min && borrowAmountUSDCLimits.max == _max), 'PCL:UBLL2');
        borrowAmountUSDCLimits = Limits(_min, _max);
        emit LimitsUpdated('borrowLimit', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the ideal collateral ratio of the pooled credit line
     * @param _min updated value of the minimum threshold value of the ideal collateral ratio
     * @param _max updated value of the maximum threshold value of the ideal collateral ratio
     */
    function updateIdealCollateralRatioLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PCL:UICRL1');
        require(!(idealCollateralRatioLimits.min == _min && idealCollateralRatioLimits.max == _max), 'PCL:UICRL2');
        idealCollateralRatioLimits = Limits(_min, _max);
        emit LimitsUpdated('idealCollateralRatio', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the borrow rate of the pooled credit line
     * @param _min updated value of the minimum threshold value of the borrow rate
     * @param _max updated value of the maximum threshold value of the borrow rate
     */
    function updateBorrowRateLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PCL:UBRL1');
        require(!(borrowRateLimits.min == _min && borrowRateLimits.max == _max), 'PCL:UBRL2');
        borrowRateLimits = Limits(_min, _max);
        emit LimitsUpdated('borrowRate', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the collection period of the pooled credit line
     * @param _min updated value of the minimum threshold value of the collection period
     * @param _max updated value of the maximum threshold value of the collection period
     */
    function updateCollectionPeriodLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PCL:UCPL1');
        require(!(collectionPeriodLimits.min == _min && collectionPeriodLimits.max == _max), 'PCL:UCPL2');
        collectionPeriodLimits = Limits(_min, _max);
        emit LimitsUpdated('collectionPeriod', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the duration of the pooled credit line
     * @param _min updated value of the minimum threshold value of the duration
     * @param _max updated value of the maximum threshold value of the duration
     */
    function updateDurationLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PCL:UDL1');
        require(!(durationLimits.min == _min && durationLimits.max == _max), 'PCL:UDL2');
        durationLimits = Limits(_min, _max);
        emit LimitsUpdated('duration', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the grace period after which pooled credit line defaults
     * @param _min updated value of the minimum threshold value of the default grace period
     * @param _max updated value of the maximum threshold value of the default grace period
     */
    function updateDefaultGracePeriodLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PCL:UDGPL1');
        require(!(defaultGracePeriodLimits.min == _min && defaultGracePeriodLimits.max == _max), 'PCL:UDGPL2');
        defaultGracePeriodLimits = Limits(_min, _max);
        emit LimitsUpdated('defaultGracePeriod', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the penalty rate in grace period of the pooled credit line
     * @param _min updated value of the minimum threshold value of the penalty rate in grace period
     * @param _max updated value of the maximum threshold value of the penalty rate in grace period
     */
    function updateGracePenaltyRateLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PCL:UGPRL1');
        require(!(gracePenaltyRateLimits.min == _min && gracePenaltyRateLimits.max == _max), 'PCL:UGPRL2');
        gracePenaltyRateLimits = Limits(_min, _max);
        emit LimitsUpdated('gracePenaltyRate', _min, _max);
    }

    //-------------------------------- Limits code end --------------------------------//

    //-------------------------------- getters start --------------------------------//

    function getIdealCollateralRatioLimits() external view override returns (Limits memory) {
        return idealCollateralRatioLimits;
    }

    function getBorrowRateLimits() external view override returns (Limits memory) {
        return borrowRateLimits;
    }

    function getCollectionPeriodLimits() external view override returns (Limits memory) {
        return collectionPeriodLimits;
    }

    function getDurationLimits() external view override returns (Limits memory) {
        return durationLimits;
    }

    function getDefaultGracePeriodLimits() external view override returns (Limits memory) {
        return defaultGracePeriodLimits;
    }

    function getGracePenaltyRateLimits() external view override returns (Limits memory) {
        return gracePenaltyRateLimits;
    }

    //-------------------------------- getters end --------------------------------//
}
