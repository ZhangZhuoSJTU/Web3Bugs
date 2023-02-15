// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../interfaces/IAggregatorV3Interface.sol";
import "../interfaces/IStableCoin.sol";
import "../interfaces/IERC20Decimals.sol";

/// @title Fungible asset vault (for DAO and ecosystem contracts)
/// @notice Allows the DAO and other whitelisted addresses to mint PUSD using fungible assets as collateral
/// @dev The contract only supports one asset, meaning that multiple instances
/// of this contract are going to be deployed if support for multiple assets is needed.
/// The credit limit rate of the supported asset is set at deploy time.
/// This contract doesn't support liquidations. In case of undercollateralization,
/// the DAO will promptly deposit more collateral.
/// The vault implements {AccessControlUpgradeable} and only allows whitelisted wallets
/// to deposit/borrow/withdraw/repay. The contract doesn't keep track of the individual
/// debt/deposited collateral of each whitelisted address, it instead uses global debt and deposited collateral.
/// This is intentional and it's done to allow the DAO to repay debt of ecosystem contracts ({StrategyPUSDConvex}, for example)
contract FungibleAssetVaultForDAO is
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IStableCoin;

    event Deposit(address indexed user, uint256 depositAmount);
    event Borrow(address indexed user, uint256 borrowAmount);
    event Repay(address indexed user, uint256 repayAmount);
    event Withdraw(address indexed user, uint256 withdrawAmount);

    struct Rate {
        uint128 numerator;
        uint128 denominator;
    }

    bytes32 public constant WHITELISTED_ROLE = keccak256("WHITELISTED_ROLE");

    /// @dev This contract can handle unwrapped ETH if `address(0)` is passed as the `_collateralAsset`
    /// parameter in the {initialize} function
    address internal constant ETH = address(0);

    address public collateralAsset;
    IStableCoin public stablecoin;
    /// @dev We store the value of a single unit of the collateral asset `10 ** decimals`
    /// instead of fetching it everytime to save gas
    uint256 private _collateralUnit;

    IAggregatorV3Interface public oracle;

    Rate public creditLimitRate;

    /// @notice Amount of deposited collateral
    uint256 public collateralAmount;
    /// @notice Outstanding debt
    uint256 public debtAmount;

    /// @param _collateralAsset The address of the collateral asset - `address(0)` for ETH
    /// @param _stablecoin PUSD address
    /// @param _oracle Chainlink price feed for `_collateralAsset`/USD
    /// @param _creditLimitRate Max outstanding debt to collateral ratio
    function initialize(
        address _collateralAsset,
        IStableCoin _stablecoin,
        IAggregatorV3Interface _oracle,
        Rate memory _creditLimitRate
    ) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        setCreditLimitRate(_creditLimitRate);

        collateralAsset = _collateralAsset;
        stablecoin = _stablecoin;
        if (_collateralAsset == ETH) {
            _collateralUnit = 1 ether;
        } else {
            _collateralUnit = 10**IERC20Decimals(_collateralAsset).decimals();
        }

        oracle = _oracle;
    }

    /// @notice Allows members of the `DEFAULT_ADMIN_ROLE` to change the max outstanding debt to collateral ratio
    /// @param _creditLimitRate The new ratio
    function setCreditLimitRate(Rate memory _creditLimitRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _creditLimitRate.denominator > 0 &&
                //denominator can be equal to the numerator in some cases (stablecoins used as collateral)
                _creditLimitRate.denominator >= _creditLimitRate.numerator,
            "invalid_rate"
        );
        creditLimitRate = _creditLimitRate;
    }

    /// @dev Returns the USD price of one unit of collateral asset, using 18 decimals precision
    /// @return The USD price
    function _collateralPriceUsd() internal view returns (uint256) {
        int256 answer = oracle.latestAnswer();
        uint8 decimals = oracle.decimals();

        require(answer > 0, "invalid_oracle_answer");

        //check chainlink's precision and convert it to 18 decimals
        return
            decimals > 18
                ? uint256(answer) / 10**(decimals - 18)
                : uint256(answer) * 10**(18 - decimals);
    }

    /// @dev Returns the USD value of `amount` units of collateral, using 18 decimals precision
    /// @param amount The amount of collateral to calculate the value of
    /// @return The USD value
    function _getCollateralValue(uint256 amount)
        internal
        view
        returns (uint256)
    {
        return (amount * _collateralPriceUsd()) / _collateralUnit;
    }

    /// @notice Returns the max debt for `amount` of collateral
    /// @param amount The amount of collateral to calculate max debt for
    /// @return Max debt value for `amount`
    function getCreditLimit(uint256 amount) public view returns (uint256) {
        uint256 collateralValue = _getCollateralValue(amount);
        return
            (collateralValue * creditLimitRate.numerator) /
            creditLimitRate.denominator;
    }

    /// @notice Allows members of the `WHITELISTED_ROLE` to deposit `amount` of collateral
    /// @dev Emits a {Deposit} event
    /// @param amount The amount of collateral to deposit
    function deposit(uint256 amount) external payable onlyRole(WHITELISTED_ROLE) {
        require(amount > 0, "invalid_amount");

        if (collateralAsset == ETH) {
            require(msg.value == amount, "invalid_msg_value");
        } else {
            require(msg.value == 0, "non_zero_eth_value");
            IERC20Upgradeable(collateralAsset).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }

        collateralAmount += amount;

        emit Deposit(msg.sender, amount);
    }

    /// @notice Allows members of the `WHITELISTED_ROLE` to borrow `amount` of PUSD against the deposited collateral
    /// @dev Emits a {Borrow} event
    /// @param amount The amount of PUSD to borrow
    function borrow(uint256 amount) external onlyRole(WHITELISTED_ROLE) nonReentrant {
        require(amount > 0, "invalid_amount");

        uint256 creditLimit = getCreditLimit(collateralAmount);
        uint256 newDebtAmount = debtAmount + amount;
        require(newDebtAmount <= creditLimit, "insufficient_credit");

        debtAmount = newDebtAmount;
        stablecoin.mint(msg.sender, amount);

        emit Borrow(msg.sender, amount);
    }

    /// @notice Allows members of the `WHITELISTED_ROLE` to repay `amount` of debt using PUSD
    /// @dev Emits a {Repay} event
    /// @param amount The amount of debt to repay
    function repay(uint256 amount) external onlyRole(WHITELISTED_ROLE) nonReentrant {
        require(amount > 0, "invalid_amount");

        amount = amount > debtAmount ? debtAmount : amount;

        debtAmount -= amount;
        stablecoin.burnFrom(msg.sender, amount);

        emit Repay(msg.sender, amount);
    }

    /// @notice Allows members of the `WHITELISTED_ROLE` to withdraw `amount` of deposited collateral
    /// @dev Emits a {Withdraw} event
    /// @param amount The amount of collateral to withdraw
    function withdraw(uint256 amount) external onlyRole(WHITELISTED_ROLE) nonReentrant {
        require(amount > 0 && amount <= collateralAmount, "invalid_amount");

        uint256 creditLimit = getCreditLimit(collateralAmount - amount);
        require(creditLimit >= debtAmount, "insufficient_credit");

        collateralAmount -= amount;

        if (collateralAsset == ETH) payable(msg.sender).transfer(amount);
        else
            IERC20Upgradeable(collateralAsset).safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

    uint256[50] private __gap;
}
