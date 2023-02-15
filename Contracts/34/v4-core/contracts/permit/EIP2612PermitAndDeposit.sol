// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IPrizePool.sol";

/// @title Allows users to approve and deposit EIP-2612 compatible tokens into a prize pool in a single transaction.
contract EIP2612PermitAndDeposit {
    using SafeERC20 for IERC20;

    /**
     * @notice Permits this contract to spend on a user's behalf, and deposits into the prize pool.
     * @dev The `spender` address required by the permit function is the address of this contract.
     * @param _token Address of the EIP-2612 token to approve and deposit.
     * @param _owner Token owner's address (Authorizer).
     * @param _amount Amount of tokens to deposit.
     * @param _deadline Timestamp at which the signature expires.
     * @param _v `v` portion of the signature.
     * @param _r `r` portion of the signature.
     * @param _s `s` portion of the signature.
     * @param _prizePool Address of the prize pool to deposit into.
     * @param _to Address that will receive the tickets.
     */
    function permitAndDepositTo(
        address _token,
        address _owner,
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        address _prizePool,
        address _to
    ) external {
        require(msg.sender == _owner, "EIP2612PermitAndDeposit/only-signer");

        IERC20Permit(_token).permit(_owner, address(this), _amount, _deadline, _v, _r, _s);

        _depositTo(_token, _owner, _amount, _prizePool, _to);
    }

    /**
     * @notice Deposits user's token into the prize pool.
     * @param _token Address of the EIP-2612 token to approve and deposit.
     * @param _owner Token owner's address (Authorizer).
     * @param _amount Amount of tokens to deposit.
     * @param _prizePool Address of the prize pool to deposit into.
     * @param _to Address that will receive the tickets.
     */
    function _depositTo(
        address _token,
        address _owner,
        uint256 _amount,
        address _prizePool,
        address _to
    ) internal {
        IERC20(_token).safeTransferFrom(_owner, address(this), _amount);
        IERC20(_token).safeApprove(_prizePool, _amount);
        IPrizePool(_prizePool).depositTo(_to, _amount);
    }
}
