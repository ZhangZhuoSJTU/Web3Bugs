// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./interfaces/ICvx.sol";

/// @notice Contains function to calc amount of CVX to mint from a given amount of CRV
library CvxMining {
    ICvx public constant cvx = ICvx(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);

    /// @param _amount The amount of CRV to burn
    /// @return The amount of CVX to mint
    function ConvertCrvToCvx(uint256 _amount) internal view returns (uint256) {
        uint256 supply = cvx.totalSupply();
        uint256 reductionPerCliff = cvx.reductionPerCliff();
        uint256 totalCliffs = cvx.totalCliffs();
        uint256 maxSupply = cvx.maxSupply();

        uint256 cliff = supply / reductionPerCliff;
        //mint if below total cliffs
        if (cliff < totalCliffs) {
            //for reduction% take inverse of current cliff
            uint256 reduction = totalCliffs - cliff;
            //reduce
            _amount = (_amount * reduction) / totalCliffs;

            //supply cap check
            uint256 amtTillMax = maxSupply - supply;
            if (_amount > amtTillMax) {
                _amount = amtTillMax;
            }

            //mint
            return _amount;
        }
        return 0;
    }
}