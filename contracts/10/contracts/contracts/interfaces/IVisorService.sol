// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

interface IVisorService {
    /* 
     * @dev Whenever an {IERC777} token is transferred to a subscriber vault via {IERC20-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC777.tokensReceived.selector`.
     */

  function subscriberTokensReceived(
        address token,
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external; 


}
