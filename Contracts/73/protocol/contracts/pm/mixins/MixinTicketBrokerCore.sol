pragma solidity ^0.5.11;
// solium-disable-next-line
pragma experimental ABIEncoderV2;

import "./interfaces/MReserve.sol";
import "./interfaces/MTicketProcessor.sol";
import "./interfaces/MTicketBrokerCore.sol";
import "./interfaces/MContractRegistry.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract MixinTicketBrokerCore is MContractRegistry, MReserve, MTicketProcessor, MTicketBrokerCore {
    using SafeMath for uint256;

    struct Sender {
        uint256 deposit; // Amount of funds deposited
        uint256 withdrawRound; // Round that sender can withdraw deposit & reserve
    }

    // Mapping of address => Sender
    mapping(address => Sender) internal senders;

    // Number of rounds before a sender can withdraw after requesting an unlock
    uint256 public unlockPeriod;

    // Mapping of ticket hashes => boolean indicating if ticket was redeemed
    mapping(bytes32 => bool) public usedTickets;

    // Checks if msg.value is equal to the given deposit and reserve amounts
    modifier checkDepositReserveETHValueSplit(uint256 _depositAmount, uint256 _reserveAmount) {
        require(
            msg.value == _depositAmount.add(_reserveAmount),
            "msg.value does not equal sum of deposit amount and reserve amount"
        );

        _;
    }

    // Process deposit funding
    modifier processDeposit(address _sender, uint256 _amount) {
        Sender storage sender = senders[_sender];
        sender.deposit = sender.deposit.add(_amount);
        if (_isUnlockInProgress(sender)) {
            _cancelUnlock(sender, _sender);
        }

        _;

        emit DepositFunded(_sender, _amount);
    }

    // Process reserve funding
    modifier processReserve(address _sender, uint256 _amount) {
        Sender storage sender = senders[_sender];
        addReserve(_sender, _amount);
        if (_isUnlockInProgress(sender)) {
            _cancelUnlock(sender, _sender);
        }

        _;
    }

    /**
     * @notice Adds ETH to the caller's deposit
     */
    function fundDeposit() external payable whenSystemNotPaused processDeposit(msg.sender, msg.value) {
        processFunding(msg.value);
    }

    /**
     * @notice Adds ETH to the caller's reserve
     */
    function fundReserve() external payable whenSystemNotPaused processReserve(msg.sender, msg.value) {
        processFunding(msg.value);
    }

    /**
     * @notice Adds ETH to the caller's deposit and reserve
     * @param _depositAmount Amount of ETH to add to the caller's deposit
     * @param _reserveAmount Amount of ETH to add to the caller's reserve
     */
    function fundDepositAndReserve(uint256 _depositAmount, uint256 _reserveAmount)
        external
        payable
        whenSystemNotPaused
        checkDepositReserveETHValueSplit(_depositAmount, _reserveAmount)
        processDeposit(msg.sender, _depositAmount)
        processReserve(msg.sender, _reserveAmount)
    {
        processFunding(msg.value);
    }

    /**
     * @notice Redeems a winning ticket that has been signed by a sender and reveals the
     recipient recipientRand that corresponds to the recipientRandHash included in the ticket
     * @param _ticket Winning ticket to be redeemed in order to claim payment
     * @param _sig Sender's signature over the hash of `_ticket`
     * @param _recipientRand The preimage for the recipientRandHash included in `_ticket`
     */
    function redeemWinningTicket(
        Ticket memory _ticket,
        bytes memory _sig,
        uint256 _recipientRand
    ) public whenSystemNotPaused currentRoundInitialized {
        bytes32 ticketHash = getTicketHash(_ticket);

        // Require a valid winning ticket for redemption
        requireValidWinningTicket(_ticket, ticketHash, _sig, _recipientRand);

        Sender storage sender = senders[_ticket.sender];

        // Require sender to be locked
        require(isLocked(sender), "sender is unlocked");
        // Require either a non-zero deposit or non-zero reserve for the sender
        require(sender.deposit > 0 || remainingReserve(_ticket.sender) > 0, "sender deposit and reserve are zero");

        // Mark ticket as used to prevent replay attacks involving redeeming
        // the same winning ticket multiple times
        usedTickets[ticketHash] = true;

        uint256 amountToTransfer = 0;

        if (_ticket.faceValue > sender.deposit) {
            // If ticket face value > sender's deposit then claim from
            // the sender's reserve

            amountToTransfer = sender.deposit.add(
                claimFromReserve(_ticket.sender, _ticket.recipient, _ticket.faceValue.sub(sender.deposit))
            );

            sender.deposit = 0;
        } else {
            // If ticket face value <= sender's deposit then only deduct
            // from sender's deposit

            amountToTransfer = _ticket.faceValue;
            sender.deposit = sender.deposit.sub(_ticket.faceValue);
        }

        if (amountToTransfer > 0) {
            winningTicketTransfer(_ticket.recipient, amountToTransfer, _ticket.auxData);

            emit WinningTicketTransfer(_ticket.sender, _ticket.recipient, amountToTransfer);
        }

        emit WinningTicketRedeemed(
            _ticket.sender,
            _ticket.recipient,
            _ticket.faceValue,
            _ticket.winProb,
            _ticket.senderNonce,
            _recipientRand,
            _ticket.auxData
        );
    }

    /**
     * @notice Initiates the unlock period for the caller
     */
    function unlock() public whenSystemNotPaused {
        Sender storage sender = senders[msg.sender];

        require(sender.deposit > 0 || remainingReserve(msg.sender) > 0, "sender deposit and reserve are zero");
        require(!_isUnlockInProgress(sender), "unlock already initiated");

        uint256 currentRound = roundsManager().currentRound();
        sender.withdrawRound = currentRound.add(unlockPeriod);

        emit Unlock(msg.sender, currentRound, sender.withdrawRound);
    }

    /**
     * @notice Cancels the unlock period for the caller
     */
    function cancelUnlock() public whenSystemNotPaused {
        Sender storage sender = senders[msg.sender];

        _cancelUnlock(sender, msg.sender);
    }

    /**
     * @notice Withdraws all ETH from the caller's deposit and reserve
     */
    function withdraw() public whenSystemNotPaused {
        Sender storage sender = senders[msg.sender];

        uint256 deposit = sender.deposit;
        uint256 reserve = remainingReserve(msg.sender);

        require(deposit > 0 || reserve > 0, "sender deposit and reserve are zero");
        require(_isUnlockInProgress(sender), "no unlock request in progress");
        require(!isLocked(sender), "account is locked");

        sender.deposit = 0;
        clearReserve(msg.sender);

        withdrawTransfer(msg.sender, deposit.add(reserve));

        emit Withdrawal(msg.sender, deposit, reserve);
    }

    /**
     * @notice Returns whether a sender is currently in the unlock period
     * @param _sender Address of sender
     * @return Boolean indicating whether `_sender` has an unlock in progress
     */
    function isUnlockInProgress(address _sender) public view returns (bool) {
        Sender memory sender = senders[_sender];
        return _isUnlockInProgress(sender);
    }

    /**
     * @notice Returns info about a sender
     * @param _sender Address of sender
     * @return Info about the sender for `_sender`
     */
    function getSenderInfo(address _sender) public view returns (Sender memory sender, ReserveInfo memory reserve) {
        sender = senders[_sender];
        reserve = getReserveInfo(_sender);
    }

    /**
     * @dev Returns the hash of a ticket
     * @param _ticket Ticket to be hashed
     * @return keccak256 hash of `_ticket`
     */
    function getTicketHash(Ticket memory _ticket) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _ticket.recipient,
                    _ticket.sender,
                    _ticket.faceValue,
                    _ticket.winProb,
                    _ticket.senderNonce,
                    _ticket.recipientRandHash,
                    _ticket.auxData
                )
            );
    }

    /**
     * @dev Helper to cancel an unlock
     * @param _sender Sender that is cancelling an unlock
     * @param _senderAddress Address of sender
     */
    function _cancelUnlock(Sender storage _sender, address _senderAddress) internal {
        require(_isUnlockInProgress(_sender), "no unlock request in progress");

        _sender.withdrawRound = 0;

        emit UnlockCancelled(_senderAddress);
    }

    /**
     * @dev Validates a winning ticket, succeeds or reverts
     * @param _ticket Winning ticket to be validated
     * @param _ticketHash Hash of `_ticket`
     * @param _sig Sender's signature over `_ticketHash`
     * @param _recipientRand The preimage for the recipientRandHash included in `_ticket`
     */
    function requireValidWinningTicket(
        Ticket memory _ticket,
        bytes32 _ticketHash,
        bytes memory _sig,
        uint256 _recipientRand
    ) internal view {
        require(_ticket.recipient != address(0), "ticket recipient is null address");
        require(_ticket.sender != address(0), "ticket sender is null address");

        requireValidTicketAuxData(_ticket.auxData);

        require(
            keccak256(abi.encodePacked(_recipientRand)) == _ticket.recipientRandHash,
            "recipientRand does not match recipientRandHash"
        );

        require(!usedTickets[_ticketHash], "ticket is used");

        require(isValidTicketSig(_ticket.sender, _sig, _ticketHash), "invalid signature over ticket hash");

        require(isWinningTicket(_sig, _recipientRand, _ticket.winProb), "ticket did not win");
    }

    /**
     * @dev Returns whether a sender is locked
     * @param _sender Sender to check for locked status
     * @return Boolean indicating whether sender is currently locked
     */
    function isLocked(Sender memory _sender) internal view returns (bool) {
        return _sender.withdrawRound == 0 || roundsManager().currentRound() < _sender.withdrawRound;
    }

    /**
     * @dev Returns whether a signature over a ticket hash is valid for a sender
     * @param _sender Address of sender
     * @param _sig Signature over `_ticketHash`
     * @param _ticketHash Hash of the ticket
     * @return Boolean indicating whether `_sig` is valid signature over `_ticketHash` for `_sender`
     */
    function isValidTicketSig(
        address _sender,
        bytes memory _sig,
        bytes32 _ticketHash
    ) internal pure returns (bool) {
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(_ticketHash), _sig);
        return signer != address(0) && _sender == signer;
    }

    /**
     * @dev Returns whether a ticket won
     * @param _sig Sender's signature over the ticket
     * @param _recipientRand The preimage for the recipientRandHash included in the ticket
     * @param _winProb The winning probability of the ticket
     * @return Boolean indicating whether the ticket won
     */
    function isWinningTicket(
        bytes memory _sig,
        uint256 _recipientRand,
        uint256 _winProb
    ) internal pure returns (bool) {
        return uint256(keccak256(abi.encodePacked(_sig, _recipientRand))) < _winProb;
    }

    /**
     * @dev Helper to check if a sender is currently in the unlock period
     * @param _sender Sender to check for an unlock
     * @return Boolean indicating whether the sender is currently in the unlock period
     */
    function _isUnlockInProgress(Sender memory _sender) internal pure returns (bool) {
        return _sender.withdrawRound > 0;
    }
}
