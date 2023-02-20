// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../IPreparable.sol";
import "../IAction.sol";

interface ITopUpAction is IAction, IPreparable {
    struct RecordKey {
        address payer;
        bytes32 account;
        bytes32 protocol;
    }

    struct RecordMeta {
        bytes32 account;
        bytes32 protocol;
    }

    struct Record {
        uint64 threshold;
        uint64 priorityFee;
        uint64 maxFee;
        uint64 registeredAt;
        address actionToken;
        address depositToken;
        uint128 singleTopUpAmount; // denominated in action token
        uint128 totalTopUpAmount; // denominated in action token
        uint128 depositTokenBalance;
        bytes extra;
    }

    struct RecordWithMeta {
        bytes32 account;
        bytes32 protocol;
        Record record;
    }

    event Register(
        bytes32 indexed account,
        bytes32 indexed protocol,
        uint256 indexed threshold,
        address payer,
        address depositToken,
        uint256 depositAmount,
        address actionToken,
        uint256 singleTopUpAmount,
        uint256 totalTopUpAmount,
        uint256 maxGasPrice,
        bytes extra
    );

    event Deregister(address indexed payer, bytes32 indexed account, bytes32 indexed protocol);

    event TopUp(
        bytes32 indexed account,
        bytes32 indexed protocol,
        address indexed payer,
        address depositToken,
        uint256 consumedDepositAmount,
        address actionToken,
        uint256 topupAmount
    );

    function register(
        bytes32 account,
        bytes32 protocol,
        uint128 depositAmount,
        Record memory record
    ) external payable returns (bool);

    function execute(
        address payer,
        bytes32 account,
        address keeper,
        bytes32 protocol
    ) external returns (bool);

    function execute(
        address payer,
        bytes32 account,
        address keeper,
        bytes32 protocol,
        uint256 maxWeiForGas
    ) external returns (bool);

    function resetPosition(
        bytes32 account,
        bytes32 protocol,
        bool unstake
    ) external returns (bool);

    function getSupportedProtocols() external view returns (bytes32[] memory);

    function getPosition(
        address payer,
        bytes32 account,
        bytes32 protocol
    ) external view returns (Record memory);

    function getUserPositions(address payer) external view returns (RecordMeta[] memory);

    function getHandler(bytes32 protocol) external view returns (address);

    function usersWithPositions(uint256 cursor, uint256 howMany)
        external
        view
        returns (address[] memory users, uint256 nextCursor);

    function getHealthFactor(
        bytes32 protocol,
        bytes32 account,
        bytes memory extra
    ) external view returns (uint256);

    function getTopUpHandler(bytes32 protocol) external view returns (address);

    function prepareTopUpHandler(bytes32 protocol, address newHandler) external returns (bool);

    function executeTopUpHandler(bytes32 protocol) external returns (address);

    function resetTopUpHandler(bytes32 protocol) external returns (bool);

    function prepareActionFee(uint256 newActionFee) external returns (bool);

    function resetActionFee() external returns (bool);

    function prepareFeeHandler(address handler) external returns (bool);

    function executeFeeHandler() external returns (address);

    function resetFeeHandler() external returns (bool);

    function prepareEstimatedGasUsage(uint256 gasUsage) external returns (bool);

    function executeEstimatedGasUsage() external returns (uint256);

    function resetGasUsage() external returns (bool);

    function getEstimatedGasUsage() external returns (uint256);
}
