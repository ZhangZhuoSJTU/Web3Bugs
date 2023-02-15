// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./NFTXEligibility.sol";
import "../interface/IPrevNftxContract.sol";

contract NFTXDeferEligibility is NFTXEligibility {

    function name() public pure override virtual returns (string memory) {    
        return "Defer";
    }

    function finalized() public view override virtual returns (bool) {    
        return true;
    }

    function targetAsset() public pure override virtual returns (address) {
        return address(0);
    }

    address public deferAddress;
    uint256 public deferVaultId;

    event NFTXEligibilityInit(address deferAddress, uint256 deferralVaultId);

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
        require(_deferAddress != address(0), "deferAddress != address(0)");
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
