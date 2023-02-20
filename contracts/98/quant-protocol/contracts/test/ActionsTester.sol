// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "../libraries/Actions.sol";

contract ActionsTester {
    function testParseMintOptionArgs(ActionArgs memory args)
        external
        pure
        returns (
            address,
            address,
            uint256
        )
    {
        return Actions.parseMintOptionArgs(args);
    }

    function testParseMintSpreadArgs(ActionArgs memory args)
        external
        pure
        returns (
            address,
            address,
            uint256
        )
    {
        return Actions.parseMintSpreadArgs(args);
    }

    function testParseExerciseArgs(ActionArgs memory args)
        external
        pure
        returns (address, uint256)
    {
        return Actions.parseExerciseArgs(args);
    }

    function testParseClaimCollateralArgs(ActionArgs memory args)
        external
        pure
        returns (uint256, uint256)
    {
        return Actions.parseClaimCollateralArgs(args);
    }

    function testParseNeutralizeArgs(ActionArgs memory args)
        external
        pure
        returns (uint256, uint256)
    {
        return Actions.parseNeutralizeArgs(args);
    }

    function testParseQTokenPermitArgs(ActionArgs memory args)
        external
        pure
        returns (
            address,
            address,
            address,
            uint256,
            uint256,
            uint8,
            bytes32,
            bytes32
        )
    {
        return Actions.parseQTokenPermitArgs(args);
    }

    function testParseCollateralTokenApprovalArgs(ActionArgs memory args)
        external
        pure
        returns (
            address,
            address,
            bool,
            uint256,
            uint256,
            uint8,
            bytes32,
            bytes32
        )
    {
        return Actions.parseCollateralTokenApprovalArgs(args);
    }

    function testParseCallArgs(ActionArgs memory args)
        external
        pure
        returns (address, bytes memory)
    {
        return Actions.parseCallArgs(args);
    }
}
