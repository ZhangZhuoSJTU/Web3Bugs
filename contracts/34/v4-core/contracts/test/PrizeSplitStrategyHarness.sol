// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "../prize-strategy/PrizeSplitStrategy.sol";

contract PrizeSplitStrategyHarness is PrizeSplitStrategy {
    constructor(address _owner, IPrizePool _prizePool) PrizeSplitStrategy(_owner, _prizePool) {}

    function awardPrizeSplitAmount(address target, uint256 amount) external {
        return _awardPrizeSplitAmount(target, amount);
    }
}
