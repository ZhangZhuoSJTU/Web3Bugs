// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

pragma experimental ABIEncoderV2;

import "./Types.sol";
import "./Adminable.sol";
import "./DelegatorInterface.sol";
import "./XOLEInterface.sol";

/**
  * @title OpenLevDelegator
  * @author OpenLeverage
  */
contract XOLEDelegator is DelegatorInterface, Adminable {

    constructor(
        address _oleToken,
        DexAggregatorInterface _dexAgg,
        uint _devFundRatio,
        address _dev,
        address payable _admin,
        address implementation_){
        admin = msg.sender;
        // Creator of the contract is admin during initialization
        // First delegate gets to initialize the delegator (i.e. storage contract)
        delegateTo(implementation_, abi.encodeWithSignature("initialize(address,address,uint256,address)",
            _oleToken,
            _dexAgg,
            _devFundRatio,
            _dev
            ));
        implementation = implementation_;

        // Set the proper admin now that initialization is done
        admin = _admin;
    }

    /**
     * Called by the admin to update the implementation of the delegator
     * @param implementation_ The address of the new implementation for delegation
     */
    function setImplementation(address implementation_) public override onlyAdmin {
        address oldImplementation = implementation;
        implementation = implementation_;
        emit NewImplementation(oldImplementation, implementation);
    }

}
