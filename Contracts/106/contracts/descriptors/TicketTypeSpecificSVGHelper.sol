// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import '../interfaces/ITicketTypeSpecificSVGHelper.sol';
import "@openzeppelin/contracts/utils/Strings.sol";

contract TicketTypeSpecificSVGHelper is ITicketTypeSpecificSVGHelper {
    /// See {ITicketTypeSpecificSVGHelper-backgroundColorsStyles}
    function backgroundColorsStyles(
        string memory collateralAsset,
        string memory loanAsset
    ) 
        external 
        pure 
        override 
        virtual 
        returns (string memory) 
    {}

    /// See {ITicketTypeSpecificSVGHelper}
    function ticketIdXCoordinate() external pure virtual override returns (string memory) {}

    /// See {ITicketTypeSpecificSVGHelper}
    function backgroundTitleRectsXTranslate() external pure virtual override returns (string memory) {}

    /// See {ITicketTypeSpecificSVGHelper}
    function titlesPositionClass() external pure virtual override returns (string memory) {}
    
    /// See {ITicketTypeSpecificSVGHelper}
    function titlesXTranslate() external pure virtual override returns (string memory) {}

    /// See {ITicketTypeSpecificSVGHelper}
    function backgroundValueRectsXTranslate() external pure virtual override returns (string memory) {}

    /// See {ITicketTypeSpecificSVGHelper}
    function alignmentClass() external pure virtual override returns (string memory) {}

    /// See {ITicketTypeSpecificSVGHelper}
    function valuesXTranslate() external pure virtual override returns (string memory) {}

    /// @dev used by backgroundColorsStyles, returns SVG style classes    
    function colorStyles(string memory primary, string memory secondary) internal pure returns (string memory) {
        return string.concat(
            '.highlight-hue{stop-color:',
            addressStringToHSL(primary),
            '}',
            '.highlight-offset{stop-color:',
            addressStringToHSL(secondary),
            '}'
        );
    }

    /**
     * @dev returns a string, an HSL color specification that can be used in SVG styles. 
     * where H, S, and L, are derived from `account`
     */
    function addressStringToHSL(string memory account) private pure returns (string memory) {
        bytes32 hs = keccak256(abi.encodePacked(account));
        uint256 h = (uint256(uint8(hs[0])) + uint8(hs[1])) % 360;
        uint256 s = 80 + (uint8(hs[2]) % 20);
        uint256 l = 80 + (uint8(hs[3]) % 10);
        return string.concat(
            'hsl(',
            Strings.toString(h),
            ',',
            Strings.toString(s),
            '%,',
            Strings.toString(l),
            '%)'
        );
    }
}