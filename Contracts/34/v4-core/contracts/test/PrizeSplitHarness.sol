// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "../prize-strategy/PrizeSplit.sol";
import "../interfaces/IControlledToken.sol";

contract PrizeSplitHarness is PrizeSplit {
    constructor(address _owner) Ownable(_owner) {}

    function _awardPrizeSplitAmount(address target, uint256 amount) internal override {
        emit PrizeSplitAwarded(target, amount, IControlledToken(address(0)));
    }

    function awardPrizeSplitAmount(address target, uint256 amount) external {
        return _awardPrizeSplitAmount(target, amount);
    }

    function getPrizePool() external pure override returns (IPrizePool) {
        return IPrizePool(address(0));
    }
}
