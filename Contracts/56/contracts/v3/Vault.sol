// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/GSN/Context.sol";

import "./interfaces/IManager.sol";
import "./interfaces/IController.sol";
import "./interfaces/IConverter.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IVaultToken.sol";
import "./interfaces/ExtendedIERC20.sol";

/**
 * @title Vault
 * @notice The vault is where users deposit and withdraw
 * like-kind assets that have been added by governance.
 */
contract Vault is IVault {
    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX = 10000;

    IManager public immutable override manager;
    IERC20 public immutable token;
    IVaultToken public immutable vaultToken;

    // Strategist-updated variables
    address public override gauge;
    uint256 public min;
    uint256 public totalDepositCap;

    event Deposit(address indexed account, uint256 amount);
    event Withdraw(address indexed account, uint256 amount);
    event Earn(address indexed token, uint256 amount);

    /**
     * @param _depositToken The address of the deposit token of the vault
     * @param _vaultToken The address of the share token for the vault
     * @param _manager The address of the vault manager contract
     */
    constructor(
        address _depositToken,
        address _vaultToken,
        address _manager
    )
        public
    {
        manager = IManager(_manager);
        token = IERC20(_depositToken);
        vaultToken = IVaultToken(_vaultToken);
        min = 9500;
        totalDepositCap = 10000000 ether;
    }

    /**
     * STRATEGIST-ONLY FUNCTIONS
     */

    /**
     * @notice Sets the value of this vault's gauge
     * @dev Allow to be unset with the zero address
     * @param _gauge The address of the gauge
     */
    function setGauge(
        address _gauge
    )
        external
        notHalted
        onlyStrategist
    {
        gauge = _gauge;
    }

    /**
     * @notice Sets the value for min
     * @dev min is the minimum percent of funds to keep small withdrawals cheap
     * @param _min The new min value
     */
    function setMin(
        uint256 _min
    )
        external
        notHalted
        onlyStrategist
    {
        require(_min <= MAX, "!_min");
        min = _min;
    }

    /**
     * @notice Sets the value for the totalDepositCap
     * @dev totalDepositCap is the maximum amount of value that can be deposited
     * to the metavault at a time
     * @param _totalDepositCap The new totalDepositCap value
     */
    function setTotalDepositCap(
        uint256 _totalDepositCap
    )
        external
        notHalted
        onlyStrategist
    {
        totalDepositCap = _totalDepositCap;
    }

    /**
     * HARVESTER-ONLY FUNCTIONS
     */

    /**
     * @notice Sends accrued 3CRV tokens on the metavault to the controller to be deposited to strategies
     */
    function earn(
        address _strategy
    )
        external
        override
        notHalted
        onlyHarvester
    {
        require(manager.allowedStrategies(_strategy), "!_strategy");
        IController _controller = IController(manager.controllers(address(this)));
        if (_controller.investEnabled()) {
            uint256 _balance = available();
            token.safeTransfer(address(_controller), _balance);
            _controller.earn(_strategy, address(token), _balance);
            emit Earn(address(token), _balance);
        }
    }

    /**
     * USER-FACING FUNCTIONS
     */

    /**
     * @notice Deposits the given token into the vault
     * @param _amount The amount of tokens to deposit
     */
     function deposit(
        uint256 _amount
     )
        public
        override
        notHalted
        returns (uint256 _shares)
    {
        require(_amount > 0, "!_amount");

        uint256 _balance = balance();

        uint256 _before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), _amount);
        _amount = token.balanceOf(address(this)).sub(_before);
        uint256 _supply = IERC20(address(vaultToken)).totalSupply();

        _amount = _normalizeDecimals(_amount);

        if (_supply > 0) {
            _amount = (_amount.mul(_supply)).div(_balance);
        }

        _shares = _amount;

        require(_shares > 0, "shares=0");
        require(_supply.add(_shares) <= totalDepositCap, ">totalDepositCap");
        vaultToken.mint(msg.sender, _shares);
        emit Deposit(msg.sender, _shares);
    }

    /**
     * @notice Withdraws an amount of shares to a given output token
     * @param _shares The amount of shares to withdraw
     */
    function withdraw(
        uint256 _shares
    )
        public
        override
    {
        uint256 _amount = (balance().mul(_shares)).div(IERC20(address(vaultToken)).totalSupply());
        vaultToken.burn(msg.sender, _shares);

        uint256 _withdrawalProtectionFee = manager.withdrawalProtectionFee();
        if (_withdrawalProtectionFee > 0) {
            uint256 _withdrawalProtection = _amount.mul(_withdrawalProtectionFee).div(MAX);
            _amount = _amount.sub(_withdrawalProtection);
        }

        uint256 _balance = token.balanceOf(address(this));
        if (_balance < _amount) {
            IController _controller = IController(manager.controllers(address(this)));
            uint256 _toWithdraw = _amount.sub(_balance);
            if (_controller.strategies() > 0) {
                _controller.withdraw(address(token), _toWithdraw);
            }
            uint256 _after = token.balanceOf(address(this));
            uint256 _diff = _after.sub(_balance);
            if (_diff < _toWithdraw) {
                _amount = _after;
            }
        }

        token.safeTransfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }

    /**
     * @notice Withdraw the entire balance for an account
     */
    function withdrawAll()
        external
        override
    {
        withdraw(IERC20(address(vaultToken)).balanceOf(msg.sender));
    }

    /**
     * VIEWS
     */

    /**
     * @notice Returns the amount of tokens available to be sent to strategies
     * @dev Custom logic in here for how much the vault allows to be borrowed
     * @dev Sets minimum required on-hand to keep small withdrawals cheap
     */
    function available()
        public
        view
        override
        returns (uint256)
    {
        return token.balanceOf(address(this)).mul(min).div(MAX);
    }

    /**
     * @notice Returns the total balance of the vault, including strategies
     */
    function balance()
        public
        view
        override
        returns (uint256 _balance)
    {
        return balanceOfThis().add(IController(manager.controllers(address(this))).balanceOf());
    }

    /**
     * @notice Returns the balance of allowed tokens present on the vault only
     */
    function balanceOfThis()
        public
        view
        returns (uint256)
    {
        return _normalizeDecimals(token.balanceOf(address(this)));
    }

    /**
     * @notice Returns the rate of vault shares
     */
    function getPricePerFullShare()
        external
        view
        override
        returns (uint256)
    {
        uint256 _supply = IERC20(address(vaultToken)).totalSupply();
        if (_supply > 0) {
            return balance().mul(1e18).div(_supply);
        } else {
            return balance();
        }
    }

    /**
     * @notice Returns the deposit token for the vault
     */
    function getToken()
        public
        view
        override
        returns (address)
    {
        return address(token);
    }

    function getLPToken()
        external
        view
        override
        returns (address)
    {
        return address(vaultToken);
    }

    /**
     * @notice Returns the fee for withdrawing the given amount
     * @param _amount The amount to withdraw
     */
    function withdrawFee(
        uint256 _amount
    )
        external
        view
        override
        returns (uint256)
    {
        return manager.withdrawalProtectionFee().mul(_amount).div(MAX);
    }

    function _normalizeDecimals(
        uint256 _amount
    )
        internal
        view
        returns (uint256)
    {
        uint256 _decimals = uint256(ExtendedIERC20(address(token)).decimals());
        if (_decimals < 18) {
            _amount = _amount.mul(10**(18-_decimals));
        }
        return _amount;
    }

    /**
     * MODIFIERS
     */

    modifier notHalted() {
        require(!manager.halted(), "halted");
        _;
    }

    modifier onlyHarvester() {
        require(msg.sender == manager.harvester(), "!harvester");
        _;
    }

    modifier onlyStrategist() {
        require(msg.sender == manager.strategist(), "!strategist");
        _;
    }
}
