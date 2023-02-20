// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "solmate/tokens/ERC721.sol";
import "openzeppelin/utils/Strings.sol";
import "hot-chain-svg/SVG.sol";
import "base64/base64.sol";

// removes balanceOf modifications
// questionable tradeoff but given our use-case it's reasonable
// saves 20k gas when minting which about 30% gas on buys/vault creations
abstract contract CallyNft is ERC721("Cally", "CALL") {
    // remove balanceOf modifications
    function _mint(address to, uint256 id) internal override {
        require(to != address(0), "INVALID_RECIPIENT");
        require(_ownerOf[id] == address(0), "ALREADY_MINTED");

        _ownerOf[id] = to;

        emit Transfer(address(0), to, id);
    }

    // burns a token without checking owner address is not 0
    // and removes balanceOf modifications
    function _burn(uint256 id) internal override {
        address owner = _ownerOf[id];

        delete _ownerOf[id];
        delete getApproved[id];

        emit Transfer(owner, address(0), id);
    }

    // set balanceOf to max for all users
    function balanceOf(address owner) public pure override returns (uint256) {
        require(owner != address(0), "ZERO_ADDRESS");
        return type(uint256).max;
    }

    // forceTransfer option position NFT out of owner's wallet and give to new buyer
    function _forceTransfer(address to, uint256 id) internal {
        require(to != address(0), "INVALID_RECIPIENT");

        address from = _ownerOf[id];
        _ownerOf[id] = to;
        delete getApproved[id];

        emit Transfer(from, to, id);
    }

    function renderJson(
        address token_,
        uint256 tokenIdOrAmount_,
        uint256 premium_,
        uint256 durationDays_,
        uint256 dutchAuctionStartingStrike_,
        uint256 currentExpiration_,
        uint256 currentStrike_,
        bool isExercised_,
        bool isVault_
    ) public pure returns (string memory) {
        string memory token = addressToString(token_);
        string memory tokenIdOrAmount = Strings.toString(tokenIdOrAmount_);
        string memory premium = Strings.toString(premium_);
        string memory durationDays = Strings.toString(durationDays_);
        string memory dutchAuctionStartingStrike = Strings.toString(dutchAuctionStartingStrike_);
        string memory currentExpiration = Strings.toString(currentExpiration_);
        string memory currentStrike = Strings.toString(currentStrike_);
        string memory isExercised = Strings.toString(isExercised_ ? 1 : 0);
        string memory nftType = isVault_ ? "Vault" : "Option";

        string memory svgStr = renderSvg(
            token,
            tokenIdOrAmount,
            premium,
            durationDays,
            dutchAuctionStartingStrike,
            currentExpiration,
            currentStrike,
            isExercised,
            nftType
        );

        string memory json = string.concat(
            /* solhint-disable quotes */
            '{"name":"',
            "Cally",
            '","description":"',
            "NFT and ERC20 covered call vaults",
            '","image": "data:image/svg+xml;base64,',
            Base64.encode(bytes(svgStr)),
            '","attributes": [',
            '{ "trait_type": "token",',
            '"value": "',
            token,
            '"},',
            '{ "trait_type": "tokenIdOrAmount",',
            '"value": "',
            tokenIdOrAmount,
            '"},',
            '{ "trait_type": "premium",',
            '"value": "',
            premium,
            '"},',
            '{ "trait_type": "durationDays",',
            '"value": "',
            durationDays,
            '"},',
            '{ "trait_type": "dutchAuctionStartingStrike",',
            '"value": "',
            dutchAuctionStartingStrike,
            '"},',
            '{ "trait_type": "currentExpiration",',
            '"value": "',
            currentExpiration,
            '"},',
            '{ "trait_type": "currentStrike",',
            '"value": "',
            currentStrike,
            '"},',
            '{ "trait_type": "isExercised",',
            '"value": "',
            isExercised,
            '"},',
            '{ "trait_type": "nftType",',
            '"value": "',
            nftType,
            '"}',
            "]}"
            /* solhint-enable quotes */
        );

        return json;
    }

    function renderSvg(
        string memory token,
        string memory tokenIdOrAmount,
        string memory premium,
        string memory durationDays,
        string memory dutchAuctionStartingStrike,
        string memory currentExpiration,
        string memory currentStrike,
        string memory isExercised,
        string memory nftType
    ) public pure returns (string memory) {
        return
            string.concat(
                // solhint-disable-next-line quotes
                '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350" style="background:#000">',
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "20"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Token: "), token)
                ),
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "40"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Token ID or Amount: "), tokenIdOrAmount)
                ),
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "60"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Premium (WEI): "), premium)
                ),
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "80"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Duration (days): "), durationDays)
                ),
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "100"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Starting strike (WEI): "), dutchAuctionStartingStrike)
                ),
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "120"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Expiration (UNIX): "), currentExpiration)
                ),
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "140"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Strike (WEI): "), currentStrike)
                ),
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "160"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Exercised (y/n): "), isExercised)
                ),
                svg.text(
                    string.concat(
                        svg.prop("x", "10"),
                        svg.prop("y", "180"),
                        svg.prop("font-size", "12"),
                        svg.prop("fill", "white")
                    ),
                    string.concat(svg.cdata("Type: "), nftType)
                ),
                "</svg>"
            );
    }

    function addressToString(address account) public pure returns (string memory) {
        bytes memory data = abi.encodePacked(account);

        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }

        return string(str);
    }
}
