// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.10;

import "../tokenomics/Minter.sol";

contract MockBKDMinter is Minter {
    constructor(
        uint256 _annualInflationRateLp,
        uint256 _annualInflationRateKeeper,
        uint256 _annualInflationRateAmm,
        uint256 _annualInflationDecayLp,
        uint256 _annualInflationDecayKeeper,
        uint256 _annualInflationDecayAmm,
        uint256 _initialPeriodKeeperInflation,
        uint256 _initialPeriodAmmInflation,
        uint256 _nonInflationDistribution,
        IController _controller
    )
        Minter(
            _annualInflationRateLp,
            _annualInflationRateKeeper,
            _annualInflationRateAmm,
            _annualInflationDecayLp,
            _annualInflationDecayKeeper,
            _annualInflationDecayAmm,
            _initialPeriodKeeperInflation,
            _initialPeriodAmmInflation,
            _nonInflationDistribution,
            _controller
        )
    {}

    // solhint-disable-next-line func-name-mixedcase
    function mint_for_testing(address beneficiary, uint256 amount) external returns (bool) {
        token.mint(beneficiary, amount);
        return true;
    }

    // solhint-disable-next-line func-name-mixedcase
    function mint_for_testing_with_checks(address beneficiary, uint256 amount)
        external
        returns (bool)
    {
        return _mint(beneficiary, amount);
    }
}
