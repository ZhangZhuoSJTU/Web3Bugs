pragma solidity ^0.5.11;

import "./IAlphaJobsManager.sol";

contract Refunder {
    // Reference to alpha JobsManager
    IAlphaJobsManager public alphaJobsManager;

    // Keeps track of addresses that have withdrawn their refund
    mapping(address => bool) public withdrawn;

    event FundsReceived(address from, uint256 amount);
    event RefundWithdrawn(address indexed addr, uint256 amount);

    /**
     * @notice Refunder constructor
     * @param _alphaJobsManagerAddr Address of alpha JobsManager
     */
    constructor(address _alphaJobsManagerAddr) public {
        alphaJobsManager = IAlphaJobsManager(_alphaJobsManagerAddr);
    }

    /**
     * @dev Receive and log receipt of ETH
     */
    function() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    /**
     * @notice Withdraws the alpha JobsManager refund for the given address
     * @param _addr The address to withdraw for
     */
    function withdraw(address payable _addr) external {
        require(!withdrawn[_addr], "address has already withdrawn alpha JobsManager refund");

        (uint256 deposit, ) = alphaJobsManager.broadcasters(_addr);

        require(deposit > 0, "address does not have a deposit with alpha JobsManager");

        withdrawn[_addr] = true;

        _addr.transfer(deposit);

        emit RefundWithdrawn(_addr, deposit);
    }
}
