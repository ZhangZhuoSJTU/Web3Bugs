// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;

import { BlockVerifier } from "./BlockVerifier.sol";
import { MerklePatriciaVerifier } from "./MerklePatriciaVerifier.sol";
import { Rlp } from "./Rlp.sol";


library AccountVerifier {
    function getAccountStorageRoot(
        address account,
        bytes32 stateRoot,
        bytes memory accountProof
    ) internal pure returns(
        bytes32 storageRootHash
    ) {
        bytes memory accountDetailsBytes = MerklePatriciaVerifier.getValueFromProof(stateRoot, keccak256(abi.encodePacked(account)), accountProof);
        Rlp.Item[] memory accountDetails = Rlp.toList(Rlp.toItem(accountDetailsBytes));
        return Rlp.toBytes32(accountDetails[2]);
    }
}
