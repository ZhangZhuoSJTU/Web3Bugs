// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './../interfaces/IJBFundingCycleDataSource.sol';
import './../structs/JBFundingCycleMetadata.sol';
import './JBConstants.sol';

library JBGlobalFundingCycleMetadataResolver {
  function setTerminalsAllowed(uint8 _data) internal pure returns (bool) {
    return (_data & 1) == 1;
  }

  function setControllerAllowed(uint8 _data) internal pure returns (bool) {
    return ((_data >> 1) & 1) == 1;
  }

  /**
    @notice
    Pack the global funding cycle metadata.

    @param _metadata The metadata to validate and pack.

    @return packed The packed uint256 of all global metadata params. The first 8 bits specify the version.
  */
  function packFundingCycleGlobalMetadata(JBGlobalFundingCycleMetadata memory _metadata)
    internal
    pure
    returns (uint256 packed)
  {
    // allow set terminals in bit 0.
    if (_metadata.allowSetTerminals) packed |= 1;
    // allow set controller in bit 1.
    if (_metadata.allowSetController) packed |= 1 << 1;
  }

  /**
    @notice
    Expand the global funding cycle metadata.

    @param _packedMetadata The packed metadata to expand.

    @return metadata The global metadata object.
  */
  function expandMetadata(uint8 _packedMetadata)
    internal
    pure
    returns (JBGlobalFundingCycleMetadata memory metadata)
  {
    return
      JBGlobalFundingCycleMetadata(
        setTerminalsAllowed(_packedMetadata),
        setControllerAllowed(_packedMetadata)
      );
  }
}
