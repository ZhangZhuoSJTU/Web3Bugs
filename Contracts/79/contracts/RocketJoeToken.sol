// SPDX-License-Identifier: None

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRocketJoeFactory.sol";

/// @title Rocket Joe Token - rJOE
/// @author Trader Joe
/// @notice Infinite supply, but burned to join launch event
contract RocketJoeToken is ERC20("RocketJoeToken", "rJOE"), Ownable {
    IRocketJoeFactory public rocketJoeFactory;

    /// @notice Modifier which checks if message.sender is a launch event
    modifier onlyRJLaunchEvent() {
        require(
            rocketJoeFactory.isRJLaunchEvent(msg.sender),
            "RocketJoeToken: caller is not a RJLaunchEvent"
        );
        _;
    }

    /// @notice Initialise the rocketJoeFactory address
    function initialize() external {
        require(
            address(rocketJoeFactory) == address(0),
            "RocketJoeToken: already initialized"
        );

        rocketJoeFactory = IRocketJoeFactory(msg.sender);
    }

    /// @dev Creates `_amount` token to `_to`. Must only be called by the owner (RocketJoeStaking)
    /// @param _to The address that will receive the mint
    /// @param _amount The amount to be minted
    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
    }

    /// @dev Destroys `_amount` tokens from `_from`. Callable only by a RJLaunchEvent
    /// this doesn't need any approval in order to avoid double approval before entering each launch event
    /// @param _from The address that will burn tokens
    /// @param _amount The amount to be burned
    function burnFrom(address _from, uint256 _amount)
        external
        onlyRJLaunchEvent
    {
        _burn(_from, _amount);
    }

    /// @dev Hook that is called before any transfer of tokens. This includes
    /// minting and burning
    /// @param _from The address that will transfer the tokens
    /// @param _to The address that will receive the tokens
    /// @param _amount The amount of token to send
    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal virtual override {
        require(
            _from == address(0) || _to == address(0) || _from == owner(),
            "RocketJoeToken: can't send token"
        );
    }
}
