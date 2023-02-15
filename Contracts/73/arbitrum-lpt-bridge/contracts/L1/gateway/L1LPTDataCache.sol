// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {L1ArbitrumMessenger} from "./L1ArbitrumMessenger.sol";

interface TotalSupplyLike {
    function totalSupply() external view returns (uint256);
}

interface IL2LPTDataCache {
    function finalizeCacheTotalSupply(uint256 _totalSupply) external;
}

contract L1LPTDataCache is L1ArbitrumMessenger {
    address public immutable tokenAddr;
    address public immutable l2LPTDataCacheAddr;

    event CacheTotalSupplyInitiated(uint256 seqNo, uint256 totalSupply);

    constructor(
        address _inbox,
        address _tokenAddr,
        address _l2LPTDataCacheAddr
    ) L1ArbitrumMessenger(_inbox) {
        tokenAddr = _tokenAddr;
        l2LPTDataCacheAddr = _l2LPTDataCacheAddr;
    }

    /**
     * @notice Executes a L2 call to cache L1 LPT total supply in L2LPTDataCache
     * @param _maxGas Gas limit for L2 execution
     * @param _gasPriceBid Gas price bid for L2 execution
     * @param _maxSubmissionCost Max ETH to pay for retryable ticket base submission fee
     */
    function cacheTotalSupply(
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost
    ) external payable {
        (bytes memory data, uint256 totalSupply) = getCacheTotalSupplyData();

        uint256 seqNo = sendTxToL2(
            l2LPTDataCacheAddr,
            msg.sender, // Refund to caller
            _maxSubmissionCost,
            _maxGas,
            _gasPriceBid,
            data
        );

        emit CacheTotalSupplyInitiated(seqNo, totalSupply);
    }

    /**
     * @notice Return L2 calldata and total supply to use for a L2 call on L2LPTDataCache
     * @return data L2 calldata for L2LPTDataCache
     * @return totalSupply L1 LPT total supply
     */
    function getCacheTotalSupplyData()
        public
        view
        returns (bytes memory data, uint256 totalSupply)
    {
        totalSupply = TotalSupplyLike(tokenAddr).totalSupply();

        data = abi.encodeWithSelector(
            IL2LPTDataCache.finalizeCacheTotalSupply.selector,
            totalSupply
        );
    }
}
