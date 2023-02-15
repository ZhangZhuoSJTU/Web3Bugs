// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "./IControlledToken.sol";
import "./IPrizePool.sol";

/**
 * @title Abstract prize split contract for adding unique award distribution to static addresses.
 * @author PoolTogether Inc Team
 */
interface IPrizeSplit {
    /**
     * @notice Emit when an individual prize split is awarded.
     * @param user          User address being awarded
     * @param prizeAwarded  Awarded prize amount
     * @param token         Token address
     */
    event PrizeSplitAwarded(
        address indexed user,
        uint256 prizeAwarded,
        IControlledToken indexed token
    );

    /**
     * @notice The prize split configuration struct.
     * @dev    The prize split configuration struct used to award prize splits during distribution.
     * @param target     Address of recipient receiving the prize split distribution
     * @param percentage Percentage of prize split using a 0-1000 range for single decimal precision i.e. 125 = 12.5%
     */
    struct PrizeSplitConfig {
        address target;
        uint16 percentage;
    }

    /**
     * @notice Emitted when a PrizeSplitConfig config is added or updated.
     * @dev    Emitted when a PrizeSplitConfig config is added or updated in setPrizeSplits or setPrizeSplit.
     * @param target     Address of prize split recipient
     * @param percentage Percentage of prize split. Must be between 0 and 1000 for single decimal precision
     * @param index      Index of prize split in the prizeSplts array
     */
    event PrizeSplitSet(address indexed target, uint16 percentage, uint256 index);

    /**
     * @notice Emitted when a PrizeSplitConfig config is removed.
     * @dev    Emitted when a PrizeSplitConfig config is removed from the prizeSplits array.
     * @param target Index of a previously active prize split config
     */
    event PrizeSplitRemoved(uint256 indexed target);

    /**
     * @notice Read prize split config from active PrizeSplits.
     * @dev    Read PrizeSplitConfig struct from prizeSplits array.
     * @param prizeSplitIndex Index position of PrizeSplitConfig
     * @return PrizeSplitConfig Single prize split config
     */
    function getPrizeSplit(uint256 prizeSplitIndex) external view returns (PrizeSplitConfig memory);

    /**
     * @notice Read all prize splits configs.
     * @dev    Read all PrizeSplitConfig structs stored in prizeSplits.
     * @return Array of PrizeSplitConfig structs
     */
    function getPrizeSplits() external view returns (PrizeSplitConfig[] memory);

    /**
     * @notice Get PrizePool address
     * @return IPrizePool
     */
    function getPrizePool() external view returns (IPrizePool);

    /**
     * @notice Set and remove prize split(s) configs. Only callable by owner.
     * @dev Set and remove prize split configs by passing a new PrizeSplitConfig structs array. Will remove existing PrizeSplitConfig(s) if passed array length is less than existing prizeSplits length.
     * @param newPrizeSplits Array of PrizeSplitConfig structs
     */
    function setPrizeSplits(PrizeSplitConfig[] calldata newPrizeSplits) external;

    /**
     * @notice Updates a previously set prize split config.
     * @dev Updates a prize split config by passing a new PrizeSplitConfig struct and current index position. Limited to contract owner.
     * @param prizeStrategySplit PrizeSplitConfig config struct
     * @param prizeSplitIndex Index position of PrizeSplitConfig to update
     */
    function setPrizeSplit(PrizeSplitConfig memory prizeStrategySplit, uint8 prizeSplitIndex)
        external;
}
