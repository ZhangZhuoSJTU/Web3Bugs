// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../lib/LibInsurance.sol";

library LibInsuranceMock {
    function calcMintAmount(
        uint256 poolTokenSupply, // the total circulating supply of pool tokens
        uint256 poolTokenUnderlying, // the holding of the insurance pool in quote tokens
        uint256 wadAmount //the WAD amount of tokens being deposited
    ) public pure returns (uint256) {
        return LibInsurance.calcMintAmount(poolTokenSupply, poolTokenUnderlying, wadAmount);
    }

    function calcWithdrawAmount(
        uint256 poolTokenSupply, // the total circulating supply of pool tokens
        uint256 poolTokenUnderlying, // the holding of the insurance pool in quote tokens
        uint256 wadAmount //the WAD amount of tokens being deposited
    ) public pure returns (uint256) {
        return LibInsurance.calcWithdrawAmount(poolTokenSupply, poolTokenUnderlying, wadAmount);
    }
}
