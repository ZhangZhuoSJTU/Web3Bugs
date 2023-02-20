// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./NFTXEligibility.sol";
import "../interface/IPrevNftxContract.sol";

contract NFTXDeferEligibility is NFTXEligibility {

    function name() public view override virtual returns (string memory) {    
        return "Defer";
    }

    function finalized() public view override virtual returns (bool) {    
        return true;
    }

    address public deferAddress;
    uint256 public deferVaultId;

    event NFTXEligibilityInit(address deferAddress, uint256 deferralVaultId);

    constructor() public {
        __NFTXEligibility_init(address(0), 0);
    }

    struct Config {
        address deferAddress;
        uint256 deferVaultId;
    }

    function __NFTXEligibility_init_bytes(
        bytes memory configData
    ) public override virtual initializer {
        (address _deferAddress, uint256 _deferId) = abi.decode(configData, (address, uint256));
        __NFTXEligibility_init(_deferAddress, _deferId);
    }

    // Parameters here should mirror the config struct. 
    function __NFTXEligibility_init(
        address _deferAddress,
        uint256 _deferVaultId
    ) public initializer {
        deferAddress = _deferAddress;
        deferVaultId = _deferVaultId;
        emit NFTXEligibilityInit(_deferAddress, _deferVaultId);
    }

    function _checkIfEligible(
        uint256 _tokenId
    ) internal view override virtual returns (bool) {
        return IPrevNftxContract(deferAddress).isEligible(deferVaultId, _tokenId);
    }
}
