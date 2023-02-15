// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import "@balancer-labs/v2-solidity-utils/contracts/math/FixedPoint.sol";

/// @dev helper library that does vector math
library VecMath {
    using FixedPoint for uint256;

    /// @dev Substracting two vectors
    /// @notice Vectors must be of same length
    /// @param vec1 First vector, also result will be stored here
    /// @param vec2 Second vector
    function sub(uint256[] memory vec1, uint256[] memory vec2) internal pure {
        assert(vec1.length == vec2.length);
        for (uint256 i = 0; i < vec1.length; ++i) {
            vec1[i] = vec1[i].sub(vec2[i]);
        }
    }

    /// @dev Adding two vectors
    /// @notice Vectors must be of same length
    /// @param vec1 First vector, also result will be stored here
    /// @param vec2 Second vector
    function add(uint256[] memory vec1, uint256[] memory vec2) internal pure {
        assert(vec1.length == vec2.length);
        for (uint256 i = 0; i < vec1.length; ++i) {
            vec1[i] = vec1[i].add(vec2[i]);
        }
    }

    /// @dev Dot product of two vectors which is resulting in components, not final value
    /// @notice vec1[i] = vec1[i] * vec2[i]
    /// @notice Vectors must be of same length
    /// @param vec1 First vector, also result will be stored here
    /// @param vec2 Second vector
    function mul(
        uint256[] memory vec1,
        uint256[] memory vec2,
        uint256 one
    ) internal pure {
        assert(vec1.length == vec2.length);
        for (uint256 i = 0; i < vec1.length; ++i) {
            vec1[i] = (vec1[i] * vec2[i]) / one;
        }
    }

    /// @dev Dividing components of vec1 by components of vec2
    /// @notice vec1[i] = vec1[i] / vec2[i]
    /// @notice Vectors must be of same length
    /// @param vec1 First vector, also result will be stored here
    /// @param vec2 Second vector
    function div(
        uint256[] memory vec1,
        uint256[] memory vec2,
        uint256 one
    ) internal pure {
        assert(vec1.length == vec2.length);
        for (uint256 i = 0; i < vec1.length; ++i) {
            vec1[i] = (vec1[i] * one) / vec2[i];
        }
    }
}
