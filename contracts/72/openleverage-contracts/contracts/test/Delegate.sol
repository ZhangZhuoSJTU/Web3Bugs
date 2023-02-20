// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.4.22 <0.8.0;

import './Interface.sol';

contract Delegate is Interface {
    uint public delegatePrivate;

    uint public delegatePrivateParam=100;

    uint constant public delegatePrivateConstant=1;

    function initialize(address newOwner) public {
        owner = newOwner;
    }
    function setDelegatePrivateParam(uint delegatePrivateParam_) external  {
        delegatePrivateParam = delegatePrivateParam_;
    }
    function changeOwner(address newOwner) external override {
        owner = newOwner;
    }

}
