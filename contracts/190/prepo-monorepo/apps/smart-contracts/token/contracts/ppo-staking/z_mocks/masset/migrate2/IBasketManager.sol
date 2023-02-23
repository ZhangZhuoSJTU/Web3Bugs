// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {Basket} from "./MassetStructsV1.sol";

/**
 * @notice  Is the Basket Manager V2.0 interface used in the upgrade of mUSD from V2.0 to V3.0.
 * @author  mStable
 * @dev     VERSION: 2.0
 *          DATE:    2021-02-23
 */
interface IBasketManager {
  function getBassetIntegrator(address _bAsset)
    external
    view
    returns (address integrator);

  function getBasket() external view returns (Basket memory b);
}
