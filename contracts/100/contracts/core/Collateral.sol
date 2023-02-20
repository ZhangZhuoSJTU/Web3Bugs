// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./interfaces/ICollateral.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IHook.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract Collateral is
    ICollateral,
    ERC20Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bool private _depositsAllowed;
    bool private _withdrawalsAllowed;
    address private _treasury;
    uint256 private _mintingFee;
    uint256 private _redemptionFee;
    IERC20Upgradeable private _baseToken;
    IStrategyController private _strategyController;

    uint256 private _delayedWithdrawalExpiry;
    mapping(address => WithdrawalRequest) private _accountToWithdrawalRequest;

    IHook private _depositHook;
    IHook private _withdrawHook;

    uint256 private constant FEE_DENOMINATOR = 1000000;
    uint256 private constant FEE_LIMIT = 50000;

    function initialize(address _newBaseToken, address _newTreasury)
        public
        initializer
    {
        __Ownable_init_unchained();
        __ReentrancyGuard_init_unchained();
        __ERC20_init_unchained(
            string("prePO Collateral Token"),
            string("preCT")
        );
        _baseToken = IERC20Upgradeable(_newBaseToken);
        _treasury = _newTreasury;
    }

    function deposit(uint256 _amount)
        external
        override
        nonReentrant
        returns (uint256)
    {
        require(_depositsAllowed, "Deposits not allowed");
        _baseToken.safeTransferFrom(msg.sender, address(this), _amount);
        // Calculate fees and shares to mint including latent contract funds
        uint256 _amountToDeposit = _baseToken.balanceOf(address(this));
        // Record deposit before fee is taken
        if (address(_depositHook) != address(0)) {
            _depositHook.hook(msg.sender, _amount, _amountToDeposit);
        }
        /**
         * Add 1 to avoid rounding to zero, only process deposit if user is
         * depositing an amount large enough to pay a fee.
         */
        uint256 _fee = (_amountToDeposit * _mintingFee) / FEE_DENOMINATOR + 1;
        require(_amountToDeposit > _fee, "Deposit amount too small");
        _baseToken.safeTransfer(_treasury, _fee);
        _amountToDeposit -= _fee;

        uint256 _valueBefore = _strategyController.totalValue();
        _baseToken.approve(address(_strategyController), _amountToDeposit);
        _strategyController.deposit(_amountToDeposit);
        uint256 _valueAfter = _strategyController.totalValue();
        _amountToDeposit = _valueAfter - _valueBefore;

        uint256 _shares = 0;
        if (totalSupply() == 0) {
            _shares = _amountToDeposit;
        } else {
            /**
             * # of shares owed = amount deposited / cost per share, cost per
             * share = total supply / total value.
             */
            _shares = (_amountToDeposit * totalSupply()) / (_valueBefore);
        }
        _mint(msg.sender, _shares);
        return _shares;
    }

    function initiateWithdrawal(uint256 _amount) external override {
        /**
         * Checking the balance before initiation is necessary since a user
         * could initiate an unlimited withdrawal amount ahead of time,
         * negating the protection a delayed withdrawal offers.
         */
        require(balanceOf(msg.sender) >= _amount, "Insufficient balance");
        _accountToWithdrawalRequest[msg.sender].amount = _amount;
        _accountToWithdrawalRequest[msg.sender].blockNumber = block.number;
    }

    function uninitiateWithdrawal() external override {
        _accountToWithdrawalRequest[msg.sender].amount = 0;
        _accountToWithdrawalRequest[msg.sender].blockNumber = 0;
    }

    function _processDelayedWithdrawal(address _account, uint256 _amount)
        internal
    {
        /**
         * Verify that the withdrawal being processed matches what was
         * recorded during initiation.
         */
        require(
            _accountToWithdrawalRequest[_account].amount == _amount,
            "Initiated amount does not match"
        );
        uint256 _recordedBlock = _accountToWithdrawalRequest[_account]
            .blockNumber;
        require(
            _recordedBlock + _delayedWithdrawalExpiry >= block.number,
            "Must withdraw before expiry"
        );
        require(
            block.number > _recordedBlock,
            "Must withdraw in a later block"
        );
        // Reset the initiation prior to withdrawal.
        _accountToWithdrawalRequest[_account].amount = 0;
        _accountToWithdrawalRequest[_account].blockNumber = 0;
    }

    function withdraw(uint256 _amount)
        external
        override
        nonReentrant
        returns (uint256)
    {
        require(_withdrawalsAllowed, "Withdrawals not allowed");
        if (_delayedWithdrawalExpiry != 0) {
            _processDelayedWithdrawal(msg.sender, _amount);
        }
        uint256 _owed = (_strategyController.totalValue() * _amount) /
            totalSupply();
        _burn(msg.sender, _amount);

        uint256 _balanceBefore = _baseToken.balanceOf(address(this));
        _strategyController.withdraw(address(this), _owed);
        uint256 _balanceAfter = _baseToken.balanceOf(address(this));

        uint256 _amountWithdrawn = _balanceAfter - _balanceBefore;
        // Record withdrawal before fee is taken
        if (address(_withdrawHook) != address(0)) {
            _withdrawHook.hook(msg.sender, _amount, _amountWithdrawn);
        }

        /**
         * Send redemption fee to the protocol treasury. Add 1 to avoid
         * rounding to zero, only process withdrawal if user is
         * withdrawing an amount large enough to pay a fee.
         */
        uint256 _fee = (_amountWithdrawn * _redemptionFee) /
            FEE_DENOMINATOR +
            1;
        require(_amountWithdrawn > _fee, "Withdrawal amount too small");
        _baseToken.safeTransfer(_treasury, _fee);
        _amountWithdrawn -= _fee;
        _baseToken.safeTransfer(msg.sender, _amountWithdrawn);
        return _amountWithdrawn;
    }

    function setDepositsAllowed(bool _allowed) external override onlyOwner {
        _depositsAllowed = _allowed;
        emit DepositsAllowedChanged(_allowed);
    }

    function setWithdrawalsAllowed(bool _allowed) external override onlyOwner {
        _withdrawalsAllowed = _allowed;
        emit WithdrawalsAllowedChanged(_allowed);
    }

    function setStrategyController(IStrategyController _newStrategyController)
        external
        override
        onlyOwner
    {
        _strategyController = _newStrategyController;
        emit StrategyControllerChanged(address(_strategyController));
    }

    function setDelayedWithdrawalExpiry(uint256 _newDelayedWithdrawalExpiry)
        external
        override
        onlyOwner
    {
        _delayedWithdrawalExpiry = _newDelayedWithdrawalExpiry;
        emit DelayedWithdrawalExpiryChanged(_delayedWithdrawalExpiry);
    }

    function setMintingFee(uint256 _newMintingFee)
        external
        override
        onlyOwner
    {
        require(_newMintingFee <= FEE_LIMIT, "Exceeds fee limit");
        _mintingFee = _newMintingFee;
        emit MintingFeeChanged(_mintingFee);
    }

    function setRedemptionFee(uint256 _newRedemptionFee)
        external
        override
        onlyOwner
    {
        require(_newRedemptionFee <= FEE_LIMIT, "Exceeds fee limit");
        _redemptionFee = _newRedemptionFee;
        emit RedemptionFeeChanged(_redemptionFee);
    }

    function setDepositHook(IHook _newDepositHook)
        external
        override
        onlyOwner
    {
        _depositHook = _newDepositHook;
        emit DepositHookChanged(address(_depositHook));
    }

    function setWithdrawHook(IHook _newWithdrawHook)
        external
        override
        onlyOwner
    {
        _withdrawHook = _newWithdrawHook;
        emit WithdrawHookChanged(address(_withdrawHook));
    }

    function getDepositsAllowed() external view override returns (bool) {
        return _depositsAllowed;
    }

    function getWithdrawalsAllowed() external view override returns (bool) {
        return _withdrawalsAllowed;
    }

    function getTreasury() external view override returns (address) {
        return _treasury;
    }

    function getMintingFee() external view override returns (uint256) {
        return _mintingFee;
    }

    function getRedemptionFee() external view override returns (uint256) {
        return _redemptionFee;
    }

    function getBaseToken()
        external
        view
        override
        returns (IERC20Upgradeable)
    {
        return _baseToken;
    }

    function getStrategyController()
        external
        view
        override
        returns (IStrategyController)
    {
        return _strategyController;
    }

    function getDelayedWithdrawalExpiry()
        external
        view
        override
        returns (uint256)
    {
        return _delayedWithdrawalExpiry;
    }

    function getWithdrawalRequest(address _account)
        external
        view
        override
        returns (WithdrawalRequest memory)
    {
        return _accountToWithdrawalRequest[_account];
    }

    function getDepositHook() external view override returns (IHook) {
        return _depositHook;
    }

    function getWithdrawHook() external view override returns (IHook) {
        return _withdrawHook;
    }

    function getAmountForShares(uint256 _shares)
        external
        view
        override
        returns (uint256)
    {
        if (totalSupply() == 0) {
            return _shares;
        }
        return (_shares * totalAssets()) / totalSupply();
    }

    function getSharesForAmount(uint256 _amount)
        external
        view
        override
        returns (uint256)
    {
        uint256 _totalAssets = totalAssets();
        return
            (_totalAssets > 0)
                ? ((_amount * totalSupply()) / _totalAssets)
                : 0;
    }

    function getFeeDenominator() external pure override returns (uint256) {
        return FEE_DENOMINATOR;
    }

    function getFeeLimit() external pure override returns (uint256) {
        return FEE_LIMIT;
    }

    function totalAssets() public view override returns (uint256) {
        return
            _baseToken.balanceOf(address(this)) +
            _strategyController.totalValue();
    }
}
