// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "../Reserve.sol";
import "./ERC20Mintable.sol";

contract ReserveHarness is Reserve {
    constructor(address _owner, IERC20 _token) Reserve(_owner, _token) {}

    function setObservationsAt(ObservationLib.Observation[] calldata observations) external {
        for (uint256 i = 0; i < observations.length; i++) {
            reserveAccumulators[i] = observations[i];
        }

        nextIndex = uint24(observations.length);
        cardinality = uint24(observations.length);
    }

    function doubleCheckpoint(ERC20Mintable _token, uint256 _amount) external {
        _checkpoint();
        _token.mint(address(this), _amount);
        _checkpoint();
    }
}
