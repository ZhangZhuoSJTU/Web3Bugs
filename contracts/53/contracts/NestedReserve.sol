// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Stores underlying assets of NestedNFTs.
/// @notice The factory itself can only trigger a transfer after verification that the user
///         holds funds present in this contract. Only the factory can withdraw assets.
contract NestedReserve is Ownable {
    using SafeERC20 for IERC20;

    /// @dev The current factory address
    address public factory;

    /// @dev Emitted when the factory address is updated by the owner
    event FactoryUpdated(address newFactory);

    constructor(address _factory) {
        factory = _factory;
    }

    /// @dev Reverts if the address does not exist
    /// @param _address The address to check
    modifier valid(address _address) {
        require(_address != address(0), "NestedReserve: INVALID_ADDRESS");
        _;
    }

    /// @dev Reverts if the caller is not the factory
    modifier onlyFactory() {
        require(_msgSender() == factory, "NestedReserve: UNAUTHORIZED");
        _;
    }

    /// @notice Release funds to a recipient
    /// @param _recipient The receiver
    /// @param _token The token to transfer
    /// @param _amount The amount to transfer
    function transfer(
        address _recipient,
        IERC20 _token,
        uint256 _amount
    ) external onlyFactory valid(_recipient) valid(address(_token)) {
        _token.safeTransfer(_recipient, _amount);
    }

    /// @notice Release funds to the factory
    /// @param _token The ERC20 to transfer
    /// @param _amount The amount to transfer
    function withdraw(IERC20 _token, uint256 _amount) external onlyFactory valid(address(_token)) {
        _token.safeTransfer(factory, _amount);
    }

    /// Transfer funds from the factory directly
    /// @param _token The ERC20 to transfer
    /// @param _amount The amount to transfer
    function transferFromFactory(IERC20 _token, uint256 _amount) external onlyFactory {
        _token.safeTransferFrom(factory, address(this), _amount);
    }

    /// @notice Update the factory address
    /// @param _newFactory The new factory address
    function updateFactory(address _newFactory) external onlyOwner {
        require(_newFactory != address(0), "NestedReserve: INVALID_ADDRESS");
        factory = _newFactory;
        emit FactoryUpdated(_newFactory);
    }
}
