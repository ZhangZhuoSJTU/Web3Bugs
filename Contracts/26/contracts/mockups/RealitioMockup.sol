// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract RealitioMockup is Ownable {
    struct Question {
        bytes32 content_hash;
        uint256 template_id;
        string question;
        address arbitrator;
        uint32 timeout;
        uint32 opening_ts;
        uint256 answer;
        bool finalised;
    }
    mapping(bytes32 => Question) public questions;
    mapping(address => bytes32) public marketQuestion;

    event LogNewQuestion(
        bytes32 indexed question_id,
        address indexed user,
        uint256 template_id,
        string question,
        bytes32 indexed content_hash,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint256 nonce,
        uint256 created
    );

    /// @notice set the result using the question_id
    function setResult(bytes32 question_id, uint256 _result)
        external
        onlyOwner
    {
        questions[question_id].answer = _result;
        questions[question_id].finalised = true;
    }

    /// @notice set the result using the market address
    function setResult(address _market, uint256 _result) external onlyOwner {
        bytes32 _question_id = getMarketQuestionId(_market);
        questions[_question_id].answer = _result;
        questions[_question_id].finalised = true;
    }

    function askQuestion(
        uint256 template_id,
        string calldata question,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint256 nonce
    ) external payable returns (bytes32) {
        bytes32 content_hash = keccak256(
            abi.encodePacked(template_id, opening_ts, question)
        );
        bytes32 question_id = keccak256(
            abi.encodePacked(
                content_hash,
                arbitrator,
                timeout,
                msg.sender,
                nonce
            )
        );

        questions[question_id].content_hash = content_hash;
        questions[question_id].template_id = template_id;
        questions[question_id].question = question;
        questions[question_id].arbitrator = arbitrator;
        questions[question_id].timeout = timeout;
        questions[question_id].opening_ts = opening_ts;

        marketQuestion[msg.sender] = question_id;

        emit LogNewQuestion(
            question_id,
            msg.sender,
            template_id,
            question,
            content_hash,
            arbitrator,
            timeout,
            opening_ts,
            nonce,
            block.timestamp
        );
        return question_id;
    }

    function resultFor(bytes32 question_id) external view returns (bytes32) {
        require(
            questions[question_id].finalised == true,
            "Question not finalised"
        );
        return bytes32(questions[question_id].answer);
    }

    function isFinalized(bytes32 question_id) external view returns (bool) {
        return questions[question_id].finalised;
    }

    function getContentHash(bytes32 question_id) public view returns (bytes32) {
        return questions[question_id].content_hash;
    }

    function getTimeout(bytes32 question_id) public view returns (uint32) {
        return questions[question_id].timeout;
    }

    function getMarketQuestionId(address _market)
        public
        view
        returns (bytes32)
    {
        return marketQuestion[_market];
    }

    function getMarketQuestion(address _market)
        public
        view
        returns (string memory)
    {
        uint256 _length = bytes(questions[marketQuestion[_market]].question)
            .length;
        string memory _question = new string(_length);
        _question = questions[marketQuestion[_market]].question;
        return _question;
    }
}
