pragma solidity ^0.5.11;

import "./interfaces/MTicketProcessor.sol";
import "./interfaces/MContractRegistry.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract MixinTicketProcessor is MContractRegistry, MTicketProcessor {
    using SafeMath for uint256;

    // Number of rounds that a ticket is valid for starting from
    // its creationRound
    uint256 public ticketValidityPeriod;

    /**
     * @dev Process sent funds.
     * @param _amount Amount of funds sent
     */
    function processFunding(uint256 _amount) internal {
        // Send funds to Minter
        minter().depositETH.value(_amount)();
    }

    /**
     * @dev Transfer withdrawal funds for a ticket sender
     * @param _amount Amount of withdrawal funds
     */
    function withdrawTransfer(address payable _sender, uint256 _amount) internal {
        // Ask Minter to send withdrawal funds to the ticket sender
        minter().trustedWithdrawETH(_sender, _amount);
    }

    /**
     * @dev Transfer funds for a recipient's winning ticket
     * @param _recipient Address of recipient
     * @param _amount Amount of funds for the winning ticket
     * @param _auxData Auxilary data for the winning ticket
     */
    function winningTicketTransfer(
        address _recipient,
        uint256 _amount,
        bytes memory _auxData
    ) internal {
        (uint256 creationRound, ) = getCreationRoundAndBlockHash(_auxData);

        // Ask BondingManager to update fee pool for recipient with
        // winning ticket funds
        bondingManager().updateTranscoderWithFees(_recipient, _amount, creationRound);
    }

    /**
     * @dev Validates a ticket's auxilary data (succeeds or reverts)
     * @param _auxData Auxilary data inclueded in a ticket
     */
    function requireValidTicketAuxData(bytes memory _auxData) internal view {
        (uint256 creationRound, bytes32 creationRoundBlockHash) = getCreationRoundAndBlockHash(_auxData);
        bytes32 blockHash = roundsManager().blockHashForRound(creationRound);

        require(blockHash != bytes32(0), "ticket creationRound does not have a block hash");
        require(creationRoundBlockHash == blockHash, "ticket creationRoundBlockHash invalid for creationRound");

        uint256 currRound = roundsManager().currentRound();

        require(creationRound.add(ticketValidityPeriod) > currRound, "ticket is expired");
    }

    /**
     * @dev Returns a ticket's creationRound and creationRoundBlockHash parsed from ticket auxilary data
     * @param _auxData Auxilary data for a ticket
     * @return creationRound and creationRoundBlockHash parsed from `_auxData`
     */
    function getCreationRoundAndBlockHash(bytes memory _auxData)
        internal
        pure
        returns (uint256 creationRound, bytes32 creationRoundBlockHash)
    {
        require(_auxData.length == 64, "invalid length for ticket auxData: must be 64 bytes");

        // _auxData format:
        // Bytes [0:31] = creationRound
        // Bytes [32:63] = creationRoundBlockHash
        assembly {
            creationRound := mload(add(_auxData, 32))
            creationRoundBlockHash := mload(add(_auxData, 64))
        }
    }
}
