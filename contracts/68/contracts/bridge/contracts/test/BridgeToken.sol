//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IBridgeToken.sol";

contract BridgeToken is ERC20, IBridgeToken {
    address public immutable childChainManager;
    address public immutable owner;

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");

        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address childChainManager_
    ) ERC20(name_, symbol_) {
        owner = _msgSender();
        childChainManager = childChainManager_;
    }

    function mint(address account, uint256 amount) external override onlyOwner {
        _mint(account, amount);
    }

    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required amount for user
     * Make sure minting is done only by this function
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded amount
     */
    function deposit(address user, bytes calldata depositData)
        external
        override
    {
        require(_msgSender() == childChainManager, "ONLY_CHILD_CHAIN_MANAGER");
        uint256 amount = abi.decode(depositData, (uint256));

        emit Transfer(address(0), user, amount); //mint
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external override {
        _burn(_msgSender(), amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     * @param recipient recipient of tokens to withdraw
     */
    function withdrawTo(uint256 amount, address recipient) external override {
        _transfer(_msgSender(), recipient, amount);
        _burn(recipient, amount);
    }
}
