// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "../Reserve.sol";
import "./ERC20Mintable.sol";

contract ReserveHarness is Reserve {
    constructor(address _owner, IERC20 _token) Reserve(_owner, _token) {}

    function getReserveAccumulatedAt(
        ObservationLib.Observation memory _newestObservation,
        ObservationLib.Observation memory _oldestObservation,
        uint24 _cardinality,
        uint32 timestamp
    ) public view returns (uint224) {
        return
            _getReserveAccumulatedAt(
                _newestObservation,
                _oldestObservation,
                _cardinality,
                timestamp
            );
    }

    function setObservationsAt(ObservationLib.Observation[] calldata observations) external {
        for (uint256 i = 0; i < observations.length; i++) {
            reserveAccumulators[i] = observations[i];
        }

        cardinality = uint16(observations.length);
    }

    function doubleCheckpoint(ERC20Mintable _token, uint256 _amount) external {
        _checkpoint();
        _token.mint(address(this), _amount);
        _checkpoint();
    }
}
