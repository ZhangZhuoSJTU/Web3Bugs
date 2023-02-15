// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "./LPToken.sol";

import "../../interfaces/dex-v2/wrapper/ILPWrapper.sol";

contract LPWrapper is ILPWrapper, ProtocolConstants, Ownable {
    mapping(IERC20 => IERC20Extended) public override tokens;

    constructor(address pool) {
        require(
            pool != _ZERO_ADDRESS,
            "LPWrapper::constructor: Misconfiguration"
        );
        transferOwnership(pool);
    }

    function createWrapper(IERC20 foreignAsset) external override onlyOwner {
        require(
            tokens[foreignAsset] == IERC20Extended(_ZERO_ADDRESS),
            "LPWrapper::createWrapper: Already Created"
        );

        // NOTE: Here, `owner` is the VaderPoolV2
        tokens[foreignAsset] = IERC20Extended(
            address(
                new LPToken(
                    IERC20Extended(address(foreignAsset)),
                    IVaderPoolV2(owner())
                )
            )
        );
    }
}
