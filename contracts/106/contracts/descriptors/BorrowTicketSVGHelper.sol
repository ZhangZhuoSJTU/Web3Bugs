// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import './TicketTypeSpecificSVGHelper.sol';

contract BorrowTicketSVGHelper is TicketTypeSpecificSVGHelper {
    /**
     * @dev Returns SVG styles where the primary background color is derived
     * from the collateral asset address and the secondary background color 
     * is derived from the loan asset address
     */
    function backgroundColorsStyles(
        string memory collateralAsset,
        string memory loanAsset
    ) 
        external 
        pure
        override 
        returns (string memory)
    {
        return colorStyles(collateralAsset, loanAsset);
    }

    /// See {ITicketTypeSpecificSVGHelper}
    function ticketIdXCoordinate() external pure override returns (string memory) {
        return '134';
    }
    
    /// See {ITicketTypeSpecificSVGHelper}
    function backgroundTitleRectsXTranslate() external pure override returns (string memory) {
        return '31';
    }

    /// See {ITicketTypeSpecificSVGHelper}
    function titlesPositionClass() external pure override returns (string memory) {
        return 'right';
    }

    /// See {ITicketTypeSpecificSVGHelper}
    function titlesXTranslate() external pure override returns (string memory) {
        return '121';
    }

    /// See {ITicketTypeSpecificSVGHelper}
    function backgroundValueRectsXTranslate() external pure override returns (string memory) {
        return '129';
    }

    /// See {ITicketTypeSpecificSVGHelper}
    function alignmentClass() external pure override returns (string memory) {
        return 'left';
    }

    /// See {ITicketTypeSpecificSVGHelper}
    function valuesXTranslate() external pure override returns (string memory) {
        return '136';
    }
}