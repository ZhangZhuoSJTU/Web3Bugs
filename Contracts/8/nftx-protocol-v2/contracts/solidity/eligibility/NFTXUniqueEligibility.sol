// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../util/OwnableUpgradeable.sol";
import "../util/SafeMathUpgradeable.sol";
import "./UniqueEligibility.sol";
import "./NFTXEligibility.sol";

// Maybe use guardian here?
contract NFTXUniqueEligibility is
    OwnableUpgradeable,
    NFTXEligibility,
    UniqueEligibility
{
    using SafeMathUpgradeable for uint256;

    function name() public view override virtual returns (string memory) {
        return "Unique";
    }

    address vault;
    bool public reverseEligOnRedeem;

    struct Config {
        address owner;
        address vault;
        bool reverseElig;
        bool finalize;
        uint256[] tokenIds;
    }

    event NFTXEligibilityInit(
        address owner,
        address vault,
        bool reverseElig,
        bool finalize,
        uint256[] tokenIds
    );
    event ReverseEligilityOnRedeemSet(bool reverseElig);

    /* constructor() public {
        __Ownable_init();
        renounceOwnership();
    } */

    function __NFTXEligibility_init_bytes(bytes memory _configData)
        public
        override
        virtual
        initializer
    {
        __Ownable_init();
        (address _owner, address _vault, bool finalize, bool reverseElig, uint256[] memory _ids) = abi
            .decode(_configData, (address, address, bool, bool, uint256[]));
        __NFTXEligibility_init(_owner, _vault, reverseElig, finalize, _ids);
    }

    function __NFTXEligibility_init(
        address _owner,
        address _vault,
        bool reverseElig,
        bool finalize,
        uint256[] memory tokenIds
    ) public initializer {
        __Ownable_init();
        _setUniqueEligibilities(tokenIds, true);
        vault = _vault;
        reverseEligOnRedeem = reverseElig;
        emit NFTXEligibilityInit(
            _owner,
            _vault,
            reverseElig,
            finalize,
            tokenIds
        );

        if (finalize) {
            renounceOwnership();
        } else {
            transferOwnership(_owner);
        }
    }

    function setEligibilityPreferences(bool _reverseEligOnRedeem)
        public
        onlyOwner
    {
        reverseEligOnRedeem = _reverseEligOnRedeem;
        emit ReverseEligilityOnRedeemSet(_reverseEligOnRedeem);
    }

    function setUniqueEligibilities(uint256[] memory tokenIds, bool _isEligible)
        public
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
        if (reverseEligOnRedeem) {
            _setUniqueEligibilities(tokenIds, false);
        }
    }

    function finalized() public view override virtual returns (bool) {
        return owner() == address(0);
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
