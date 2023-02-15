// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC20} from "solmate/tokens/ERC20.sol";

import {CERC20} from "../../interfaces/Comptroller.sol";
import {PriceFeed} from "../../interfaces/PriceFeed.sol";
import {Comptroller} from "../../interfaces/Comptroller.sol";

contract MockComptroller is Comptroller {
    /*///////////////////////////////////////////////////////////////
                            COMPTROLLER LOGIC
    //////////////////////////////////////////////////////////////*/

    mapping(ERC20 => CERC20) public override cTokensByUnderlying;

    struct Market {
        bool isListed;
        uint256 collateralFactor;
    }

    mapping(CERC20 => Market) public override markets;

    address public immutable override admin;

    PriceFeed public immutable override oracle;

    function enterMarkets(CERC20[] calldata cTokens) external returns (uint256[] memory errors) {
        errors = new uint256[](cTokens.length); // Will be filled with all 0s.

        for (uint256 i = 0; i < cTokens.length; i++) isMember[msg.sender][cTokens[i]] = true;
    }

    /*///////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _admin, PriceFeed _oracle) {
        admin = _admin;
        oracle = _oracle;
    }

    /*///////////////////////////////////////////////////////////////
                             MOCK LOGIC
    //////////////////////////////////////////////////////////////*/

    mapping(address => mapping(CERC20 => bool)) public isMember;

    function mapUnderlyingToCToken(ERC20 asset, CERC20 cToken) external {
        cTokensByUnderlying[asset] = cToken;
    }

    function setMarket(CERC20 cToken, Market calldata newMarket) external {
        markets[cToken] = newMarket;
    }
}
