// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./iBEP20.sol";
import "./iBASE.sol";
import "./iDAO.sol";

contract Reserve {
    address public BASE;
    address public ROUTER;
    address public LEND;
    address public DAO;
    address public SYNTHVAULT;
    address public DEPLOYER;
    bool public emissions;

    // Restrict access
    modifier onlyGrantor() {
        require(msg.sender == DAO || msg.sender == ROUTER || msg.sender == DEPLOYER || msg.sender == LEND || msg.sender == SYNTHVAULT, "!DAO");
        _; 
    }

    constructor (address _base) {
        BASE = _base;
        DEPLOYER = msg.sender;
    }

    function setIncentiveAddresses(address _router, address _lend, address _synthVault, address _Dao) external onlyGrantor {
        ROUTER = _router;
        LEND = _lend;
        SYNTHVAULT = _synthVault;
        DAO = _Dao;
    }

    // Send SPARTA to an incentive address (Vault harvest, dividends etc)
    function grantFunds(uint amount, address to) external onlyGrantor {
        uint reserve = iBEP20(BASE).balanceOf(address(this)); // Get RESERVE's SPARTA balance
        if(amount > 0){ // Skip if amount is not valid
            if(emissions){ // Skip if emissions are off
                if(amount > reserve){
                    iBEP20(BASE).transfer(to, reserve); // Send remainder
                } else {
                    iBEP20(BASE).transfer(to, amount); // Send requested amount
                }
            }
        }
    }

    function flipEmissions() external onlyGrantor {
        emissions = !emissions; // Flip emissions on/off
    }

    // Can purge deployer once DAO is stable and final
    function purgeDeployer() external onlyGrantor {
        DEPLOYER = address(0);
    }
}