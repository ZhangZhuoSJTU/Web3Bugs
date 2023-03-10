//SPDX-License-Identifier: Unlicense
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "./SingleTokenJoinV2.sol";
import "../interfaces/IWrappedNativeToken.sol";

contract EthSingleTokenJoinV2 is SingleTokenJoinV2 {
    constructor(address _INTERMEDIATE_TOKEN, address _uniSwapLikeRouter)
        SingleTokenJoinV2(_INTERMEDIATE_TOKEN, _uniSwapLikeRouter)
    {}

    receive() external payable {}

    function joinTokenEth(JoinTokenStructV2 calldata _joinTokenStruct)
        external
        payable
    {
        require(
            _joinTokenStruct.inputToken == address(INTERMEDIATE_TOKEN),
            "Wrong input token"
        );
        require(msg.value > 0, "No native token passed");

        // ######## Wrap TOKEN #########
        address(INTERMEDIATE_TOKEN).call{value: msg.value}("");

        _joinTokenSingle(_joinTokenStruct);

        uint256 remainingIntermediateBalance = INTERMEDIATE_TOKEN.balanceOf(
            address(this)
        );
        if (remainingIntermediateBalance > 0) {
            IWrappedNativeToken(address(INTERMEDIATE_TOKEN)).withdraw(
                remainingIntermediateBalance
            );
            msg.sender.transfer(remainingIntermediateBalance);
        }
    }
}
