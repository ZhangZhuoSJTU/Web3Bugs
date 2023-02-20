// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
*  @title Abstract ownable contract with additional assetManager role
 * @notice Contract module based on Ownable which provides a basic access control mechanism, where
 * there is an account (an asset manager) that can be granted exclusive access to
 * specific functions.
 *
 * The asset manager account needs to be set using {setAssetManager}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyAssetManager`, which can be applied to your functions to restrict their use to
 * the asset manager.
 */
abstract contract AssetManager is ContextUpgradeable, OwnableUpgradeable {
    address private _assetManager;

    /**
     * @dev Emitted when _assetManager has been changed.
     * @param previousAssetManager former _assetManager address.
     * @param newAssetManager new _assetManager address.
     */
    event AssetManagerTransferred(address indexed previousAssetManager, address indexed newAssetManager);

    /**
     * @notice Gets current _assetManager.
     * @dev Returns current _assetManager address.
     * @return Current _assetManager address.
     */
    function assetManager() public view virtual returns (address) {
        return _assetManager;
    }

    /**
     * @dev Throws if called by any account other than the owner or asset manager.
     */
    modifier onlyOwnerOrAssetManager() {
        require(assetManager() == _msgSender() || owner() == _msgSender(), "onlyOwnerOrAssetManager/owner-or-manager");
        _;
    }

    /**
     * @notice Set or change of asset manager.
     * @dev Throws if called by any account other than the owner.
     * @param _newAssetManager New _assetManager address.
     * @return Boolean to indicate if the operation was successful or not.
     */
    function setAssetManager(address _newAssetManager) public virtual onlyOwner returns (bool) {
        require(_newAssetManager != address(0), "onlyOwnerOrAssetManager/assetManager-not-zero-address");

        address _previousAssetManager = _assetManager;
        _assetManager = _newAssetManager;

        emit AssetManagerTransferred(_previousAssetManager, _newAssetManager);
        return true;
    }
}
