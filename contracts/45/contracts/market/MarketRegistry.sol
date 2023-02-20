//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../Controller.sol";

/**
 * @title MarketRegistry Contract
 * @dev Registering and managing all the lending markets.
 */
contract MarketRegistry is Controller {
    struct Market {
        address uToken;
        address userManager;
    }

    address[] public uTokenList;
    address[] public userManagerList;
    mapping(address => Market) public tokens;

    event LogAddUToken(address indexed tokenAddress, address contractAddress);

    event LogAddUserManager(address indexed tokenAddress, address contractAddress);

    modifier newToken(address token) {
        require(tokens[token].uToken == address(0), "MarketRegistry: has already exist this uToken");
        _;
    }

    modifier newUserManager(address token) {
        require(tokens[token].userManager == address(0), "MarketRegistry: has already exist this userManager");
        _;
    }

    /**
     *  @dev Initialization function
     */
    function __MarketRegistry_init() public initializer {
        Controller.__Controller_init(msg.sender);
    }

    /**
     *  @dev Retrieves the value of the state variable `uTokenList`
     *  @return Stored uToken address
     */
    function getUTokens() public view returns (address[] memory) {
        return uTokenList;
    }

    function getUserManagers() public view returns (address[] memory) {
        return userManagerList;
    }

    function addUToken(address token, address uToken) public newToken(token) onlyAdmin {
        uTokenList.push(uToken);
        tokens[token].uToken = uToken;
        emit LogAddUToken(token, uToken);
    }

    function addUserManager(address token, address userManager) public newUserManager(token) onlyAdmin {
        userManagerList.push(userManager);
        tokens[token].userManager = userManager;
        emit LogAddUserManager(token, userManager);
    }

    function deleteMarket(address token) public onlyAdmin {
        address oldUToken = tokens[token].uToken;
        bool uTokenExist = false;
        uint256 uTokenIndex = 0;

        for (uint256 i = 0; i < uTokenList.length; i++) {
            if (oldUToken == uTokenList[i]) {
                uTokenExist = true;
                uTokenIndex = i;
            }
        }

        if (uTokenExist) {
            uTokenList[uTokenIndex] = uTokenList[uTokenList.length - 1];
            uTokenList.pop();
        }

        delete tokens[token].uToken;

        address oldUserManager = tokens[token].userManager;
        bool userManagerExist = false;
        uint256 userManagerIndex = 0;

        for (uint256 i = 0; i < userManagerList.length; i++) {
            if (oldUserManager == userManagerList[i]) {
                userManagerExist = true;
                userManagerIndex = i;
            }
        }

        if (userManagerExist) {
            userManagerList[userManagerIndex] = userManagerList[userManagerList.length - 1];
            userManagerList.pop();
        }

        delete tokens[token].userManager;
    }
}
