// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface IVader {
    /* ========== FUNCTIONS ========== */

    function createEmission(address user, uint256 amount) external;

    /* ========== EVENTS ========== */

    event Emission(address to, uint256 amount);

    event EmissionChanged(uint256 previous, uint256 next);

    event MaxSupplyChanged(uint256 previous, uint256 next);

    event GrantClaimed(address indexed beneficiary, uint256 amount);

    event ProtocolInitialized(address converter, address vest);

    event USDVSet(address usdv);

    /* ========== DEPRECATED ========== */

    // function getCurrentEraEmission() external view returns (uint256);

    // function getEraEmission(uint256 currentSupply)
    //     external
    //     view
    //     returns (uint256);

    // function calculateFee() external view returns (uint256 basisPoints);
}
