//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IArbSys} from "../../arbitrum/IArbSys.sol";

abstract contract L2ArbitrumMessenger {
    event TxToL1(
        address indexed _from,
        address indexed _to,
        uint256 indexed _id,
        bytes _data
    );

    function sendTxToL1(
        address user,
        address to,
        bytes memory data
    ) internal returns (uint256) {
        // note: this method doesn't support sending ether to L1 together with a call
        uint256 id = IArbSys(address(100)).sendTxToL1(to, data);
        emit TxToL1(user, to, id, data);
        return id;
    }

    modifier onlyL1Counterpart(address l1Counterpart) {
        require(
            msg.sender == applyL1ToL2Alias(l1Counterpart),
            "ONLY_COUNTERPART_GATEWAY"
        );
        _;
    }

    uint160 internal constant OFFSET =
        uint160(0x1111000000000000000000000000000000001111);

    // l1 addresses are transformed durng l1->l2 calls
    function applyL1ToL2Alias(address l1Address)
        internal
        pure
        returns (address l2Address)
    {
        l2Address = address(uint160(l1Address) + OFFSET);
    }
}
