// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import { ILiFi } from "../Interfaces/ILiFi.sol";
import { LibSwap } from "../Libraries/LibSwap.sol";
import { LibStorage } from "../Libraries/LibStorage.sol";

contract Swapper is ILiFi {
    /* ========== Storage ========== */
    LibStorage internal ls;

    function _executeSwaps(LiFiData memory _lifiData, LibSwap.SwapData[] calldata _swapData) internal {
        // Swap
        for (uint8 i; i < _swapData.length; i++) {
            require(
                ls.dexWhitelist[_swapData[i].approveTo] == true && ls.dexWhitelist[_swapData[i].callTo] == true,
                "Contract call not allowed!"
            );

            LibSwap.swap(_lifiData.transactionId, _swapData[i]);
        }
    }
}
