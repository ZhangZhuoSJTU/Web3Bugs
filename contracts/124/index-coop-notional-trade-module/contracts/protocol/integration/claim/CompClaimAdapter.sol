/*
    Copyright 2021 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;
pragma experimental "ABIEncoderV2";

import { IComptroller } from "../../../interfaces/external/IComptroller.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";

/**
 * @title CompClaimAdapter
 * @author bronco.eth
 *
 * Claim adapter that allows managers to claim COMP from assets deposited on Compound.
 */
contract CompClaimAdapter {

    /* ============ State Variables ============ */

    // Compound Comptroller contract has a claimComp function
    // https://compound.finance/docs/comptroller#claim-comp
    IComptroller public immutable comptroller;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _comptroller    Address of the Compound Comptroller contract with a claimComp function
     */
    constructor(IComptroller _comptroller) public {
        comptroller = _comptroller;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata for claiming all COMP tokens for the SetToken.
     * https://compound.finance/docs/comptroller#claim-comp
     *
     * @param _setToken     Set token address
     *
     * @return address      Comptroller holding claimable COMP (aka RewardPool)
     * @return uint256      Unused, since it claims total claimable balance
     * @return bytes        Claim calldata
     */
    function getClaimCallData(ISetToken _setToken, address /* _rewardPool */) external view returns (address, uint256, bytes memory) {
        bytes memory callData = abi.encodeWithSignature("claimComp(address)", _setToken);

        return (address(comptroller), 0, callData);
    }

    /**
     * Returns balance of COMP for SetToken
     *
     * @return uint256      Claimable COMP balance
     */
    function getRewardsAmount(ISetToken _setToken, address /* _rewardPool */) external view returns(uint256) {
        return comptroller.compAccrued(address(_setToken));
    }

    /**
     * Returns COMP token address
     *
     * @return address      COMP token address
     */
    function getTokenAddress(address /* _rewardPool */) external view returns(address) {
        return comptroller.getCompAddress();
    }
}
