// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "../util/OwnableUpgradeable.sol";
import "../util/SafeMathUpgradeable.sol";
import "./UniqueEligibility.sol";
import "./NFTXEligibility.sol";

// Maybe use guardian here?
contract NFTXRangeEligibility is
    OwnableUpgradeable,
    NFTXEligibility,
    UniqueEligibility
{
    using SafeMathUpgradeable for uint256;

    function name() public view override virtual returns (string memory) {
        return "Range";
    }

    uint256 public rangeStart;
    uint256 public rangeEnd;

    struct Config {
        address owner;
        bool finalize;
        uint256 rangeStart;
        uint256 rangeEnd;
    }
    event RangeSet(uint256 rangeStart, uint256 rangeEnd);
    event NFTXEligibilityInit(
        address owner,
        bool finalize,
        uint256 rangeStart,
        uint256 rangeEnd
    );

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
        (address _owner, bool finalize, uint256 _rangeStart, uint256 _rangeEnd) = abi
            .decode(_configData, (address, bool, uint256, uint256));
        __NFTXEligibility_init(_owner, finalize, _rangeStart, _rangeEnd);
    }

    function __NFTXEligibility_init(
        address _owner,
        bool finalize,
        uint256 _rangeStart,
        uint256 _rangeEnd
    ) public initializer {
        __Ownable_init();
        rangeStart = _rangeStart;
        rangeEnd = _rangeEnd;
        emit NFTXEligibilityInit(_owner, finalize, _rangeStart, _rangeEnd);

        if (finalize) {
            renounceOwnership();
        } else {
            transferOwnership(_owner);
        }
    }

    function setEligibilityPreferences(uint256 _rangeStart, uint256 _rangeEnd)
        external
        virtual
        onlyOwner
    {
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
