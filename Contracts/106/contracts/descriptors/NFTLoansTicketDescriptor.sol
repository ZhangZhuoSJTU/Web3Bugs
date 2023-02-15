// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import 'base64-sol/base64.sol';
import '../NFTLoanFacilitator.sol';
import './libraries/NFTLoanTicketSVG.sol';
import './libraries/PopulateSVGParams.sol';

contract NFTLoansTicketDescriptor {
    // Lend or Borrow 
    string public nftType;
    ITicketTypeSpecificSVGHelper immutable public svgHelper;

    /// @dev Initializes the contract by setting a `nftType` and `svgHelper`
    constructor(string memory _nftType, ITicketTypeSpecificSVGHelper _svgHelper) {
        nftType = _nftType;
        svgHelper = _svgHelper;
    }

    /**
     * @dev Returns a string which is a data uri of base64 encoded JSON,
     * the JSON contains the token metadata: name, description, image
     * which reflect information about `id` loan in `nftLoanFacilitator`
     */ 
    function uri(NFTLoanFacilitator nftLoanFacilitator, uint256 id)
        external
        view
        returns (string memory)
    {
        NFTLoanTicketSVG.SVGParams memory svgParams;
        svgParams.nftType = nftType;
        svgParams = PopulateSVGParams.populate(svgParams, nftLoanFacilitator, id);
        
        return generateDescriptor(svgParams);
    }

    /**
     * @dev Returns a string which is a data uri of base64 encoded JSON,
     * the JSON contains the token metadata: name, description, image.
     * The metadata values come from `svgParams`
     */ 
    function generateDescriptor(NFTLoanTicketSVG.SVGParams memory svgParams)
        private
        view
        returns (string memory)
    {
        return string.concat(
            'data:application/json;base64,',
            Base64.encode(
                bytes(
                    string.concat(
                        '{"name":"',
                        svgParams.nftType,
                        ' ticket',
                        ' #',
                        svgParams.id,
                        '", "description":"',
                        generateDescription(svgParams.id),
                        generateDescriptionDetails(
                            svgParams.loanAssetContract,
                            svgParams.loanAssetSymbol,
                            svgParams.collateralContract, 
                            svgParams.collateralAssetSymbol,
                            svgParams.collateralId),
                        '", "image": "',
                        'data:image/svg+xml;base64,',
                        Base64.encode(bytes(NFTLoanTicketSVG.generateSVG(svgParams, svgHelper))),
                        '"}'
                    )
                )
            )
        );
    }

    /// @dev Returns string, ticket type (borrow or lend) specific description      
    function generateDescription(string memory loanId) internal pure virtual returns (string memory) {}

    /// @dev Returns string, important info about the loan that this ticket is related to 
    function generateDescriptionDetails(
        string memory loanAsset,
        string memory loanAssetSymbol,
        string memory collateralAsset,
        string memory collateralAssetSymbol,
        string memory collateralAssetId
    ) 
        private 
        pure 
        returns (string memory) 
    {
        return string.concat(
            '\\n\\nCollateral Address: ',
            collateralAsset,
            ' (',
            collateralAssetSymbol,
            ')\\n\\n',
            'Collateral ID: ',
            collateralAssetId,
            '\\n\\n',
            'Loan Asset Address: ',
            loanAsset,
            ' (',
            loanAssetSymbol,
            ')\\n\\n',
            'WARNING: Do your own research to verify the legitimacy of the assets related to this ticket'
        );
    }
}