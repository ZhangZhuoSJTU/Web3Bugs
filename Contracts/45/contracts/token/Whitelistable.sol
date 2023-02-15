//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
pragma abicoder v1;

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract Whitelistable is Ownable {
    // allow all transfers when set as false
    bool public whitelistEnabled;

    // allow transfers when `whitelistEnabled` is set as true
    mapping(address => bool) internal _whitelisted;

    event Whitelisted(address indexed _account);
    event Unwhitelisted(address indexed _account);
    event WhitelistEnabled();
    event WhitelistDisabled();

    modifier checkWhitelist() {
        if (whitelistEnabled) {
            require(_whitelisted[msg.sender], "Whitelistable: address not whitelisted");
        }
        _;
    }

    /**
     * @notice enable whitelist and only allow transfers from whitelisted addresses
     */
    function enableWhitelist() external onlyOwner {
        whitelistEnabled = true;
        emit WhitelistEnabled();
    }

    /**
     * @notice disable whitelist and allow transfers for everyone
     */
    function disableWhitelist() external onlyOwner {
        whitelistEnabled = false;
        emit WhitelistDisabled();
    }

    /**
     * @dev Checks if account is whitelisted
     * @param _account The address to check
     */
    function isWhitelisted(address _account) public view returns (bool) {
        return _whitelisted[_account];
    }

    /**
     * @dev Adds account to whitelist
     * @param _account The address to whitelist
     */
    function whitelist(address _account) public onlyOwner {
        _whitelisted[_account] = true;
        emit Whitelisted(_account);
    }

    /**
     * @dev Removes account from whitelist
     * @param _account The address to remove from the whitelist
     */
    function unwhitelist(address _account) external onlyOwner {
        _whitelisted[_account] = false;
        emit Unwhitelisted(_account);
    }
}
