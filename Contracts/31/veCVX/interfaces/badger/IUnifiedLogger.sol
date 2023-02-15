//SPDX-License-Identifier: Unlicense
pragma solidity >=0.5.0 <0.8.0;

interface IUnifiedLogger {
    function batchLogs(bytes memory logs) external;
}
