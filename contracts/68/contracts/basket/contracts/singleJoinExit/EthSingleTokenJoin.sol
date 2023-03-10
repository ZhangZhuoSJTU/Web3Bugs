//SPDX-License-Identifier: Unlicense
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "./SingleTokenJoin.sol";
import "../interfaces/IWrappedNativeToken.sol";

contract EthSingleTokenJoin is SingleTokenJoin {
    constructor(address _INTERMEDIATE_TOKEN, address _uniSwapLikeRouter)
        SingleTokenJoin(_INTERMEDIATE_TOKEN, _uniSwapLikeRouter)
    {}

    receive() external payable {}

    function joinTokenEth(JoinTokenStruct calldata _joinTokenStruct)
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
