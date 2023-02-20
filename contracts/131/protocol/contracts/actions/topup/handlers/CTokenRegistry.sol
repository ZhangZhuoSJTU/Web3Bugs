// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../../../interfaces/vendor/CToken.sol";
import "../../../../interfaces/vendor/Comptroller.sol";
import "../../../../interfaces/ICTokenRegistry.sol";
import "../../../../libraries/Errors.sol";
import "../../../../libraries/UncheckedMath.sol";

contract CTokenRegistry is ICTokenRegistry {
    using UncheckedMath for uint256;

    Comptroller public immutable comptroller;
    bytes32 internal immutable _ethCTokenSymbol;

    address public constant COMPTROLLER_MAINNET_ADDRESS =
        address(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);

    mapping(address => address) internal _underlyingToCToken;

    constructor(address comptrollerAddress) {
        comptroller = Comptroller(comptrollerAddress);
        _ethCTokenSymbol = keccak256(abi.encodePacked("cETH"));
        _updateCTokenMapping();
    }

    /**
     * @notice Tries to read the CToken contract address for a given underlying token address
     * If not found, tries to fetch it from the Comptroller contract and fails if
     * cannot find it in the comptroller either
     */
    function fetchCToken(address underlying) external override returns (address) {
        address ctoken = getCToken(underlying, false);
        if (ctoken != address(0)) {
            return ctoken;
        }

        _updateCTokenMapping();
        return getCToken(underlying, true);
    }

    /**
     * @notice Reads the CToken contract address for a given underlying token address
     * or fails if not found
     */
    function getCToken(address underlying) external view override returns (address) {
        return getCToken(underlying, true);
    }

    /**
     * @notice Reads the CToken contract address for a given underlying token address
     * If `ensureExists` is `true`, fails if not found, otherwise returns address 0
     */
    function getCToken(address underlying, bool ensureExists)
        public
        view
        override
        returns (address)
    {
        address ctoken = _underlyingToCToken[underlying];
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
        uint256 length_ = ctokens.length;
        for (uint256 i; i < length_; i = i.uncheckedInc()) {
            CToken ctoken = ctokens[i];
            if (!_isCTokenUsable(address(ctoken))) {
                continue;
            }
            if (keccak256(abi.encodePacked(ctoken.symbol())) == _ethCTokenSymbol) {
                _underlyingToCToken[address(0)] = address(ctoken);
            } else {
                _underlyingToCToken[ctoken.underlying()] = address(ctoken);
            }
        }
    }

    function _isCTokenUsable(address ctoken) internal view returns (bool) {
        Comptroller comptroller_ = comptroller;
        (bool listed, , ) = comptroller_.markets(ctoken);
        // NOTE: comptroller.isDeprecated is not available on Kovan
        bool deprecated = address(comptroller_) == COMPTROLLER_MAINNET_ADDRESS &&
            comptroller_.isDeprecated(ctoken);
        return listed && !deprecated;
    }
}
