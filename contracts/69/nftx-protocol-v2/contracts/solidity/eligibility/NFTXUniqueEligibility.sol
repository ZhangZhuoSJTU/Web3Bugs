// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../util/OwnableUpgradeable.sol";
import "./UniqueEligibility.sol";
import "./NFTXEligibility.sol";

// Maybe use guardian here?
contract NFTXUniqueEligibility is
    OwnableUpgradeable,
    NFTXEligibility,
    UniqueEligibility
{
    function name() public pure override virtual returns (string memory) {
        return "Unique";
    }

    function finalized() public view override virtual returns (bool) {
        return isInitialized && owner() == address(0);
    }
    
    function targetAsset() public pure override virtual returns (address) {
        return address(0);
    }

    address vault;
    bool public isInitialized; 
    bool public negateEligOnRedeem;

    struct Config {
        address owner;
        address vault;
        bool negateElig;
        bool finalize;
        uint256[] tokenIds;
    }

    event NFTXEligibilityInit(
        address owner,
        address vault,
        bool negateElig,
        bool finalize,
        uint256[] tokenIds
    );
    event negateEligilityOnRedeemSet(bool negateElig);

    function __NFTXEligibility_init_bytes(bytes memory _configData)
        public
        override
        virtual
        initializer
    {
        __Ownable_init();
        (address _owner, address _vault, bool finalize, bool negateElig, uint256[] memory _ids) = abi
            .decode(_configData, (address, address, bool, bool, uint256[]));
        __NFTXEligibility_init(_owner, _vault, negateElig, finalize, _ids);
    }

    function __NFTXEligibility_init(
        address _owner,
        address _vault,
        bool negateElig,
        bool finalize,
        uint256[] memory tokenIds
    ) public initializer {
        __Ownable_init();
        require(_owner != address(0), "Owner != address(0)");
        require(_vault != address(0), "Vault != address(0)");
        isInitialized = true;
        vault = _vault;
        negateEligOnRedeem = negateElig;
        _setUniqueEligibilities(tokenIds, true);
        emit NFTXEligibilityInit(
            _owner,
            _vault,
            negateElig,
            finalize,
            tokenIds
        );

        if (finalize) {
            renounceOwnership();
        } else {
            transferOwnership(_owner);
        }
    }

    function setEligibilityPreferences(bool _negateEligOnRedeem)
        external
        onlyOwner
    {
        negateEligOnRedeem = _negateEligOnRedeem;
        emit negateEligilityOnRedeemSet(_negateEligOnRedeem);
    }

    function setUniqueEligibilities(uint256[] memory tokenIds, bool _isEligible)
        external
        virtual
        onlyOwner
    {
        _setUniqueEligibilities(tokenIds, _isEligible);
    }

    function afterRedeemHook(uint256[] calldata tokenIds)
        external
        override
        virtual
    {
        require(msg.sender == vault);
        if (negateEligOnRedeem) {
            _setUniqueEligibilities(tokenIds, false);
        }
    }

    function _checkIfEligible(uint256 _tokenId)
        internal
        view
        override
        virtual
        returns (bool)
    {
        return isUniqueEligible(_tokenId);
    }
}
