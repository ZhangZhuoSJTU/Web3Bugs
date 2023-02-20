pragma solidity 0.6.8;

contract UniqueEligibility {
    mapping(uint256 => uint256) eligibleBitMap;

    event UniqueEligibilitiesSet(uint256[] tokenIds, bool isEligible);

    function isUniqueEligible(uint256 tokenId)
        public
        view
        virtual
        returns (bool)
    {
        uint256 wordIndex = tokenId / 256;
        uint256 bitMap = eligibleBitMap[wordIndex];
        return _getBit(bitMap, tokenId);
    }

    function _setUniqueEligibilities(
        uint256[] memory tokenIds,
        bool _isEligible
    ) internal virtual {
        uint256 cachedWord = eligibleBitMap[0];
        uint256 cachedIndex = 0;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 eligibilityWordIndex = tokenId / 256;
            if (eligibilityWordIndex != cachedIndex) {
                // Save the cached word.
                eligibleBitMap[cachedIndex] = cachedWord;
                // Cache the new one.
                cachedWord = eligibleBitMap[eligibilityWordIndex];
                cachedIndex = eligibilityWordIndex;
            }
            // Modify the cached word.
            cachedWord = _setBit(cachedWord, tokenId, _isEligible);
        }
        // Assign the last word since the loop is done.
        eligibleBitMap[cachedIndex] = cachedWord;
        emit UniqueEligibilitiesSet(tokenIds, _isEligible);
    }

    function _setBit(
        uint256 bitMap,
        uint256 index,
        bool eligible
    ) internal pure returns (uint256) {
        uint256 claimedBitIndex = index % 256;
        if (eligible) {
            return bitMap | (1 << claimedBitIndex);
        } else {
            return bitMap & ~(1 << claimedBitIndex);
        }
    }

    function _getBit(uint256 bitMap, uint256 index)
        internal
        pure
        returns (bool)
    {
        uint256 claimedBitIndex = index % 256;
        return uint8((bitMap >> claimedBitIndex) & 1) == 1;
    }
}