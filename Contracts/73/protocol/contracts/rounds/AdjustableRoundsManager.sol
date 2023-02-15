pragma solidity ^0.5.11;

import "./RoundsManager.sol";

contract AdjustableRoundsManager is RoundsManager {
    uint256 num;
    bytes32 hash;

    constructor(address _controller) public RoundsManager(_controller) {}

    function setBlockNum(uint256 _num) external {
        num = _num;
    }

    function setBlockHash(bytes32 _hash) external {
        hash = _hash;
    }

    function mineBlocks(uint256 _blocks) external {
        num += _blocks;
    }

    function blockNum() public view returns (uint256) {
        return num;
    }

    function blockHash(uint256 _block) public view returns (bytes32) {
        require(_block >= blockNum() - 256);

        return hash;
    }
}
