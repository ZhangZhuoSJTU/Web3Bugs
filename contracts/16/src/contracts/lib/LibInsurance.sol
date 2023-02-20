//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18.sol";

library LibInsurance {
    /**
    * @notice calculates the amount of insurance pool tokens to mint
    * @dev wadAmount is the amount of quote tokens being provided, converted to WAD
           format.
    */
    function calcMintAmount(
        uint256 poolTokenSupply, // the total circulating supply of pool tokens
        uint256 poolTokenUnderlying, // the holding of the insurance pool in quote tokens
        uint256 wadAmount //the WAD amount of tokens being deposited
    ) internal pure returns (uint256) {
        if (poolTokenSupply == 0) {
            // Mint at 1:1 ratio if no users in the pool
            return wadAmount;
        } else if (poolTokenUnderlying == 0) {
            // avoid divide by 0
            return 0;
        } else {
            // Mint at the correct ratio =
            //          Pool tokens (the ones to be minted) / poolAmount (the collateral asset)
            // Note the difference between this and withdraw. Here we are calculating the amount of tokens
            // to mint, and `amount` is the amount to deposit.
            return PRBMathUD60x18.mul(PRBMathUD60x18.div(poolTokenSupply, poolTokenUnderlying), wadAmount);
        }
    }

    /**
     * @notice Given a WAD amount of insurance tokens, calculate how much
     *         of the underlying to return to the user.
     * @dev returns the underlying amount in WAD format. Ensure this is
     *      converted to raw token format before using transfer
     */
    function calcWithdrawAmount(
        uint256 poolTokenSupply, // the total circulating supply of pool tokens
        uint256 poolTokenUnderlying, // the holding of the insurance pool in quote tokens
        uint256 wadAmount //the WAD amount of tokens being withdrawn
    ) internal pure returns (uint256) {
        // avoid division by 0
        if (poolTokenSupply == 0) {
            return 0;
        }

        return PRBMathUD60x18.mul(PRBMathUD60x18.div(poolTokenUnderlying, poolTokenSupply), wadAmount);
    }
}
