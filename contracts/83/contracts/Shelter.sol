// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IShelter } from "./interfaces/IShelter.sol";
import { IShelterClient } from "./interfaces/IShelterClient.sol";

contract Shelter is IShelter {
    using SafeERC20 for IERC20;

    IShelterClient public immutable client;

    uint256 public constant GRACE_PERIOD = 1 weeks;

    mapping(IERC20 => mapping(address => bool)) public override claimed;

    mapping(IERC20 => uint256) public activated;

    mapping(IERC20 => uint256) public savedTokens;

    modifier onlyClient {
        require(msg.sender == address(client), "!client");
        _;
    }

    constructor(IShelterClient _client){
        client = _client;
    }

    function donate(IERC20 _token, uint256 _amount) external {
        require(activated[_token] != 0, "!activated");
        savedTokens[_token] += _amount;
        _token.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function activate(IERC20 _token) external override onlyClient {
        activated[_token] = block.timestamp;
        savedTokens[_token] = _token.balanceOf(address(this));
        emit ShelterActivated(_token);
    }

    function deactivate(IERC20 _token) external override onlyClient {
        require(activated[_token] != 0 && activated[_token] + GRACE_PERIOD > block.timestamp, "too late");
        activated[_token] = 0;
        savedTokens[_token] = 0;
        _token.safeTransfer(msg.sender, _token.balanceOf(address(this)));
        emit ShelterDeactivated(_token);
    }

    function withdraw(IERC20 _token, address _to) external override {
        require(activated[_token] != 0 && activated[_token] + GRACE_PERIOD < block.timestamp, "shelter not activated");
        uint256 amount = savedTokens[_token] * client.shareOf(_token, msg.sender) / client.totalShare(_token);
        claimed[_token][_to] = true;
        emit ExitShelter(_token, msg.sender, _to, amount);
        _token.safeTransfer(_to, amount);
    }
}
