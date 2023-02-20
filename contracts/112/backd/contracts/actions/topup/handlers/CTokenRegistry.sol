// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../../../../interfaces/vendor/CToken.sol";
import "../../../../interfaces/vendor/Comptroller.sol";
import "../../../../libraries/Errors.sol";

contract CTokenRegistry {
    Comptroller public immutable comptroller;

    address public constant COMPTROLLER_MAINNET_ADDRESS =
        address(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);

    mapping(address => address) internal _underlyingToCToken;

    constructor(address comptrollerAddress) {
        comptroller = Comptroller(comptrollerAddress);
        _updateCTokenMapping();
    }

    /**
     * @notice Tries to read the CToken contract address for a given underlying token address
     * If not found, tries to fetch it from the Comptroller contract and fails if
     * cannot find it in the comptroller either
     */
    function fetchCToken(address underlying) external returns (CToken) {
        CToken ctoken = getCToken(underlying, false);
        if (address(ctoken) != address(0)) {
            return CToken(ctoken);
        }

        _updateCTokenMapping();
        return getCToken(underlying, true);
    }

    /**
     * @notice Reads the CToken contract address for a given underlying token address
     * or fails if not found
     */
    function getCToken(address underlying) external view returns (CToken) {
        return getCToken(underlying, true);
    }

    /**
     * @notice Reads the CToken contract address for a given underlying token address
     * If `ensureExists` is `true`, fails if not found, otherwise returns address 0
     */
    function getCToken(address underlying, bool ensureExists) public view returns (CToken) {
        CToken ctoken = CToken(_underlyingToCToken[underlying]);
        if (ensureExists && (address(ctoken) == address(0) || !_isCTokenUsable(ctoken))) {
            revert(Error.UNDERLYING_NOT_SUPPORTED);
        }
        return ctoken;
    }

    /**
     * @dev Updates the CToken mapping by fetching information from the Comptroller contract
     */
    function _updateCTokenMapping() internal {
        CToken[] memory ctokens = comptroller.getAllMarkets();
        for (uint256 i = 0; i < ctokens.length; i++) {
            CToken ctoken = ctokens[i];
            if (!_isCTokenUsable(ctoken)) {
                continue;
            }
            if (
                keccak256(abi.encodePacked(ctoken.symbol())) == keccak256(abi.encodePacked("cETH"))
            ) {
                _underlyingToCToken[address(0)] = address(ctoken);
            } else {
                _underlyingToCToken[ctoken.underlying()] = address(ctoken);
            }
        }
    }

    function _isCTokenUsable(CToken ctoken) internal view returns (bool) {
        (bool listed, , ) = comptroller.markets(address(ctoken));
        // NOTE: comptroller.isDeprecated is not available on Kovan
        bool deprecated = address(comptroller) == COMPTROLLER_MAINNET_ADDRESS &&
            comptroller.isDeprecated(ctoken);
        return listed && !deprecated;
    }
}
