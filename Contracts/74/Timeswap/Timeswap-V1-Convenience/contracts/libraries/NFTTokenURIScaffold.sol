// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMetadata} from './SafeMetadata.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {DateTime} from './DateTime.sol';
import './Base64.sol';
import {NFTSVG} from './NFTSVG.sol';


library NFTTokenURIScaffold {
    using SafeMetadata for IERC20;
    using Strings for uint256;

    function tokenURI(
        uint256 id,
        IPair pair,
        IPair.Due memory due,
        uint256 maturity
    ) public view returns (string memory) {

        string memory uri = constructTokenSVG(
            address(pair.asset()),
            address(pair.collateral()),
            id.toString(),
            weiToPrecisionString(due.debt, pair.asset().safeDecimals()),
            weiToPrecisionString(due.collateral, pair.collateral().safeDecimals()),
            getReadableDateString(maturity),
            maturity
        );


        string memory description = string(abi.encodePacked('This collateralized debt position represents a debt of ', weiToPrecisionString(due.debt, pair.asset().safeDecimals()), ' ', pair.asset().safeSymbol(), ' borrowed against a collateral of ', weiToPrecisionString(due.collateral, pair.collateral().safeDecimals()), ' ', pair.collateral().safeSymbol(), '. This position will expire on ', maturity.toString(), ' unix epoch time.\\nThe owner of this NFT has the option to pay the debt before maturity time to claim the locked collateral. In case the owner choose to default on the debt payment, the collateral will be forfeited'));
        description = string(abi.encodePacked(description, '\\n\\nAsset Address: ', addressToString(address(pair.asset())), '\\nCollateral Address: ', addressToString(address(pair.collateral())), '\\nDebt Required: ', weiToPrecisionLongString(due.debt, pair.asset().safeDecimals()), ' ', IERC20(pair.asset()).safeSymbol(), '\\nCollateral Locked: ', weiToPrecisionLongString(due.collateral, pair.collateral().safeDecimals()), ' ', IERC20(pair.collateral()).safeSymbol()));


        string memory name = "Timeswap Collateralized Debt";

        return (constructTokenURI(name, description, uri));
    }


    function constructTokenURI(
        string memory name,
        string memory description,
        string memory imageSVG
    ) internal pure returns (string memory) {

        return
            string(
                abi.encodePacked(
                    'data:application/json;base64,',
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"',
                                name,
                                '", "description":"',
                                description,
                                '", "image": "',
                                'data:image/svg+xml;base64,',
                                Base64.encode(bytes(imageSVG)),
                                '"}'
                            )
                        )
                    )
                )
            );
    }



    function constructTokenSVG (
        address asset,
        address collateral,
        string memory tokenId,
        string memory assetAmount, 
        string memory collateralAmount, 
        string memory maturityDate,
        uint256 maturityTimestamp
    ) internal view returns (string memory) {

       

        /// TODO - finalize SVG
        NFTSVG.SVGParams memory params = NFTSVG.SVGParams({
            tokenId: tokenId,
            svgTitle: string(abi.encodePacked(parseSymbol(IERC20(asset).safeSymbol()), '/', parseSymbol(IERC20(collateral).safeSymbol()))),
            assetInfo: string(abi.encodePacked(parseSymbol(IERC20(asset).safeSymbol()), ': ', addressToString(asset))),
            collateralInfo: string(abi.encodePacked(parseSymbol(IERC20(collateral).safeSymbol()), ': ', addressToString(collateral))),
            debtRequired: string(abi.encodePacked(assetAmount, ' ', parseSymbol(IERC20(asset).safeSymbol()))),
            collateralLocked: string(abi.encodePacked(collateralAmount, ' ', parseSymbol(IERC20(collateral).safeSymbol()))),
            maturityDate: maturityDate,
            isMatured: block.timestamp > maturityTimestamp,
            maturityTimestampString: maturityTimestamp.toString(),
            tokenColors: getSVGCData(asset, collateral)

        });

        return NFTSVG.constructSVG(params);
    }

    function weiToPrecisionLongString(uint256 weiAmt, uint256 decimal) public pure returns (string memory) {
        if (decimal == 0) {
            return string(abi.encodePacked(weiAmt.toString(), '.00'));
        }

        uint256 significantDigits = weiAmt/(10 ** decimal);
        uint256 precisionDigits = weiAmt % (10 ** (decimal));
        
        if (precisionDigits == 0) {
            return string(abi.encodePacked(significantDigits.toString(), '.00'));
        }

        string memory precisionDigitsString = toStringTrimmed(precisionDigits);
        uint lengthDiff = decimal - bytes(precisionDigits.toString()).length;
        for(uint i = 0; i < lengthDiff; i++) {
            precisionDigitsString = string(abi.encodePacked('0', precisionDigitsString));
        }

        return string(abi.encodePacked(significantDigits.toString(), '.', precisionDigitsString));
    }
    
    function weiToPrecisionString(uint256 weiAmt, uint256 decimal) public pure returns (string memory) {
        if (decimal == 0) {
            return string(abi.encodePacked(weiAmt.toString(), '.00'));
        }

        uint256 significantDigits = weiAmt/(10 ** decimal);
        if (significantDigits > 10 ** 9) {
            string memory weiAmtString = weiAmt.toString();
            uint len = bytes(weiAmtString).length - 9;
            weiAmt = weiAmt / (10 ** len);
            return string(abi.encodePacked(weiAmt.toString(), '...'));
        }
        uint256 precisionDigits = weiAmt % (10 ** (decimal));
        precisionDigits = precisionDigits/(10 ** (decimal - 4));
        
        if (precisionDigits == 0) {
            return string(abi.encodePacked(significantDigits.toString(), '.00'));
        }

        string memory precisionDigitsString = toStringTrimmed(precisionDigits);
        uint lengthDiff = 4 - bytes(precisionDigits.toString()).length;
        for(uint i = 0; i < lengthDiff; i++) {
            precisionDigitsString = string(abi.encodePacked('0', precisionDigitsString));
        }

        return string(abi.encodePacked(significantDigits.toString(), '.', precisionDigitsString));
    }
    
    function toStringTrimmed(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        uint256 flag;
        while (temp != 0) {
            if (temp % 10 == 0 && flag == 0) {
                temp /= 10;
                continue;
            } else if (temp % 10 != 0 && flag == 0) {
                flag++;
                digits++;
            } else {
                digits++;
            }
            
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        flag = 0;
        while (value != 0) {
            if (value % 10 == 0 && flag == 0) {
                value /= 10;
                continue;
            } else if (value % 10 != 0 && flag == 0) {
                flag++;
                digits -= 1;
                buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            } else {
                digits -= 1;
                buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            }
            
            value /= 10;
        }
        return string(buffer);
    }

    function addressToString(address _addr) public pure returns (string memory) {
        bytes memory data = abi.encodePacked(_addr);
        bytes memory alphabet = '0123456789abcdef';

        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }


    function getSlice(uint256 begin, uint256 end, string memory text) public pure returns (string memory) {
        bytes memory a = new bytes(end-begin+1);
        for(uint i=0;i<=end-begin;i++){
            a[i] = bytes(text)[i+begin-1];
        }
        return string(a);    
    }
    
    function parseSymbol(string memory symbol) public pure returns (string memory) {
        if (bytes(symbol).length > 5) {
            return getSlice(1, 5, symbol);
        }
        return symbol;
    }

    function getMonthString(uint256 _month) public pure returns (string memory) {
        string[12] memory months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[_month];
    }

    function getReadableDateString(uint256 timestamp) public pure returns (string memory) {
        
        (uint year, uint month, uint day, uint hour, uint minute, uint second) = DateTime.timestampToDateTime(timestamp);
        
        string memory result = string(abi.encodePacked(
            day.toString(),
            ' ',
            getMonthString(month - 1),
            ' ',
            year.toString(),
            ', ',
            padWithZero(hour),
            ':',
            padWithZero(minute),
            ':',
            padWithZero(second),
            ' UTC'
        ));
        return result;
    }

    function padWithZero(uint value) public pure returns (string memory) {
        if (value < 10) {
            return string(abi.encodePacked('0', value.toString()));
        }
        return value.toString();
    }

    function getLightColor(address token) public pure returns (string memory) {
        string[15] memory lightColors = [
            'F7BAF7',
            'F7C8BA',
            'FAE2BE',
            'BAE1F7',
            'EBF7BA',
            'CEF7BA',
            'CED2EF',
            'CABAF7',
            'BAF7E5',
            'BACFF7',
            'F7BAE3',
            'F7E9BA',
            'E0BAF7',
            'F7BACF',
            'FFFFFF'
        ];
        uint160 tokenValue = uint160(token) % 15;
        return(lightColors[tokenValue]);
    }

    function getDarkColor(address token) public pure returns (string memory) {

        string[15] memory darkColors = [
            'DF51EC',
            'EC7651',
            'ECAE51',
            '51B4EC',
            'A4C327',
            '59C327',
            '5160EC',
            '7951EC',
            '27C394',
            '5185EC',
            'EC51B8',
            'F4CB3A',
            'B151EC',
            'EC5184',
            'C5C0C2'
        ];
        uint160 tokenValue = uint160(token) % 15;
        return(darkColors[tokenValue]);
    }

    function getSVGCData(address asset, address collateral) public pure returns (string memory) {
            string memory token0LightColor = string(abi.encodePacked('.C{fill:#', getLightColor(asset), '}'));
            string memory token0DarkColor = string(abi.encodePacked('.D{fill:#', getDarkColor(asset), '}'));
            string memory token1LightColor = string(abi.encodePacked('.E{fill:#', getLightColor(collateral), '}'));
            string memory token1DarkColor = string(abi.encodePacked('.F{fill:#', getDarkColor(collateral), '}'));

            return string(abi.encodePacked(token0LightColor, token0DarkColor, token1LightColor, token1DarkColor));
    }


}

