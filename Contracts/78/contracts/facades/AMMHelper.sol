// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

abstract contract AMMHelper {
    function stabilizeFlan(uint256 rectangleOfFairness)
        public
        virtual
        returns (uint256 lpMinted);

    function generateFLNQuote() public virtual;

    function minAPY_to_FPS(uint256 minAPY, uint256 daiThreshold)
        public
        view
        virtual
        returns (uint256 fps);

    function buyFlanAndBurn(
        address inputToken,
        uint256 amount,
        address recipient
    ) public virtual;
}
