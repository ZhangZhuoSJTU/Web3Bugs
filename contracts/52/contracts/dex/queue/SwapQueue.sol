// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/utils/Address.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/dex/queue/ISwapQueue.sol";

// TBD
contract SwapQueue is ISwapQueue, ProtocolConstants {
    using Address for address payable;

    mapping(uint256 => Queue) public queue;

    /* ========== STATE VARIABLES ========== */
    /* ========== CONSTRUCTOR ========== */
    /* ========== VIEWS ========== */
    /* ========== MUTATIVE FUNCTIONS ========== */

    function executeQueue() external {
        uint256 reimbursement = _executeQueue();
        payable(msg.sender).sendValue(reimbursement);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */
    /* ========== INTERNAL FUNCTIONS ========== */

    function _insertQueue(uint256 value) internal returns (bool) {}

    function _executeQueue() internal returns (uint256) {}
    /* ========== PRIVATE FUNCTIONS ========== */
    /* ========== MODIFIERS ========== */
}
