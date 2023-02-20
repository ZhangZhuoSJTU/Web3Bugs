// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../Interfaces/IYUSDToken.sol";

contract YUSDTokenCaller {
    IYUSDToken YUSD;

    function setYUSD(IYUSDToken _YUSD) external {
        YUSD = _YUSD;
    }

    function yusdMint(address _account, uint _amount) external {
        YUSD.mint(_account, _amount);
    }

    function yusdBurn(address _account, uint _amount) external {
        YUSD.burn(_account, _amount);
    }

    function yusdSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        YUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function yusdReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        YUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
