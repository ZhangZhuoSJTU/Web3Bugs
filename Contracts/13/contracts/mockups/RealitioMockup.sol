// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "hardhat/console.sol";

// this is only for ganache testing. Public chain deployments will use the existing Realitio contracts.

contract RealitioMockup {
    uint256 result = 420;
    bytes32 public actualQuestionId;
    bytes32 public actualContentHash;

    function setResult(uint256 _result) public {
        if (_result == 69) {
            result = type(uint256).max;
        } else {
            result = _result;
        }
    }

    function askQuestion(
        uint256 template_id,
        string calldata question,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint256 nonce
    ) external payable returns (bytes32) {
        bytes32 content_hash =
            keccak256(abi.encodePacked(template_id, opening_ts, question));
        bytes32 question_id =
            keccak256(
                abi.encodePacked(
                    content_hash,
                    arbitrator,
                    timeout,
                    msg.sender,
                    nonce
                )
            );
        actualContentHash = content_hash;
        actualQuestionId = question_id;
        return question_id;
    }

    // 420 = not resolved
    // 69 = invalid
    function resultFor(bytes32 question_id) external view returns (bytes32) {
        require(result != 420);
        question_id;
        // require(question_id == actualQuestionId);
        return bytes32(result);
    }

    function isFinalized(bytes32 question_id) external view returns (bool) {
        // require(question_id == actualQuestionId, "questionId incorrect");
        question_id;
        if (result == 420) {
            return false;
        } else {
            return true;
        }
    }

    function getContentHash(bytes32 question_id)
        external
        view
        returns (bytes32)
    {
        // console.logBytes32(bytes32 b);
        question_id;
        if (question_id == actualQuestionId) {
            return actualContentHash;
        } else {
            return 0;
        }
    }
}
