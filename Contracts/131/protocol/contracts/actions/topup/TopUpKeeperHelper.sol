// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../../interfaces/actions/topup/ITopUpAction.sol";
import "../../../interfaces/actions/topup/ITopUpKeeperHelper.sol";
import "../../../interfaces/actions/topup/ITopUpHandler.sol";
import "../../../libraries/UncheckedMath.sol";

/**
 * This TopUp Keeper Helper.
 * It is a utility contract to help create Backd TopUp Keepers.
 * It exposes a view that allows the user to query a list of TopUp Positions that can be executed.
 */
contract TopUpKeeperHelper is ITopUpKeeperHelper {
    using UncheckedMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    ITopUpAction private immutable _topupAction;

    constructor(address topupAction_) {
        _topupAction = ITopUpAction(topupAction_);
    }

    /**
     * @notice Gets a list of topup positions that can be executed.
     * @dev Uses cursor pagination.
     * @param cursor The cursor for pagination (should start at 0 for first call).
     * @param howMany Maximum number of topups to return in this pagination request.
     * @return topups List of topup positions that can be executed.
     * @return nextCursor The cursor to use for the next pagination request.
     */
    function getExecutableTopups(uint256 cursor, uint256 howMany)
        external
        view
        override
        returns (TopupData[] memory topups, uint256 nextCursor)
    {
        TopupData[] memory executableTopups = new TopupData[](howMany);
        uint256 topupsAdded;
        while (true) {
            (address[] memory users, ) = _topupAction.usersWithPositions(cursor, howMany);
            if (users.length == 0) return (_shortenTopups(executableTopups, topupsAdded), 0);
            for (uint256 i; i < users.length; i = i.uncheckedInc()) {
                address user = users[i];
                ITopUpAction.RecordWithMeta[] memory positions = listPositions(user);
                for (uint256 j; j < positions.length; j = j.uncheckedInc()) {
                    ITopUpAction.RecordWithMeta memory position = positions[j];
                    if (!_canExecute(user, position)) continue;
                    executableTopups[topupsAdded] = _positionToTopup(user, position);
                    topupsAdded++;
                    uint256 offset = j == positions.length - 1 ? 1 : 0;
                    if (topupsAdded == howMany) return (executableTopups, cursor + i + offset);
                }
            }
            cursor += howMany;
        }
    }

    /**
     * @notice Check if the action can be executed for the positions
     * of the given `keys`
     * @param keys Unique keys to check for
     * @return an array of boolean containing a result per input
     */
    function batchCanExecute(ITopUpAction.RecordKey[] calldata keys)
        external
        view
        override
        returns (bool[] memory)
    {
        bool[] memory results = new bool[](keys.length);
        for (uint256 i; i < keys.length; i = i.uncheckedInc()) {
            ITopUpAction.RecordKey calldata key = keys[i];
            results[i] = canExecute(key);
        }
        return results;
    }

    /**
     * @notice Get a list of all positions the `payer` has registered.
     * @param payer Address to list position for.
     * @return Records of all registered positions.
     */
    function listPositions(address payer)
        public
        view
        override
        returns (ITopUpAction.RecordWithMeta[] memory)
    {
        ITopUpAction.RecordMeta[] memory userRecordsMeta = _topupAction.getUserPositions(payer);
        uint256 length = userRecordsMeta.length;
        ITopUpAction.RecordWithMeta[] memory result = new ITopUpAction.RecordWithMeta[](length);
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            bytes32 account = userRecordsMeta[i].account;
            bytes32 protocol = userRecordsMeta[i].protocol;
            ITopUpAction.Record memory record = _topupAction.getPosition(payer, account, protocol);
            result[i] = ITopUpAction.RecordWithMeta(account, protocol, record);
        }
        return result;
    }

    /**
     * @notice Check if action can be executed.
     * @param key Unique key of the account to check for
     * the key contains information about the payer, the account and the protocol
     * @return `true` if action can be executed, else `false`.
     */
    function canExecute(ITopUpAction.RecordKey memory key) public view override returns (bool) {
        ITopUpAction.Record memory position = _topupAction.getPosition(
            key.payer,
            key.account,
            key.protocol
        );
        if (position.threshold == 0 || position.totalTopUpAmount == 0) {
            return false;
        }
        uint256 healthFactor = _topupAction.getHealthFactor(
            key.protocol,
            key.account,
            position.extra
        );
        return healthFactor < position.threshold;
    }

    /**
     * @dev Returns if a position can be executed.
     * @param user The user paying for the position.
     * @param position The position record with metadata.
     * @return 'true' if it can be executed, 'false' if not.
     */
    function _canExecute(address user, ITopUpAction.RecordWithMeta memory position)
        private
        view
        returns (bool)
    {
        return canExecute(ITopUpAction.RecordKey(user, position.account, position.protocol));
    }

    /**
     * @dev Converts from RecordWithMeta struct to TopupData struct.
     * @param user The user paying for the position.
     * @param position The position record with metadata.
     * @return The topup positions as a TopupData struct.
     */
    function _positionToTopup(address user, ITopUpAction.RecordWithMeta memory position)
        private
        pure
        returns (TopupData memory)
    {
        return TopupData(user, position.account, position.protocol, position.record);
    }

    /**
     * @dev Shortens a list of topups by truncating it to a given length.
     * @param topups The list of topups to shorten.
     * @param length The length to truncate the list of topups to.
     * @return The shortened list of topups.
     */
    function _shortenTopups(TopupData[] memory topups, uint256 length)
        private
        pure
        returns (TopupData[] memory)
    {
        TopupData[] memory shortened = new TopupData[](length);
        for (uint256 i; i < length; i = i.uncheckedInc()) {
            shortened[i] = topups[i];
        }
        return shortened;
    }
}
