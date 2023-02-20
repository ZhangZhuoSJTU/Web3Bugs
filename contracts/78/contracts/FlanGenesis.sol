// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./facades/AngbandLike.sol";
import "./facades/FlanLike.sol";
// import "./facades/AddTokenToBehodlerPowerLike.sol";

///@author Justin Goro
/**@notice to C4 auditors: this part of Limbo intersects significantly with MorgothDAO and is beyond the scope of the audit.
* No prizes are offered for auditing MorgothDAO at this stage. While it's important that Flan be set up correctly, an incorrect setup
* is easy to detect and costless to discard (ignoring gas costs) and so may be attempted multiple times until perfected. 
* The migration to Behodler will require a surface level understanding of Morgoth the functionality employed by Morgoth has already withstood the test of multiple mainnet uses
*/
///@dev this contract combines multiple genesis operations into one transaction to protect against entereing into an invalid state
contract FlanGenesis{
    struct Dependencies {
        uint something;
    }    
}