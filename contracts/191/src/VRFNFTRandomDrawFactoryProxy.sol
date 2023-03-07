// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IVRFNFTRandomDrawFactory} from "./interfaces/IVRFNFTRandomDrawFactory.sol";

/// @dev Zora NFT Creator Proxy Access Contract
contract VRFNFTRandomDrawFactoryProxy is ERC1967Proxy {
    /// @notice Setup new proxy for VRFNFTRandomDrawFactory
    /// @param _logic underlying logic impl contract
    /// @param _defaultOwner initial owner of the underlying contract
    constructor(address _logic, address _defaultOwner)
        ERC1967Proxy(
            _logic,
            abi.encodeWithSelector(
                IVRFNFTRandomDrawFactory.initialize.selector,
                _defaultOwner
            )
        )
    {}
}
