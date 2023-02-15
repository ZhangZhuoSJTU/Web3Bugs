pragma solidity ^0.5.11;

contract MTicketBrokerCore {
    struct Ticket {
        address recipient; // Address of ticket recipient
        address sender; // Address of ticket sender
        uint256 faceValue; // Face value of ticket paid to recipient if ticket wins
        uint256 winProb; // Probability ticket will win represented as winProb / (2^256 - 1)
        uint256 senderNonce; // Sender's monotonically increasing counter for each ticket
        bytes32 recipientRandHash; // keccak256 hash commitment to recipient's random value
        bytes auxData; // Auxilary data included in ticket used for additional validation
    }

    // Emitted when funds are added to a sender's deposit
    event DepositFunded(address indexed sender, uint256 amount);
    // Emitted when a winning ticket is redeemed
    event WinningTicketRedeemed(
        address indexed sender,
        address indexed recipient,
        uint256 faceValue,
        uint256 winProb,
        uint256 senderNonce,
        uint256 recipientRand,
        bytes auxData
    );
    // Emitted when a funds transfer for a winning ticket redemption is executed
    event WinningTicketTransfer(address indexed sender, address indexed recipient, uint256 amount);
    // Emitted when a sender requests an unlock
    event Unlock(address indexed sender, uint256 startRound, uint256 endRound);
    // Emitted when a sender cancels an unlock
    event UnlockCancelled(address indexed sender);
    // Emitted when a sender withdraws its deposit & reserve
    event Withdrawal(address indexed sender, uint256 deposit, uint256 reserve);
}
