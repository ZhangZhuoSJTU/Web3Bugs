pragma solidity ^0.5.11;

contract Poll {
    // The block at which the poll ends and votes can no longer be submitted.
    uint256 public endBlock;

    // Vote is emitted when an account submits a vote with 'choiceID'.
    // This event can be indexed to tally all votes for each choiceID
    event Vote(address indexed voter, uint256 choiceID);

    modifier isActive() {
        require(block.number <= endBlock, "poll is over");
        _;
    }

    constructor(uint256 _endBlock) public {
        endBlock = _endBlock;
    }

    /**
     * @dev Vote for the poll's proposal.
     *      Reverts if the poll period is over.
     * @param _choiceID the ID of the option to vote for
     */
    function vote(uint256 _choiceID) external isActive {
        emit Vote(msg.sender, _choiceID);
    }

    /**
     * @dev Destroy the Poll contract after the poll has finished
     *      Reverts if the poll is still active
     */
    function destroy() external {
        require(block.number > endBlock, "poll is active");
        selfdestruct(msg.sender);
    }
}
