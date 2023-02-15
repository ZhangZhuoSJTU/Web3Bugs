// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';

import '../../ProtocolFeeCollector.sol';
import '../../roles/Admin.sol';
import '../../../SublimeProxy.sol';
import '../../../PriceOracle.sol';
import '../../../CreditLine/CreditLine.sol';
import '../../../yield/StrategyRegistry.sol';
import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../PooledCreditLine/LenderPool.sol';
import '../../../yield/CompoundYield.sol';
import '../Helpers/PCLConstants.t.sol';
import './PCLUser.t.sol';
import '../../../PooledCreditLine/LimitsManager.sol';
import '../../../interfaces/ILimitsManager.sol';

contract PCLAdmin is PCLUser, Admin {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    bytes emptyBytes;

    constructor(address _pclAddress, address _lpAddress) PCLUser(_pclAddress, _lpAddress) {}

    function deployLimitsManager(
        address _proxyAdmin,
        address _usdc,
        address _priceOracle
    ) public returns (address) {
        LimitsManager _limitsManagerImpl = new LimitsManager(_usdc, _priceOracle);
        address sublimeProxy = address(new SublimeProxy(address(_limitsManagerImpl), _proxyAdmin, emptyBytes));
        LimitsManager limitsManager = LimitsManager(sublimeProxy);
        limitsManager.initialize(address(this));
        limitsManager.updateBorrowAmountUSDCLimits(PCLConstants.minBorrowLimit, PCLConstants.maxBorrowLimit);
        limitsManager.updateBorrowRateLimits(PCLConstants.minBorrowRate, PCLConstants.maxBorrowRate);
        limitsManager.updateCollectionPeriodLimits(PCLConstants.minCollectionPeriod, PCLConstants.maxCollectionPeriod);
        limitsManager.updateDefaultGracePeriodLimits(PCLConstants.minDefaultGraceDuration, PCLConstants.maxDefaultGraceDuration);
        limitsManager.updateDurationLimits(PCLConstants.minDuration, PCLConstants.maxDuration);
        limitsManager.updateGracePenaltyRateLimits(PCLConstants.minGracePenaltyRate, PCLConstants.maxGracePenaltyRate);
        limitsManager.updateIdealCollateralRatioLimits(PCLConstants.minCollateralRatio, PCLConstants.maxCollateralRatio);
        return sublimeProxy;
    }

    function deployPCLContracts(
        address _proxyAdmin,
        address _savingsAccount,
        address _verification,
        address _priceOracle,
        address _strategyRegistry,
        address _limitsManager,
        address _mockProtocolFeeCollector
    ) public returns (address, address) {
        //address _placeHolder = address(this);
        // use any address and latter change to, here used _placeHolder

        {
            address _lenderPoolProxyAddress = address(new SublimeProxy(address(this), _proxyAdmin, emptyBytes));
            PooledCreditLine pclImplementation = new PooledCreditLine(
                _lenderPoolProxyAddress,
                _priceOracle,
                _savingsAccount,
                _strategyRegistry,
                _verification,
                _limitsManager,
                1e18 / 10
            );
            address sublimeProxy = address(new SublimeProxy(address(pclImplementation), _proxyAdmin, emptyBytes));
            pcl = PooledCreditLine(sublimeProxy);
            //emit log_named_address('pooledcreditline address', address(pcl));

            LenderPool _lenderPoolImplementation = new LenderPool(address(pcl), _savingsAccount, _verification);
            lp = LenderPool(payable(_lenderPoolProxyAddress));

            Admin(_proxyAdmin).changeImplementationAddressOfProxy(_lenderPoolProxyAddress, address(_lenderPoolImplementation));
            //emit log_named_address('lender pool1', address(_lenderPool));
            //emit log_named_address('lender pool2', address(_lenderPoolProxyAddress));
        }

        lp.initialize();

        pcl.initialize(address(this), PCLConstants.protocolFeeFraction, _mockProtocolFeeCollector);
        return (address(pcl), address(lp));
    }

    function updateBorrowLimitLimits(uint256 _min, uint256 _max) public {
        ILimitsManager _limitsManager = pcl.LIMITS_MANAGER();
        LimitsManager(address(_limitsManager)).updateBorrowAmountUSDCLimits(_min, _max);
    }

    function updateIdealCollateralRatioLimits(uint256 _min, uint256 _max) public {
        ILimitsManager _limitsManager = pcl.LIMITS_MANAGER();
        LimitsManager(address(_limitsManager)).updateIdealCollateralRatioLimits(_min, _max);
    }

    function updateBorrowRateLimits(uint256 _min, uint256 _max) public {
        ILimitsManager _limitsManager = pcl.LIMITS_MANAGER();
        LimitsManager(address(_limitsManager)).updateBorrowRateLimits(_min, _max);
    }

    function updateCollectionPeriodLimits(uint256 _min, uint256 _max) public {
        ILimitsManager _limitsManager = pcl.LIMITS_MANAGER();
        LimitsManager(address(_limitsManager)).updateCollectionPeriodLimits(_min, _max);
    }

    function updateDurationLimits(uint256 _min, uint256 _max) public {
        ILimitsManager _limitsManager = pcl.LIMITS_MANAGER();
        LimitsManager(address(_limitsManager)).updateDurationLimits(_min, _max);
    }

    function updateDefaultGracePeriodLimits(uint256 _min, uint256 _max) public {
        ILimitsManager _limitsManager = pcl.LIMITS_MANAGER();
        LimitsManager(address(_limitsManager)).updateDefaultGracePeriodLimits(_min, _max);
    }

    function updateGracePenaltyRateLimits(uint256 _min, uint256 _max) public {
        ILimitsManager _limitsManager = pcl.LIMITS_MANAGER();
        LimitsManager(address(_limitsManager)).updateGracePenaltyRateLimits(_min, _max);
    }

    function updateProtocolFeeFraction(uint256 _protocolFeeFraction) public {
        pcl.updateProtocolFeeFraction(_protocolFeeFraction);
    }

    function updateProtocolFeeCollector(address _protocolFeeCollector) public {
        pcl.updateProtocolFeeCollector(_protocolFeeCollector);
    }
}
