// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IVoteProxy.sol";

contract YaxisVoteProxy {
    IVoteProxy public voteProxy;
    address public governance;
    constructor() public {
        governance = msg.sender;
    }

    function name() external pure returns (string memory) {
        return "YAXIS Vote Power";
    }

    function symbol() external pure returns (string memory) {
        return "YAX VP";
    }

    function decimals() external view returns (uint8) {
        return voteProxy.decimals();
    }

    function totalSupply() external view returns (uint256) {
        return voteProxy.totalSupply();
    }

    function balanceOf(address _voter) external view returns (uint256) {
        return voteProxy.balanceOf(_voter);
    }

    function setVoteProxy(IVoteProxy _voteProxy) external {
        require(msg.sender == governance, "!governance");
        voteProxy = _voteProxy;
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }



/**
 * This function allows governance to take unsupported tokens out of the contract.
 * This is in an effort to make someone whole, should they seriously mess up.
 * There is no guarantee governance will vote to return these.
 * It also allows for removal of airdropped tokens.
 */
    function governanceRecoverUnsupported(IERC20 _token, uint256 amount, address to) external {
        require(msg.sender == governance, "!governance");
        _token.transfer(to, amount);
    }
}
