pragma solidity ^0.5.11;

import "./Poll.sol";
import "../token/ILivepeerToken.sol";

contract PollCreator {
    // 33.33%
    uint256 public constant QUORUM = 333300;
    // 50%
    uint256 public constant QUOTA = 500000;
    // 10 rounds
    uint256 public constant POLL_PERIOD = 10 * 5760;
    uint256 public constant POLL_CREATION_COST = 100 * 1 ether;

    ILivepeerToken public token;

    event PollCreated(address indexed poll, bytes proposal, uint256 endBlock, uint256 quorum, uint256 quota);

    constructor(address _tokenAddr) public {
        token = ILivepeerToken(_tokenAddr);
    }

    /**
     * @dev Create a poll by burning POLL_CREATION_COST LPT.
     *      Reverts if this contract's LPT allowance for the sender < POLL_CREATION_COST.
     * @param _proposal The IPFS multihash for the proposal.
     */
    function createPoll(bytes calldata _proposal) external {
        uint256 endBlock = block.number + POLL_PERIOD;
        Poll poll = new Poll(endBlock);

        require(token.transferFrom(msg.sender, address(this), POLL_CREATION_COST), "LivepeerToken transferFrom failed");

        token.burn(POLL_CREATION_COST);

        emit PollCreated(address(poll), _proposal, endBlock, QUORUM, QUOTA);
    }
}
