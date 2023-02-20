// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IPrizePool.sol";
import "../interfaces/ITicket.sol";

/**
 * @notice Secp256k1 signature values.
 * @param deadline Timestamp at which the signature expires
 * @param v `v` portion of the signature
 * @param r `r` portion of the signature
 * @param s `s` portion of the signature
 */
struct Signature {
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
}

/**
 * @notice Delegate signature to allow delegation of tickets to delegate.
 * @param delegate Address to delegate the prize pool tickets to
 * @param signature Delegate signature
 */
struct DelegateSignature {
    address delegate;
    Signature signature;
}

/// @title Allows users to approve and deposit EIP-2612 compatible tokens into a prize pool in a single transaction.
/// @custom:experimental This contract has not been fully audited yet.
contract EIP2612PermitAndDeposit {
    using SafeERC20 for IERC20;

    /**
     * @notice Permits this contract to spend on a user's behalf and deposits into the prize pool.
     * @dev The `spender` address required by the permit function is the address of this contract.
     * @param _prizePool Address of the prize pool to deposit into
     * @param _amount Amount of tokens to deposit into the prize pool
     * @param _to Address that will receive the tickets
     * @param _permitSignature Permit signature
     * @param _delegateSignature Delegate signature
     */
    function permitAndDepositToAndDelegate(
        IPrizePool _prizePool,
        uint256 _amount,
        address _to,
        Signature calldata _permitSignature,
        DelegateSignature calldata _delegateSignature
    ) external {
        ITicket _ticket = _prizePool.getTicket();
        address _token = _prizePool.getToken();

        IERC20Permit(_token).permit(
            msg.sender,
            address(this),
            _amount,
            _permitSignature.deadline,
            _permitSignature.v,
            _permitSignature.r,
            _permitSignature.s
        );

        _depositToAndDelegate(
            address(_prizePool),
            _ticket,
            _token,
            _amount,
            _to,
            _delegateSignature
        );
    }

    /**
     * @notice Deposits user's token into the prize pool and delegate tickets.
     * @param _prizePool Address of the prize pool to deposit into
     * @param _amount Amount of tokens to deposit into the prize pool
     * @param _to Address that will receive the tickets
     * @param _delegateSignature Delegate signature
     */
    function depositToAndDelegate(
        IPrizePool _prizePool,
        uint256 _amount,
        address _to,
        DelegateSignature calldata _delegateSignature
    ) external {
        ITicket _ticket = _prizePool.getTicket();
        address _token = _prizePool.getToken();

        _depositToAndDelegate(
            address(_prizePool),
            _ticket,
            _token,
            _amount,
            _to,
            _delegateSignature
        );
    }

    /**
     * @notice Deposits user's token into the prize pool and delegate tickets.
     * @param _prizePool Address of the prize pool to deposit into
     * @param _ticket Address of the ticket minted by the prize pool
     * @param _token Address of the token used to deposit into the prize pool
     * @param _amount Amount of tokens to deposit into the prize pool
     * @param _to Address that will receive the tickets
     * @param _delegateSignature Delegate signature
     */
    function _depositToAndDelegate(
        address _prizePool,
        ITicket _ticket,
        address _token,
        uint256 _amount,
        address _to,
        DelegateSignature calldata _delegateSignature
    ) internal {
        _depositTo(_token, msg.sender, _amount, _prizePool, _to);

        Signature memory signature = _delegateSignature.signature;

        _ticket.delegateWithSignature(
            _to,
            _delegateSignature.delegate,
            signature.deadline,
            signature.v,
            signature.r,
            signature.s
        );
    }

    /**
     * @notice Deposits user's token into the prize pool.
     * @param _token Address of the EIP-2612 token to approve and deposit
     * @param _owner Token owner's address (Authorizer)
     * @param _amount Amount of tokens to deposit
     * @param _prizePool Address of the prize pool to deposit into
     * @param _to Address that will receive the tickets
     */
    function _depositTo(
        address _token,
        address _owner,
        uint256 _amount,
        address _prizePool,
        address _to
    ) internal {
        IERC20(_token).safeTransferFrom(_owner, address(this), _amount);
        IERC20(_token).safeIncreaseAllowance(_prizePool, _amount);
        IPrizePool(_prizePool).depositTo(_to, _amount);
    }
}
