//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import "./Types.sol";

interface ITrader {
    function chainId() external view returns (uint256);

    function EIP712_DOMAIN() external view returns (bytes32);

    function executeTrade(Types.SignedLimitOrder[] memory makers, Types.SignedLimitOrder[] memory takers) external;

    function hashOrder(Perpetuals.Order memory order) external view returns (bytes32);

    function filled(bytes32) external view returns (uint256);

    function averageExecutionPrice(bytes32) external view returns (uint256);

    function getDomain() external view returns (bytes32);

    function verifySignature(address signer, Types.SignedLimitOrder memory order) external view returns (bool);

    function getOrder(Perpetuals.Order memory order) external view returns (Perpetuals.Order memory);

    function filledAmount(Perpetuals.Order memory order) external view returns (uint256);

    function getAverageExecutionPrice(Perpetuals.Order memory order) external view returns (uint256);
}
