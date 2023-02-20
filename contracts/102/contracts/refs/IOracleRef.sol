// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "../oracle/IOracle.sol";

/// @title OracleRef interface
/// @author Fei Protocol
interface IOracleRef {
    // ----------- Events -----------

    event OracleUpdate(address indexed oldOracle, address indexed newOracle);

    event InvertUpdate(bool oldDoInvert, bool newDoInvert);

    event DecimalsNormalizerUpdate(
        int256 oldDecimalsNormalizer,
        int256 newDecimalsNormalizer
    );

    event BackupOracleUpdate(
        address indexed oldBackupOracle,
        address indexed newBackupOracle
    );

    // ----------- State changing API -----------

    function updateOracle() external;

    // ----------- Governor only state changing API -----------

    function setOracle(address newOracle) external;

    function setBackupOracle(address newBackupOracle) external;

    function setDecimalsNormalizer(int256 newDecimalsNormalizer) external;

    function setDoInvert(bool newDoInvert) external;

    // ----------- Getters -----------

    function oracle() external view returns (IOracle);

    function backupOracle() external view returns (IOracle);

    function doInvert() external view returns (bool);

    function decimalsNormalizer() external view returns (int256);

    function readOracle() external view returns (Decimal.D256 memory);

    function invert(Decimal.D256 calldata price)
        external
        pure
        returns (Decimal.D256 memory);
}
