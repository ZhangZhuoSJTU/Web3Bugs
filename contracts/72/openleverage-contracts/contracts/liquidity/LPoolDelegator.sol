// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;


import "../Adminable.sol";
import "../DelegatorInterface.sol";


/**
 * @title Compound's LPoolDelegator Contract
 * LTokens which wrap an EIP-20 underlying and delegate to an implementation
 * @author Compound
 */
contract LPoolDelegator is DelegatorInterface, Adminable {


    constructor() {
        admin = msg.sender;
    }
    function initialize(address underlying_,
        bool isWethPool_,
        address contoller_,
        uint256 baseRatePerYear,
        uint256 multiplierPerYear,
        uint256 jumpMultiplierPerYear,
        uint256 kink_,

        uint initialExchangeRateMantissa_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address payable admin_,
        address implementation_) external onlyAdmin {
        require(implementation == address(0), "initialize once");
        // Creator of the contract is admin during initialization
        // First delegate gets to initialize the delegator (i.e. storage contract)
        delegateTo(implementation_, abi.encodeWithSignature("initialize(address,bool,address,uint256,uint256,uint256,uint256,uint256,string,string,uint8)",
            underlying_,
            isWethPool_,
            contoller_,
            baseRatePerYear,
            multiplierPerYear,
            jumpMultiplierPerYear,
            kink_,
            initialExchangeRateMantissa_,
            name_,
            symbol_,
            decimals_));

        implementation = implementation_;

        // Set the proper admin now that initialization is done
        admin = admin_;
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
