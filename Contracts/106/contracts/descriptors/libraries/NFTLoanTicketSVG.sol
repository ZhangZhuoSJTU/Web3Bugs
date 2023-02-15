// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
import 'base64-sol/base64.sol';
import '../../interfaces/ITicketTypeSpecificSVGHelper.sol';


library NFTLoanTicketSVG {

    struct SVGParams{
        // "Borrow" or "Lend"
        string nftType;
        // The Token Id, which is also the Id of the associated loan in NFTLoanFacilitator
        string id;
        // Human readable status, see {PopulateSVGParams-loanStatus}
        string status;
        // The approximate APR loan interest rate
        string interestRate;
        // The contract address of the ERC20 loan asset
        string loanAssetContract;
        // The symbol of the ERC20 loan asset
        string loanAssetSymbol;
        // The contract address of the ERC721 collateral asset
        string collateralContract;
        // The contract address of the ERC721 collateral asset, shortened for display
        string collateralContractPartial;
        // Symbol of the ERC721 collateral asset
        string collateralAssetSymbol;
        // TokenId of the ERC721 collateral asset
        string collateralId;
        // The loan amount, in loan asset units
        string loanAmount;
        // The interest accrued so far on the loan, in loan asset units
        string interestAccrued;
        // The loan duration in days, 0 if duration is less than 1 day
        string durationDays;
        // The UTC end date and time of the loan, 'n/a' if loan does not have lender
        string endDateTime;
    }

    /// @notice returns an SVG image as a string. The SVG image is specific to the SVGParams
    function generateSVG(SVGParams memory params, ITicketTypeSpecificSVGHelper typeSpecificHelper) 
    internal 
    pure 
    returns (string memory svg) 
    {
        return string.concat(
            '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" ',
            'xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" ',
            'viewBox="0 0 300 300" style="enable-background:new 0 0 300 300;" xml:space="preserve">',
            stylesAndBackground(
                typeSpecificHelper,
                params.id,
                params.loanAssetContract,
                params.collateralContract
            ),
            staticValues(params.nftType, typeSpecificHelper),
            dynamicValues(params, typeSpecificHelper),
            dynamicValues2(params),
            '</svg>'
        );
    }

    function stylesAndBackground(
        ITicketTypeSpecificSVGHelper typeSpecificHelper,
        string memory id, 
        string memory loanAsset,
        string memory collateralAsset
    ) 
        private 
        pure
        returns (string memory) 
    {
        return string.concat(
            '<style type="text/css">',
                '.st0{fill:url(#wash);}',
                '.st1{width: 171px; height: 23px; opacity:0.65; fill:#FFFFFF;}',
                '.st2{width: 171px; height: 23px; opacity:0.45; fill:#FFFFFF;}',
                '.st3{width: 98px; height: 23px; opacity:0.2; fill:#FFFFFF;}',
                '.st4{width: 98px; height: 23px; opacity:0.35; fill:#FFFFFF;}',
                '.st5{font-family: monospace, monospace; font-size: 28px;}',
                '.st7{font-family: monospace, monospace; font-size:10px; fill:#000000; opacity: .9;}',
                '.st8{width: 98px; height: 54px; opacity:0.35; fill:#FFFFFF;}',
                '.st9{width: 171px; height: 54px; opacity:0.65; fill:#FFFFFF;}',
                '.right{text-anchor: end;}',
                '.left{text-anchor: start;}',
                typeSpecificHelper.backgroundColorsStyles(loanAsset, collateralAsset),
            '</style>',
            '<defs>',
                '<radialGradient id="wash" cx="120" cy="40" r="140" gradientTransform="skewY(5)" ',
                'gradientUnits="userSpaceOnUse">',
                    '<stop  offset="0%" class="highlight-hue"/>',
                    '<stop  offset="100%" class="highlight-offset"/>',
                    '<animate attributeName="r" values="300;520;320;420;300" dur="25s" repeatCount="indefinite"/>',
                    '<animate attributeName="cx" values="120;420;260;120;60;120" dur="25s" repeatCount="indefinite"/>',
                    '<animate attributeName="cy" values="40;300;40;250;390;40" dur="25s" repeatCount="indefinite"/>',
                '</radialGradient>',
            '</defs>',
            '<rect x="0" class="st0" width="300" height="300"/>',
            '<rect y="31" x="',
            typeSpecificHelper.backgroundValueRectsXTranslate(),
            '" width="171" height="54" style="opacity:0.65; fill:#FFFFFF;"/>',
            '<text x="',
            typeSpecificHelper.ticketIdXCoordinate(),
            '" y="69" class="st5 ',
            typeSpecificHelper.alignmentClass(),
            '" fill="black">',
            id,
            '</text>'
        );
    }

    function staticValues(
        string memory ticketType,
        ITicketTypeSpecificSVGHelper typeSpecificHelper
    )
        private
        pure
        returns (string memory) 
    {
        return string.concat(
            '<g transform="translate(',
            typeSpecificHelper.backgroundTitleRectsXTranslate(),
            ',0)">',
                '<rect y="31" class="st8"/>',
                '<rect y="85" class="st3"/>',
                '<rect y="108" class="st4"/>',
                '<rect y="131" class="st3"/>',
                '<rect y="154" class="st4"/>',
                '<rect y="177" class="st3"/>',
                '<rect y="200" class="st4"/>',
                '<rect y="223" class="st3"/>',
                '<rect y="246" class="st4"/>',
            '</g>',
            '<g class="st7 ',
            typeSpecificHelper.titlesPositionClass(),
            '" transform="translate(',
            typeSpecificHelper.titlesXTranslate(),
            ',0)">',
                '<text y="56">',
                ticketType,
                'er</text>',
                '<text y="70">Ticket</text>',
                '<text y="99">Loan Amount</text>',
                '<text y="122">Interest Rate</text>',
                '<text y="145">Status</text>',
                '<text y="168">Accrued</text>',
                '<text y="191">Collateral NFT</text>',
                '<text y="214">Collateral ID</text>',
                '<text y="237">Duration</text>',
                '<text y="260">End Date</text>',
            '</g>',
            '<g transform="translate(',
            typeSpecificHelper.backgroundValueRectsXTranslate(),
            ',0)">',
                '<rect y="246" class="st1"/>',
                '<rect y="223" class="st2"/>',
                '<rect y="200" class="st1"/>',
                '<rect y="177" class="st2"/>',
                '<rect y="154" class="st1"/>',
                '<rect y="131" class="st2"/>',
                '<rect y="108" class="st1"/>',
                '<rect y="85" class="st2"/>',
            '</g>'
        );
    }

    function dynamicValues(
        SVGParams memory params, 
        ITicketTypeSpecificSVGHelper typeSpecificHelper
    ) 
        private
        pure
        returns (string memory) 
    {
        return string.concat(
            '<g class="st7 ',
            typeSpecificHelper.alignmentClass(),
            '" transform="translate(',
            typeSpecificHelper.valuesXTranslate(),
            ',0)">',
            '<text y="99">',
            params.loanAmount, 
            ' ',
            params.loanAssetSymbol,
            '</text>',
            '<text y="122">',
            params.interestRate,
            '</text>',
            '<text y="145">',
            params.status,
            '</text>',
            '<text y="168">'
        );
    }

    function dynamicValues2(
        SVGParams memory params
    ) 
        private 
        pure 
        returns (string memory) 
    {
        return string.concat(
            params.interestAccrued,
            ' ',
            params.loanAssetSymbol,
            '</text>',
            '<text y="191">(',
            params.collateralAssetSymbol,
            ') ',
            params.collateralContractPartial,
            '</text>',
            '<text y="214">',
            params.collateralId,
            '</text>',
            '<text y="237">',
            params.durationDays,
            ' days </text>',
            '<text y="260">',
            params.endDateTime,
            '</text>',
            '</g>'
        );
    }
}
