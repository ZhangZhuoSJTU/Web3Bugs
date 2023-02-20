// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IDue} from '../interfaces/IDue.sol';
import {SafeCast} from '@timeswap-labs/timeswap-v1-core/contracts/libraries/SafeCast.sol';

library PayMath {
    using SafeCast for uint256;

    function givenMaxAssetsIn(
        IPair pair,
        uint256 maturity,
        IDue collateralizedDebt,
        uint256[] memory ids,
        uint112[] memory maxAssetsIn
    ) internal view returns (uint112[] memory assetsIn, uint112[] memory collateralsOut) {
        assetsIn = maxAssetsIn;
        collateralsOut = new uint112[](ids.length);

        for (uint256 i; i < ids.length; i++) {
            IPair.Due memory due = pair.dueOf(maturity, address(collateralizedDebt), ids[i]);

            if (assetsIn[i] > due.debt) assetsIn[i] = due.debt;
            if (msg.sender == collateralizedDebt.ownerOf(ids[i])) {
                uint256 _collateralOut = due.collateral;
                if (due.debt > 0) {
                    _collateralOut *= assetsIn[i];
                    _collateralOut /= due.debt;
                }
                collateralsOut[i] = _collateralOut.toUint112();
            }
        }
    }
}
