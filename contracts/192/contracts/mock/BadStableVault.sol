// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../utils/MetaContext.sol";
import "../interfaces/IStableVault.sol";

interface IERC20Mintable is IERC20 {
    function mintFor(address, uint256) external;
    function burnFrom(address, uint256) external;
    function decimals() external view returns (uint);
}

interface ERC20Permit is IERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

contract BadStableVault is MetaContext, IStableVault {

    mapping(address => bool) public allowed;
    mapping(address => uint) private tokenIndex;
    address[] public tokens;

    address public immutable stable;

    constructor(address _stable) {
        stable = _stable;
    }

    function deposit(address _token, uint256 _amount) public {
    }

    function depositWithPermit(address _token, uint256 _amount, uint256 _deadline, bool _permitMax, uint8 v, bytes32 r, bytes32 s) external {
    }

    function withdraw(address _token, uint256 _amount) external returns (uint256 _output) {
        _output = _amount;
    }

    function listToken(address _token) external onlyOwner {
        allowed[_token] = true;
    }

    function delistToken(address _token) external onlyOwner {
    }
}