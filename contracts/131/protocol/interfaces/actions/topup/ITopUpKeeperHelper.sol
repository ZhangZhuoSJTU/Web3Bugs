// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./ITopUpAction.sol";

interface ITopUpKeeperHelper {
    struct TopupData {
        address payer;
        bytes32 account;
        bytes32 protocol;
        ITopUpAction.Record record;
    }

    function listPositions(address payer)
        external
        view
        returns (ITopUpAction.RecordWithMeta[] memory);

    function getExecutableTopups(uint256 cursor, uint256 howMany)
        external
        returns (TopupData[] memory topups, uint256 nextCursor);

    function canExecute(ITopUpAction.RecordKey calldata key) external view returns (bool);

    function batchCanExecute(ITopUpAction.RecordKey[] calldata keys)
        external
        returns (bool[] memory);
}
