//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

interface IChildToken {
    function deposit(address user, bytes calldata depositData) external;
}

contract PolygonERC20Wrapper is ERC20Upgradeable, IChildToken {
    IERC20Upgradeable public underlying;
    address public childChainManager;

    function initialize(
        IERC20Upgradeable underlyingToken_,
        address childChainManager_,
        string memory name_,
        string memory symbol_
    ) initializer public {
        require(
            address(underlyingToken_) != address(0),
            "new underlyingToken is the zero address"
        );
        require(
            childChainManager_ != address(0),
            "new childChainManager is the zero address"
        );
        __ERC20_init(name_, symbol_);

        underlying = underlyingToken_;
        childChainManager = childChainManager_;
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

        SafeERC20Upgradeable.safeTransfer(underlying, user, amount);
        emit Transfer(address(0), user, amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external {
        SafeERC20Upgradeable.safeTransferFrom(
            underlying,
            _msgSender(),
            address(this),
            amount
        );
        _mint(_msgSender(), amount);
        _burn(_msgSender(), amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     * @param recipient recipient of tokens to withdraw
     */
    function withdrawTo(uint256 amount, address recipient) external {
        SafeERC20Upgradeable.safeTransferFrom(
            underlying,
            _msgSender(),
            address(this),
            amount
        );
        _mint(recipient, amount);
        _burn(recipient, amount);
    }
}
