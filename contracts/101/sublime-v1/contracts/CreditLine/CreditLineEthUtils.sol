// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/IWETH9.sol';
import '../interfaces/ICreditLine.sol';

contract CreditLineEthUtils {
    IWETH9 public immutable weth;
    ICreditline public immutable creditlines;

    constructor(address _weth, address _creditLines) {
        require(_weth != address(0), 'CLEU:C1');
        require(_creditLines != address(0), 'CLEU:C2');
        weth = IWETH9(_weth);
        creditlines = ICreditline(_creditLines);
    }

    function depositEthAsCollateralToCreditLine(uint256 _id) external payable {
        require(msg.value != 0, 'CLEU:DECCL1');
        weth.deposit{value: msg.value}();
        weth.approve(address(creditlines), msg.value);
        creditlines.depositCollateral(_id, msg.value, false);
    }

    function repayEthToCreditLines(uint256 _id) external payable {
        require(msg.value != 0, 'CLEU:RECL1');
        weth.deposit{value: msg.value}();
        weth.approve(address(creditlines), msg.value);
        creditlines.repay(_id, msg.value);
    }
}
