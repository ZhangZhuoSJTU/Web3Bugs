//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MarketRegistryMock is Initializable {
    struct Market {
        address uToken;
        address userManager;
    }

    address[] public uTokenList;
    address[] public userManagerList;
    mapping(address => Market) public tokens;

    function __MarketRegistryMock_init() public initializer {}

    function addUToken(address token, address uToken) public {
        uTokenList.push(uToken);
        tokens[token].uToken = uToken;
    }

    function addUserManager(address token, address userManager) public {
        userManagerList.push(userManager);
        tokens[token].userManager = userManager;
    }

    function deleteMarket(address token) public {
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

        tokens[token].uToken = address(0);

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

        tokens[token].userManager = address(0);
    }
}
