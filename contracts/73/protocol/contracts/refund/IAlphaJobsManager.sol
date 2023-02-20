pragma solidity ^0.5.11;

contract IAlphaJobsManager {
    function broadcasters(address _broadcaster) public view returns (uint256 deposit, uint256 withdrawBlock);
}
