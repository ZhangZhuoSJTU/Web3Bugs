// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "erc3156/contracts/interfaces/IERC3156FlashBorrower.sol";
import "erc3156/contracts/interfaces/IERC3156FlashLender.sol";
import "./interfaces/vault/IJoin.sol";
import "./interfaces/vault/IJoinFactory.sol";
import "./interfaces/external/IERC20.sol";
import "./utils/access/AccessControl.sol";
import "./utils/token/TransferHelper.sol";
import "./math/WMul.sol";
import "./math/CastU256U128.sol";


contract Join is IJoin, IERC3156FlashLender, AccessControl() {
    using TransferHelper for IERC20;
    using WMul for uint256;
    using CastU256U128 for uint256;

    event FlashFeeFactorSet(uint256 indexed fee);

    bytes32 constant internal FLASH_LOAN_RETURN = keccak256("ERC3156FlashBorrower.onFlashLoan");

    address public immutable override asset;
    uint256 public storedBalance;
    uint256 public flashFeeFactor; // Fee on flash loans, as a percentage in fixed point with 18 decimals

    constructor() {
        asset = IJoinFactory(msg.sender).nextAsset();
    }

    /// @dev Set the flash loan fee factor
    function setFlashFeeFactor(uint256 flashFeeFactor_)
        public
        auth
    {
        flashFeeFactor = flashFeeFactor_;
        emit FlashFeeFactorSet(flashFeeFactor_);
    }

    /// @dev Take `amount` `asset` from `user` using `transferFrom`, minus any unaccounted `asset` in this contract.
    function join(address user, uint128 amount)
        external override
        auth
        returns (uint128)
    {
        return _join(user, amount);
    }

    /// @dev Take `amount` `asset` from `user` using `transferFrom`, minus any unaccounted `asset` in this contract.
    function _join(address user, uint128 amount)
        internal
        returns (uint128)
    {
        IERC20 token = IERC20(asset);
        uint256 _storedBalance = storedBalance;
        uint256 available = token.balanceOf(address(this)) - _storedBalance; // Fine to panic if this underflows
        storedBalance = _storedBalance + amount;
        unchecked { if (available < amount) token.safeTransferFrom(user, address(this), amount - available); }
        return amount;        
    }

    /// @dev Transfer `amount` `asset` to `user`
    function exit(address user, uint128 amount)
        external override
        auth
        returns (uint128)
    {
        return _exit(user, amount);
    }

    /// @dev Transfer `amount` `asset` to `user`
    function _exit(address user, uint128 amount)
        internal
        returns (uint128)
    {
        IERC20 token = IERC20(asset);
        storedBalance -= amount;
        token.safeTransfer(user, amount);
        return amount;
    }

    /// @dev Retrieve any tokens other than the `asset`. Useful for airdropped tokens.
    function retrieve(IERC20 token, address to)
        external
        auth
    {
        require(address(token) != address(asset), "Use exit for asset");
        token.safeTransfer(to, token.balanceOf(address(this)));
    }

    /**
     * @dev From ERC-3156. The amount of currency available to be lended.
     * @param token The loan currency. It must be a FYDai contract.
     * @return The amount of `token` that can be borrowed.
     */
    function maxFlashLoan(address token) public view override returns (uint256) {
        return token == asset ? storedBalance : 0;
    }

    /**
     * @dev From ERC-3156. The fee to be charged for a given loan.
     * @param token The loan currency. It must be the asset.
     * @param amount The amount of tokens lent.
     * @return The amount of `token` to be charged for the loan, on top of the returned principal.
     */
    function flashFee(address token, uint256 amount) public view override returns (uint256) {
        require(token == asset, "Unsupported currency");
        return _flashFee(amount);
    }

    /**
     * @dev The fee to be charged for a given loan.
     * @param amount The amount of tokens lent.
     * @return The amount of `token` to be charged for the loan, on top of the returned principal.
     */
    function _flashFee(uint256 amount) internal view returns (uint256) {
        return amount.wmul(flashFeeFactor);
    }

    /**
     * @dev From ERC-3156. Loan `amount` `asset` to `receiver`, which needs to return them plus fee to this contract within the same transaction.
     * If the principal + fee are transferred to this contract, they won't be pulled from the receiver.
     * @param receiver The contract receiving the tokens, needs to implement the `onFlashLoan(address user, uint256 amount, uint256 fee, bytes calldata)` interface.
     * @param token The loan currency. Must be a fyDai contract.
     * @param amount The amount of tokens lent.
     * @param data A data parameter to be passed on to the `receiver` for any custom use.
     */
    function flashLoan(IERC3156FlashBorrower receiver, address token, uint256 amount, bytes memory data) public override returns(bool) {
        require(token == asset, "Unsupported currency");
        uint128 _amount = amount.u128();
        uint128 _fee = _flashFee(amount).u128();
        _exit(address(receiver), _amount);

        require(receiver.onFlashLoan(msg.sender, token, _amount, _fee, data) == FLASH_LOAN_RETURN, "Non-compliant borrower");

        _join(address(receiver), _amount + _fee);
        return true;
    }
}