// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

/// @title Realit.io contract interface
interface IRealitio {
    function askQuestion(
        uint256 template_id,
        string calldata question,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint256 nonce
    ) external payable returns (bytes32);

    function resultFor(bytes32 question_id) external view returns (bytes32);

    function isFinalized(bytes32 question_id) external view returns (bool);

    function getContentHash(bytes32 question_id)
        external
        view
        returns (bytes32);
}
