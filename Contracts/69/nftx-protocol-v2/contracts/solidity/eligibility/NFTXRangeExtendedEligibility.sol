// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../util/OwnableUpgradeable.sol";
import "./UniqueEligibility.sol";
import "./NFTXEligibility.sol";

contract NFTXRangeExtendedEligibility is
    OwnableUpgradeable,
    NFTXEligibility,
    UniqueEligibility
{

    function name() public pure override virtual returns (string memory) {
        return "RangeExtended";
    }

    function finalized() public view override virtual returns (bool) {
        return isInitialized && owner() == address(0);
    }

    function targetAsset() public pure override virtual returns (address) {
        return address(0);
    }

    bool public isInitialized;
    uint256 public rangeStart;
    uint256 public rangeEnd;

    struct Config {
        address owner;
        uint256 rangeStart;
        uint256 rangeEnd;
    }
    event RangeSet(uint256 rangeStart, uint256 rangeEnd);
    event NFTXEligibilityInit(
        address owner,
        uint256 rangeStart,
        uint256 rangeEnd
    );

    function __NFTXEligibility_init_bytes(bytes memory _configData)
        public
        override
        virtual
        initializer
    {
        (address _owner, uint256 _rangeStart, uint256 _rangeEnd) = abi
            .decode(_configData, (address, uint256, uint256));
        __NFTXEligibility_init(_owner, _rangeStart, _rangeEnd);
    }

    function __NFTXEligibility_init(
        address _owner,
        uint256 _rangeStart,
        uint256 _rangeEnd
    ) public initializer {
        __Ownable_init();
        isInitialized = true;
        require(_rangeStart <= _rangeEnd, "Not valid");
        rangeStart = _rangeStart;
        rangeEnd = _rangeEnd;
        emit RangeSet(_rangeStart, _rangeEnd);
        emit NFTXEligibilityInit(_owner, _rangeStart, _rangeEnd);

        transferOwnership(_owner);
    }

    function setEligibilityPreferences(uint256 _rangeStart, uint256 _rangeEnd)
        external
        virtual
        onlyOwner
    {
        require(_rangeStart <= _rangeEnd, "Not valid");
        rangeStart = _rangeStart;
        rangeEnd = _rangeEnd;
        emit RangeSet(_rangeStart, _rangeEnd);
    }

    function setUniqueEligibilities(
        uint256[] calldata tokenIds,
        bool _isEligible
    ) external virtual onlyOwner {
        _setUniqueEligibilities(tokenIds, _isEligible);
    }

    function _checkIfEligible(uint256 _tokenId)
        internal
        view
        override
        virtual
        returns (bool)
    {
        bool isElig;
        if (rangeEnd > 0) {
            isElig = _tokenId >= rangeStart && _tokenId <= rangeEnd;
        }
        // Good to leave this here because if its a branch where it isn't eligibile via range or eligibility,
        // the tx will fail anyways and not have a cost to the user.
        // i.e. This is only a cost to users if unique eligibilty is used in conjunction with range and its a valid NFT.
        if (!isElig) {
            isElig = isUniqueEligible(_tokenId);
        }
        return isElig;
    }
}
