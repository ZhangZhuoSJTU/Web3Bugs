// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IPoolFactory.sol';
import '../interfaces/IRepayment.sol';

/**
 * @title Repayments contract
 * @dev For accuracy considering base itself as (10**30)
 * @notice Implements the functions related to repayments (payments that
 * have to made by the borrower back to the pool)
 * @author Sublime
 */
contract Repayments is Initializable, IRepayment, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 constant MAX_INT = 2**256 - 1;
    uint256 constant YEAR_IN_SECONDS = 365 days;

    IPoolFactory poolFactory;

    enum LoanStatus {
        COLLECTION, //denotes collection period
        ACTIVE, // denotes the active loan
        CLOSED, // Loan is repaid and closed
        CANCELLED, // Cancelled by borrower
        DEFAULTED, // Repaymennt defaulted by  borrower
        TERMINATED // Pool terminated by admin
    }

    uint256 gracePenaltyRate;
    uint256 gracePeriodFraction; // fraction of the repayment interval

    struct RepaymentVariables {
        uint256 repaidAmount;
        bool isLoanExtensionActive;
        uint256 loanDurationCovered;
        uint256 loanExtensionPeriod; // period for which the extension was granted, ie, if loanExtensionPeriod is 7 * 10**30, 7th instalment can be repaid by 8th instalment deadline
    }

    struct RepaymentConstants {
        uint256 numberOfTotalRepayments; // using it to check if RepaymentDetails Exists as repayment Interval!=0 in any case
        uint256 gracePenaltyRate;
        uint256 gracePeriodFraction;
        uint256 loanDuration;
        uint256 repaymentInterval;
        uint256 borrowRate;
        uint256 loanStartTime;
        address repayAsset;
    }

    /**
     * @notice used to maintain the variables related to repayment against a pool
     */
    mapping(address => RepaymentVariables) public repayVariables;

    /**
     * @notice used to maintain the constants related to repayment against a pool
     */
    mapping(address => RepaymentConstants) public repayConstants;

    /// @notice determines if the pool is active or not based on whether repayments have been started by the
    ///borrower for this particular pool or not
    /// @param _poolID address of the pool for which we want to test statu
    modifier isPoolInitialized(address _poolID) {
        require(repayConstants[_poolID].numberOfTotalRepayments != 0, 'Pool is not Initiliazed');
        _;
    }

    /// @notice modifier used to determine whether the current pool is valid or not
    /// @dev poolRegistry from IPoolFactory interface returns a bool
    modifier onlyValidPool() {
        require(poolFactory.poolRegistry(msg.sender), 'Repayments::onlyValidPool - Invalid Pool');
        _;
    }

    /**
     * @notice modifier used to check if msg.sender is the owner
     */
    modifier onlyOwner() {
        require(msg.sender == poolFactory.owner(), 'Not owner');
        _;
    }

    /// @notice Initializes the contract (similar to a constructor)
    /// @dev Since we cannot use constructors when using OpenZeppelin Upgrades, we use the initialize function
    ///and the initializer modifier makes sure that this function is called only once
    /// @param _poolFactory The address of the pool factory
    /// @param _gracePenaltyRate The penalty rate levied in the grace period
    /// @param _gracePeriodFraction The fraction of repayment interval that will be allowed as grace period
    function initialize(
        address _poolFactory,
        uint256 _gracePenaltyRate,
        uint256 _gracePeriodFraction
    ) external initializer {
        _updatePoolFactory(_poolFactory);
        _updateGracePenaltyRate(_gracePenaltyRate);
        _updateGracePeriodFraction(_gracePeriodFraction);
    }

    /**
     * @notice used to update pool factory address
     * @param _poolFactory address of pool factory contract
     */
    function updatePoolFactory(address _poolFactory) external onlyOwner {
        _updatePoolFactory(_poolFactory);
    }

    function _updatePoolFactory(address _poolFactory) internal {
        require(_poolFactory != address(0), '0 address not allowed');
        poolFactory = IPoolFactory(_poolFactory);
        emit PoolFactoryUpdated(_poolFactory);
    }

    /**
     * @notice used to update grace period as a fraction of repayment interval
     * @param _gracePeriodFraction updated value of gracePeriodFraction multiplied by 10**30
     */
    function updateGracePeriodFraction(uint256 _gracePeriodFraction) external onlyOwner {
        _updateGracePeriodFraction(_gracePeriodFraction);
    }

    function _updateGracePeriodFraction(uint256 _gracePeriodFraction) internal {
        gracePeriodFraction = _gracePeriodFraction;
        emit GracePeriodFractionUpdated(_gracePeriodFraction);
    }

    /**
     * @notice used to update grace penality rate
     * @param _gracePenaltyRate value of grace penality rate multiplied by 10**30
     */
    function updateGracePenaltyRate(uint256 _gracePenaltyRate) external onlyOwner {
        _updateGracePenaltyRate(_gracePenaltyRate);
    }

    function _updateGracePenaltyRate(uint256 _gracePenaltyRate) internal {
        gracePenaltyRate = _gracePenaltyRate;
        emit GracePenaltyRateUpdated(_gracePenaltyRate);
    }

    /// @notice For a valid pool, the repayment schedule is being initialized here
    /// @dev Imported from RepaymentStorage.sol repayConstants is a mapping(address => repayConstants)
    /// @param numberOfTotalRepayments The total number of repayments that will be required from the borrower
    /// @param repaymentInterval Intervals after which repayment will be due
    /// @param borrowRate The rate at which lending took place
    /// @param loanStartTime The starting time of the loan
    /// @param lentAsset The address of the asset that was lent (basically a ERC20 token address)
    function initializeRepayment(
        uint256 numberOfTotalRepayments,
        uint256 repaymentInterval,
        uint256 borrowRate,
        uint256 loanStartTime,
        address lentAsset
    ) external override onlyValidPool {
        repayConstants[msg.sender].gracePenaltyRate = gracePenaltyRate;
        repayConstants[msg.sender].gracePeriodFraction = gracePeriodFraction;
        repayConstants[msg.sender].numberOfTotalRepayments = numberOfTotalRepayments;
        repayConstants[msg.sender].loanDuration = repaymentInterval.mul(numberOfTotalRepayments).mul(10**30);
        repayConstants[msg.sender].repaymentInterval = repaymentInterval.mul(10**30);
        repayConstants[msg.sender].borrowRate = borrowRate;
        repayConstants[msg.sender].loanStartTime = loanStartTime.mul(10**30);
        repayConstants[msg.sender].repayAsset = lentAsset;
    }

    /**
     * @notice returns the number of repayment intervals that have been repaid,
     * if repayment interval = 10 secs, loan duration covered = 55 secs, repayment intervals covered = 5
     * @param _poolID address of the pool
     * @return scaled interest per second
     */

    function getInterestPerSecond(address _poolID) public view returns (uint256) {
        uint256 _activePrincipal = IPool(_poolID).totalSupply();
        uint256 _interestPerSecond = _activePrincipal.mul(repayConstants[_poolID].borrowRate).div(YEAR_IN_SECONDS);
        return _interestPerSecond;
    }

    /// @notice This function determines the number of completed instalments
    /// @param _poolID The address of the pool for which we want the completed instalments
    /// @return scaled instalments completed
    function getInstalmentsCompleted(address _poolID) public view returns (uint256) {
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _loanDurationCovered = repayVariables[_poolID].loanDurationCovered;
        uint256 _instalmentsCompleted = _loanDurationCovered.div(_repaymentInterval).mul(10**30); // dividing exponents, returns whole number rounded down

        return _instalmentsCompleted;
    }

    /// @notice This function determines the interest that is due for the borrower till the current instalment deadline
    /// @param _poolID The address of the pool for which we want the interest
    /// @return scaled interest due till instalment deadline
    function getInterestDueTillInstalmentDeadline(address _poolID) public view returns (uint256) {
        uint256 _interestPerSecond = getInterestPerSecond(_poolID);
        uint256 _nextInstalmentDeadline = getNextInstalmentDeadline(_poolID);
        uint256 _loanDurationCovered = repayVariables[_poolID].loanDurationCovered;
        uint256 _interestDueTillInstalmentDeadline = (
            _nextInstalmentDeadline.sub(repayConstants[_poolID].loanStartTime).sub(_loanDurationCovered)
        ).mul(_interestPerSecond).div(10**30);
        return _interestDueTillInstalmentDeadline;
    }

    /// @notice This function determines the timestamp of the next instalment deadline
    /// @param _poolID The address of the pool for which we want the next instalment deadline
    /// @return timestamp before which next instalment ends
    function getNextInstalmentDeadline(address _poolID) public view override returns (uint256) {
        uint256 _instalmentsCompleted = getInstalmentsCompleted(_poolID);
        if (_instalmentsCompleted == repayConstants[_poolID].numberOfTotalRepayments.mul(10**30)) {
            revert('Pool completely repaid');
        }
        uint256 _loanExtensionPeriod = repayVariables[_poolID].loanExtensionPeriod;
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _loanStartTime = repayConstants[_poolID].loanStartTime;
        uint256 _nextInstalmentDeadline;

        if (_loanExtensionPeriod > _instalmentsCompleted) {
            _nextInstalmentDeadline = ((_instalmentsCompleted.add(10**30).add(10**30)).mul(_repaymentInterval).div(10**30)).add(
                _loanStartTime
            );
        } else {
            _nextInstalmentDeadline = ((_instalmentsCompleted.add(10**30)).mul(_repaymentInterval).div(10**30)).add(_loanStartTime);
        }
        return _nextInstalmentDeadline;
    }

    /// @notice This function determine the current instalment interval
    /// @param _poolID The address of the pool for which we want the current instalment interval
    /// @return scaled instalment interval
    function getCurrentInstalmentInterval(address _poolID) public view returns (uint256) {
        uint256 _instalmentsCompleted = getInstalmentsCompleted(_poolID);
        return _instalmentsCompleted.add(10**30);
    }

    /// @notice This function determines the current (loan) interval
    /// @dev adding 10**30 to add 1. Considering base itself as (10**30)
    /// @param _poolID The address of the pool for which we want the current loan interval
    /// @return scaled current loan interval
    function getCurrentLoanInterval(address _poolID) external view override returns (uint256) {
        uint256 _loanStartTime = repayConstants[_poolID].loanStartTime;
        uint256 _currentTime = block.timestamp.mul(10**30);
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _currentInterval = ((_currentTime.sub(_loanStartTime)).mul(10**30).div(_repaymentInterval)).add(10**30);

        return _currentInterval;
    }

    /// @notice Check if grace penalty is applicable or not
    /// @dev (10**30) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool for which we want to inquire if grace penalty is applicable or not
    /// @return boolean value indicating if applicable or not
    function isGracePenaltyApplicable(address _poolID) public view returns (bool) {
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _currentTime = block.timestamp.mul(10**30);
        uint256 _gracePeriodFraction = repayConstants[_poolID].gracePeriodFraction;
        uint256 _nextInstalmentDeadline = getNextInstalmentDeadline(_poolID);
        uint256 _gracePeriodDeadline = _nextInstalmentDeadline.add(_gracePeriodFraction.mul(_repaymentInterval).div(10**30));

        require(_currentTime <= _gracePeriodDeadline, 'Borrower has defaulted');

        if (_currentTime <= _nextInstalmentDeadline) return false;
        else return true;
    }

    /// @notice Checks if the borrower has defaulted
    /// @dev (10**30) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool from which borrower borrowed
    /// @return bool indicating whether the borrower has defaulted
    function didBorrowerDefault(address _poolID) external view override returns (bool) {
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _currentTime = block.timestamp.mul(10**30);
        uint256 _gracePeriodFraction = repayConstants[_poolID].gracePeriodFraction;
        uint256 _nextInstalmentDeadline = getNextInstalmentDeadline(_poolID);
        uint256 _gracePeriodDeadline = _nextInstalmentDeadline.add(_gracePeriodFraction.mul(_repaymentInterval).div(10**30));
        if (_currentTime > _gracePeriodDeadline) return true;
        else return false;
    }

    /// @notice Determines entire interest remaining to be paid for the loan issued to the borrower
    /// @dev (10**30) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool for which we want to calculate remaining interest
    /// @return interest remaining
    function getInterestLeft(address _poolID) public view returns (uint256) {
        uint256 _interestPerSecond = getInterestPerSecond((_poolID));
        uint256 _loanDurationLeft = repayConstants[_poolID].loanDuration.sub(repayVariables[_poolID].loanDurationCovered);
        uint256 _interestLeft = _interestPerSecond.mul(_loanDurationLeft).div(10**30); // multiplying exponents

        return _interestLeft;
    }

    /// @notice Given there is no loan extension, find the overdue interest after missing the repayment deadline
    /// @dev (10**30) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool
    /// @return interest amount that is overdue
    function getInterestOverdue(address _poolID) public view returns (uint256) {
        require(repayVariables[_poolID].isLoanExtensionActive, 'No overdue');
        uint256 _instalmentsCompleted = getInstalmentsCompleted(_poolID);
        uint256 _interestPerSecond = getInterestPerSecond(_poolID);
        uint256 _interestOverdue = (
            (
                (_instalmentsCompleted.add(10**30)).mul(repayConstants[_poolID].repaymentInterval).div(10**30).sub(
                    repayVariables[_poolID].loanDurationCovered
                )
            )
        ).mul(_interestPerSecond).div(10**30);
        return _interestOverdue;
    }

    /// @notice Used to for your overdues, grace penalty and interest
    /// @dev (10**30) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool
    /// @param _amount amount repaid by the borrower
    function repay(address _poolID, uint256 _amount) external payable nonReentrant isPoolInitialized(_poolID) {
        address _asset = repayConstants[_poolID].repayAsset;
        uint256 _amountRepaid = _repay(_poolID, _amount, false);

        _transferTokens(msg.sender, _poolID, _asset, _amountRepaid);
    }

    function _repayExtension(address _poolID) internal returns (uint256) {
        if (repayVariables[_poolID].isLoanExtensionActive) {
            uint256 _interestOverdue = getInterestOverdue(_poolID);
            repayVariables[_poolID].isLoanExtensionActive = false; // deactivate loan extension flag
            repayVariables[_poolID].loanDurationCovered = (getInstalmentsCompleted(_poolID).add(10**30))
                .mul(repayConstants[_poolID].repaymentInterval)
                .div(10**30);
            emit ExtensionRepaid(_poolID, _interestOverdue);
            return _interestOverdue;
        } else {
            return 0;
        }
    }

    function _repayGracePenalty(address _poolID) internal returns (uint256) {
        bool _isBorrowerLate = isGracePenaltyApplicable(_poolID);

        if (_isBorrowerLate) {
            uint256 _penalty = repayConstants[_poolID].gracePenaltyRate.mul(getInterestDueTillInstalmentDeadline(_poolID)).div(10**30);
            emit GracePenaltyRepaid(_poolID, _penalty);
            return _penalty;
        } else {
            return 0;
        }
    }

    function _repayInterest(
        address _poolID,
        uint256 _amount,
        bool _isLastRepayment
    ) internal returns (uint256) {
        uint256 _interestLeft = getInterestLeft(_poolID);
        require((_amount < _interestLeft) != _isLastRepayment, 'Repayments::repay complete interest must be repaid along with principal');

        if (_amount < _interestLeft) {
            uint256 _interestPerSecond = getInterestPerSecond(_poolID);
            uint256 _newDurationRepaid = _amount.mul(10**30).div(_interestPerSecond); // dividing exponents
            repayVariables[_poolID].loanDurationCovered = repayVariables[_poolID].loanDurationCovered.add(_newDurationRepaid);
            emit InterestRepaid(_poolID, _amount);
            return _amount;
        } else {
            repayVariables[_poolID].loanDurationCovered = repayConstants[_poolID].loanDuration; // full interest repaid
            emit InterestRepaymentComplete(_poolID, _interestLeft);
            return _interestLeft;
        }
    }

    function _updateRepaidAmount(address _poolID, uint256 _scaledRepaidAmount) internal returns (uint256) {
        uint256 _toPay = _scaledRepaidAmount.div(10**30);
        repayVariables[_poolID].repaidAmount = repayVariables[_poolID].repaidAmount.add(_toPay);
        return _toPay;
    }

    function _repay(
        address _poolID,
        uint256 _amount,
        bool _isLastRepayment
    ) internal returns (uint256) {
        IPool _pool = IPool(_poolID);
        _amount = _amount * 10**30;
        uint256 _loanStatus = _pool.getLoanStatus();
        require(_loanStatus == uint(LoanStatus.ACTIVE) , 'Repayments:repayInterest Pool should be active.');

        uint256 _initialAmount = _amount;

        // pay off grace penality
        uint256 _gracePenaltyDue = _repayGracePenalty(_poolID);
        _amount = _amount.sub(_gracePenaltyDue, 'doesnt cover grace penality');

        // pay off the overdue
        uint256 _interestOverdue = _repayExtension(_poolID);
        _amount = _amount.sub(_interestOverdue, 'doesnt cover overdue interest');

        // pay interest
        uint256 _interestRepaid = _repayInterest(_poolID, _amount, _isLastRepayment);
        _amount = _amount.sub(_interestRepaid);

        return _updateRepaidAmount(_poolID, _initialAmount.sub(_amount));
    }

    /// @notice Used to pay off the principal of the loan, once the overdues and interests are repaid
    /// @dev (10**30) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool
    function repayPrincipal(address payable _poolID) external payable nonReentrant isPoolInitialized(_poolID) {
        address _asset = repayConstants[_poolID].repayAsset;
        uint256 _interestToRepay = _repay(_poolID, MAX_INT, true);
        IPool _pool = IPool(_poolID);

        require(!repayVariables[_poolID].isLoanExtensionActive, 'Repayments:repayPrincipal Repayment overdue unpaid');

        require(
            repayConstants[_poolID].loanDuration == repayVariables[_poolID].loanDurationCovered,
            'Repayments:repayPrincipal Unpaid interest'
        );

        uint256 _amount = _pool.totalSupply();
        uint256 _amountToPay = _amount.add(_interestToRepay);
        _transferTokens(msg.sender, _poolID, _asset, _amountToPay);
        emit PrincipalRepaid(_poolID, _amount);

        IPool(_poolID).closeLoan();
    }

    /// @notice Returns the total amount that has been repaid by the borrower till now
    /// @param _poolID address of the pool
    /// @return total amount repaid
    function getTotalRepaidAmount(address _poolID) external view override returns (uint256) {
        return repayVariables[_poolID].repaidAmount;
    }

    /// @notice This function activates the instalment deadline
    /// @param _poolID address of the pool for which deadline is extended
    function instalmentDeadlineExtended(address _poolID) external override {
        require(msg.sender == poolFactory.extension(), 'Repayments::repaymentExtended - Invalid caller');

        repayVariables[_poolID].isLoanExtensionActive = true;
        repayVariables[_poolID].loanExtensionPeriod = getCurrentInstalmentInterval(_poolID);
    }

    /// @notice Returns the loanDurationCovered till now and the interest per second which will help in interest calculation
    /// @param _poolID address of the pool for which we want to calculate interest
    /// @return Loan Duration Covered and the interest per second
    function getInterestCalculationVars(address _poolID) external view override returns (uint256, uint256) {
        uint256 _interestPerSecond = getInterestPerSecond(_poolID);
        return (repayVariables[_poolID].loanDurationCovered, _interestPerSecond);
    }

    /// @notice Returns the fraction of repayment interval decided as the grace period fraction
    /// @return grace period fraction
    function getGracePeriodFraction() external view override returns (uint256) {
        return gracePeriodFraction;
    }

    function _transferTokens(
        address _from,
        address _to,
        address _asset,
        uint256 _amount
    ) internal {
        if (_asset == address(0)) {
            (bool transferSuccess, ) = _to.call{value: _amount}('');
            require(transferSuccess, '_transferTokens: Transfer failed');
            if (msg.value != _amount) {
                (bool refundSuccess, ) = payable(_from).call{value: msg.value.sub(_amount)}('');
                require(refundSuccess, '_transferTokens: Refund failed');
            }
        } else {
            IERC20(_asset).safeTransferFrom(_from, _to, _amount);
        }
    }
}
