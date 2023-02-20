// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/IWETH9.sol';
import '../interfaces/IPool.sol';

contract PoolEthUtils {
    IWETH9 public immutable weth;

    constructor(address _weth) {
        require(_weth != address(0), 'PEU:C1');
        weth = IWETH9(_weth);
    }

    function depositEthAsCollateralToPool(address _pool) external payable {
        _toWETHAndApprove(_pool, msg.value);
        IPool(_pool).depositCollateral(msg.value, false);
    }

    function addEthCollateralInMarginCall(address _pool, address _lender) external payable {
        _toWETHAndApprove(_pool, msg.value);
        IPool(_pool).addCollateralInMarginCall(_lender, msg.value, false);
    }

    function ethLend(
        address _pool,
        address _lender,
        address _strategy
    ) external payable {
        _toWETHAndApprove(_pool, msg.value);
        IPool(_pool).lend(_lender, msg.value, _strategy, false);
    }

    function _toWETHAndApprove(address _address, uint256 _amount) private {
        weth.deposit{value: _amount}();
        weth.approve(_address, _amount);
    }
}
