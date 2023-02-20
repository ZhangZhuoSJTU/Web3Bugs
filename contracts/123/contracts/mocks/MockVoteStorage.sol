// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

contract MockVoteStorage {
    struct Vote {
        uint256 timestamp;
        uint256 choice;
        string version;
        string space;
        string voteType;
    }

    mapping(string => Vote) public proposals;

    function setProposal(
        uint256 choice,
        uint256 timestamp,
        string memory version,
        string memory proposal,
        string memory space,
        string memory voteType
    ) external {
        Vote memory vote = Vote(timestamp, choice, version, space, voteType);
        proposals[proposal] = vote;
    }

    function hash(string memory proposal) public view returns (bytes32) {
        Vote memory vote = proposals[proposal];

        // prettier-ignore
        return hashStr(string(abi.encodePacked(
            "{",
                '"version":"', vote.version, '",',
                '"timestamp":"', uint2str(vote.timestamp), '",',
                '"space":"', vote.space, '",',
                '"type":"', vote.voteType, '",',
                payloadStr(proposal, vote.choice),
           "}"
        )));
    }

    function payloadStr(string memory proposal, uint256 choice) internal pure returns (string memory) {
        // prettier-ignore
        return string(abi.encodePacked(
          '"payload":', "{",
              '"proposal":', '"', proposal, '",',
              '"choice":', uint2str(choice), ","
              '"metadata":', '"{}"',
          "}"
        ));
    }

    function hashStr(string memory str) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", uint2str(bytes(str).length), str));
    }

    function uint2str(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
