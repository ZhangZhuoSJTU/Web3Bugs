pragma solidity ^0.5.11;

contract MTicketProcessor {
    /**
     * @dev Process sent funds.
     * @param _amount Amount of funds sent
     */
    function processFunding(uint256 _amount) internal;

    /**
     * @dev Transfer withdrawal funds for a ticket sender
     * @param _amount Amount of withdrawal funds
     */
    function withdrawTransfer(address payable _sender, uint256 _amount) internal;

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
    ) internal;

    /**
     * @dev Validates a ticket's auxilary data (succeeds or reverts)
     * @param _auxData Auxilary data inclueded in a ticket
     */
    function requireValidTicketAuxData(bytes memory _auxData) internal view;
}
