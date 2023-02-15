// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../util/SafeMathUpgradeable.sol";
import "./UniqueEligibility.sol";
import "./NFTXEligibility.sol";

contract NFTXListEligibility is NFTXEligibility, UniqueEligibility {
    using SafeMathUpgradeable for uint256;

    function name() public view override virtual returns (string memory) {    
        return "List";
    }

    address vault;
    bool public reverseEligOnRedeem;

    struct Config {
        address vault;
        bool reverseElig;
        uint256[] tokenIds;
    }

    event NFTXEligibilityInit(address vault, bool reverseElig, uint256[] tokenIds);
    event ReverseEligilityOnRedeemSet(bool reverseElig);

    function __NFTXEligibility_init_bytes(
        bytes memory _configData
    ) public override virtual initializer {
        (address _vault, bool reverseElig, uint256[] memory _ids) = abi.decode(_configData, (address, bool, uint256[]));
        __NFTXEligibility_init(_vault, reverseElig, _ids);
    }

    function __NFTXEligibility_init(
        address _vault,
        bool reverseElig,
        uint256[] memory tokenIds
    ) public initializer {
        _setUniqueEligibilities(tokenIds, true);
        vault = _vault;
        reverseEligOnRedeem = reverseElig;
        emit NFTXEligibilityInit(_vault, reverseElig, tokenIds);
    }

    function afterRedeemHook(uint256[] calldata tokenIds) external override virtual {
        require(msg.sender == vault);
        if (reverseEligOnRedeem) {
            _setUniqueEligibilities(tokenIds, false);
        }
    }

    function finalized() public view override virtual returns (bool) {    
        return true;
    }

    function _checkIfEligible(
        uint256 _tokenId
    ) internal view override virtual returns (bool) {
        return isUniqueEligible(_tokenId);
    }
}
