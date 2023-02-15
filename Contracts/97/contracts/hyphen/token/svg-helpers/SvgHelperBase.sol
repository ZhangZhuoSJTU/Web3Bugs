// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";

abstract contract SvgHelperBase is Ownable {
    using Strings for uint256;

    uint256 public tokenDecimals;

    event BackgroundUrlUpdated(string newBackgroundUrl);
    event TokenDecimalsUpdated(uint256 newTokenDecimals);

    constructor(uint256 _tokenDecimals) Ownable() {
        tokenDecimals = _tokenDecimals;
    }

    function setTokenDecimals(uint256 _tokenDecimals) public onlyOwner {
        tokenDecimals = _tokenDecimals;
        emit TokenDecimalsUpdated(_tokenDecimals);
    }

    /// @notice Given an integer, returns the number of digits in it's decimal representation.
    /// @param _number The number to get the number of digits in.
    /// @return The number of digits in the decimal representation of the given number.
    function _getDigitsCount(uint256 _number) internal pure returns (uint256) {
        uint256 count = 0;
        while (_number > 0) {
            ++count;
            _number /= 10;
        }
        return count;
    }

    /// @notice Generates a string containing 0s of the given length.
    /// @param _length The length of the string to generate.
    /// @return A string of 0s of the given length.
    function _getZeroString(uint256 _length) internal pure returns (string memory) {
        if (_length == 0) {
            return "";
        }
        string memory result;
        for (uint256 i = 0; i < _length; ++i) {
            result = string(abi.encodePacked(result, "0"));
        }
        return result;
    }

    /// @notice Truncate Digits from the right
    function _truncateDigitsFromRight(uint256 _number, uint256 _digitsCount) internal pure returns (uint256) {
        uint256 result = _number /= (10**_digitsCount);
        // Remove Leading Zeroes
        while (result != 0 && result % 10 == 0) {
            result /= 10;
        }
        return result;
    }

    /// @notice Return str(_value / 10^_power)
    function _divideByPowerOf10(
        uint256 _value,
        uint256 _power,
        uint256 _maxDigitsAfterDecimal
    ) internal pure returns (string memory) {
        uint256 integerPart = _value / 10**_power;
        uint256 leadingZeroesToAddBeforeDecimal = 0;
        uint256 fractionalPartTemp = _value % (10**_power);

        uint256 powerRemaining = _power;
        if (fractionalPartTemp != 0) {
            // Remove Leading Zeroes
            while (fractionalPartTemp != 0 && fractionalPartTemp % 10 == 0) {
                fractionalPartTemp /= 10;
                if (powerRemaining > 0) {
                    powerRemaining--;
                }
            }

            uint256 expectedFractionalDigits = powerRemaining;
            if (_getDigitsCount(fractionalPartTemp) < expectedFractionalDigits) {
                leadingZeroesToAddBeforeDecimal = expectedFractionalDigits - _getDigitsCount(fractionalPartTemp);
            }
        }

        if (fractionalPartTemp == 0) {
            return integerPart.toString();
        }
        uint256 digitsToTruncateCount = _getDigitsCount(fractionalPartTemp) + leadingZeroesToAddBeforeDecimal >
            _maxDigitsAfterDecimal
            ? _getDigitsCount(fractionalPartTemp) + leadingZeroesToAddBeforeDecimal - _maxDigitsAfterDecimal
            : 0;
        return
            string(
                abi.encodePacked(
                    integerPart.toString(),
                    ".",
                    _getZeroString(leadingZeroesToAddBeforeDecimal),
                    _truncateDigitsFromRight(fractionalPartTemp, digitsToTruncateCount).toString()
                )
            );
    }

    function getAttributes(uint256 _suppliedLiquidity, uint256 _totalSuppliedLiquidity)
        public
        view
        virtual
        returns (string memory)
    {
        string memory suppliedLiquidity = _divideByPowerOf10(_suppliedLiquidity, tokenDecimals, 3);
        string memory sharePercent = _calculatePercentage(_suppliedLiquidity, _totalSuppliedLiquidity);
        return
            string(
                abi.encodePacked(
                    "[",
                    '{ "trait_type": "Supplied Liquidity", "display_type": "number", "value": ',
                    suppliedLiquidity,
                    '},{ "trait_type": "Share Percentage", "value": "',
                    sharePercent,
                    '%"}]'
                )
            );
    }

    function getDescription(uint256 _suppliedLiquidity, uint256 _totalSuppliedLiquidity)
        public
        view
        virtual
        returns (string memory)
    {
        return
            string(
                abi.encodePacked(
                    "This NFT represents your position as Liquidity Provider on Hyphen Bridge on ",
                    getChainName(),
                    ". To visit the bridge, visit [Hyphen](https://hyphen.biconomy.io)."
                )
            );
    }

    /// @notice Return str(_value / _denom * 100)
    function _calculatePercentage(uint256 _num, uint256 _denom) internal pure returns (string memory) {
        return _divideByPowerOf10((_num * 10**(18 + 2)) / _denom, 18, 2);
    }

    function getTokenSvg(
        uint256 _tokenId,
        uint256 _suppliedLiquidity,
        uint256 _totalSuppliedLiquidity
    ) public view virtual returns (string memory);

    function getChainName() public view virtual returns (string memory);
}
