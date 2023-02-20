// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/owner-manager-contracts/contracts/Ownable.sol";

import "../interfaces/IPrizeSplit.sol";

/**
 * @title PrizeSplit Interface
 * @author PoolTogether Inc Team
 */
abstract contract PrizeSplit is IPrizeSplit, Ownable {
    /* ============ Global Variables ============ */
    PrizeSplitConfig[] internal _prizeSplits;

    uint16 public constant ONE_AS_FIXED_POINT_3 = 1000;

    /* ============ External Functions ============ */

    /// @inheritdoc IPrizeSplit
    function getPrizeSplit(uint256 _prizeSplitIndex)
        external
        view
        override
        returns (PrizeSplitConfig memory)
    {
        return _prizeSplits[_prizeSplitIndex];
    }

    /// @inheritdoc IPrizeSplit
    function getPrizeSplits() external view override returns (PrizeSplitConfig[] memory) {
        return _prizeSplits;
    }

    /// @inheritdoc IPrizeSplit
    function setPrizeSplits(PrizeSplitConfig[] calldata _newPrizeSplits)
        external
        override
        onlyOwner
    {
        uint256 newPrizeSplitsLength = _newPrizeSplits.length;
        require(newPrizeSplitsLength <= type(uint8).max, "PrizeSplit/invalid-prizesplits-length");

        // Add and/or update prize split configs using _newPrizeSplits PrizeSplitConfig structs array.
        for (uint256 index = 0; index < newPrizeSplitsLength; index++) {
            PrizeSplitConfig memory split = _newPrizeSplits[index];

            // REVERT when setting the canonical burn address.
            require(split.target != address(0), "PrizeSplit/invalid-prizesplit-target");

            // IF the CURRENT prizeSplits length is below the NEW prizeSplits
            // PUSH the PrizeSplit struct to end of the list.
            if (_prizeSplits.length <= index) {
                _prizeSplits.push(split);
            } else {
                // ELSE update an existing PrizeSplit struct with new parameters
                PrizeSplitConfig memory currentSplit = _prizeSplits[index];

                // IF new PrizeSplit DOES NOT match the current PrizeSplit
                // WRITE to STORAGE with the new PrizeSplit
                if (
                    split.target != currentSplit.target ||
                    split.percentage != currentSplit.percentage
                ) {
                    _prizeSplits[index] = split;
                } else {
                    continue;
                }
            }

            // Emit the added/updated prize split config.
            emit PrizeSplitSet(split.target, split.percentage, index);
        }

        // Remove old prize splits configs. Match storage _prizesSplits.length with the passed newPrizeSplits.length
        while (_prizeSplits.length > newPrizeSplitsLength) {
            uint256 _index;
            unchecked {
                _index = _prizeSplits.length - 1;
            }
            _prizeSplits.pop();
            emit PrizeSplitRemoved(_index);
        }

        // Total prize split do not exceed 100%
        uint256 totalPercentage = _totalPrizeSplitPercentageAmount();
        require(totalPercentage <= ONE_AS_FIXED_POINT_3, "PrizeSplit/invalid-prizesplit-percentage-total");
    }

    /// @inheritdoc IPrizeSplit
    function setPrizeSplit(PrizeSplitConfig memory _prizeSplit, uint8 _prizeSplitIndex)
        external
        override
        onlyOwner
    {
        require(_prizeSplitIndex < _prizeSplits.length, "PrizeSplit/nonexistent-prizesplit");
        require(_prizeSplit.target != address(0), "PrizeSplit/invalid-prizesplit-target");

        // Update the prize split config
        _prizeSplits[_prizeSplitIndex] = _prizeSplit;

        // Total prize split do not exceed 100%
        uint256 totalPercentage = _totalPrizeSplitPercentageAmount();
        require(totalPercentage <= ONE_AS_FIXED_POINT_3, "PrizeSplit/invalid-prizesplit-percentage-total");

        // Emit updated prize split config
        emit PrizeSplitSet(
            _prizeSplit.target,
            _prizeSplit.percentage,
            _prizeSplitIndex
        );
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Calculates total prize split percentage amount.
     * @dev Calculates total PrizeSplitConfig percentage(s) amount. Used to check the total does not exceed 100% of award distribution.
     * @return Total prize split(s) percentage amount
     */
    function _totalPrizeSplitPercentageAmount() internal view returns (uint256) {
        uint256 _tempTotalPercentage;
        uint256 prizeSplitsLength = _prizeSplits.length;

        for (uint256 index = 0; index < prizeSplitsLength; index++) {
            _tempTotalPercentage += _prizeSplits[index].percentage;
        }

        return _tempTotalPercentage;
    }

    /**
     * @notice Distributes prize split(s).
     * @dev Distributes prize split(s) by awarding ticket or sponsorship tokens.
     * @param _prize Starting prize award amount
     * @return The remainder after splits are taken
     */
    function _distributePrizeSplits(uint256 _prize) internal returns (uint256) {
        uint256 _prizeTemp = _prize;
        uint256 prizeSplitsLength = _prizeSplits.length;

        for (uint256 index = 0; index < prizeSplitsLength; index++) {
            PrizeSplitConfig memory split = _prizeSplits[index];
            uint256 _splitAmount = (_prize * split.percentage) / 1000;

            // Award the prize split distribution amount.
            _awardPrizeSplitAmount(split.target, _splitAmount);

            // Update the remaining prize amount after distributing the prize split percentage.
            _prizeTemp -= _splitAmount;
        }

        return _prizeTemp;
    }

    /**
     * @notice Mints ticket or sponsorship tokens to prize split recipient.
     * @dev Mints ticket or sponsorship tokens to prize split recipient via the linked PrizePool contract.
     * @param _target Recipient of minted tokens
     * @param _amount Amount of minted tokens
     */
    function _awardPrizeSplitAmount(address _target, uint256 _amount) internal virtual;
}
