interface ILinearPremiumPriceOracle {
    function timeUntilPremium(uint256 expires, uint256 amount)
        external
        view
        returns (uint256);
}
