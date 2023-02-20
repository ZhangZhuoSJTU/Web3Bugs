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


import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/**
 * @title ERC20Viewer
 * @author Set Protocol
 *
 * Interfaces for fetching multiple ERC20 state in a single read
 */
contract ERC20Viewer {

    /*
     * Fetches token balances for each tokenAddress, tokenOwner pair
     *
     * @param  _tokenAddresses    Addresses of ERC20 contracts
     * @param  _ownerAddresses    Addresses of users sequential to tokenAddress
     * @return  uint256[]         Array of balances for each ERC20 contract passed in
     */
    function batchFetchBalancesOf(
        address[] calldata _tokenAddresses,
        address[] calldata _ownerAddresses
    )
        public
        view
        returns (uint256[] memory)
    {
        // Cache length of addresses to fetch balances for
        uint256 addressesCount = _tokenAddresses.length;

        // Instantiate output array in memory
        uint256[] memory balances = new uint256[](addressesCount);

        // Cycle through contract addresses array and fetching the balance of each for the owner
        for (uint256 i = 0; i < addressesCount; i++) {
            balances[i] = ERC20(address(_tokenAddresses[i])).balanceOf(_ownerAddresses[i]);
        }

        return balances;
    }

    /*
     * Fetches token allowances for each tokenAddress, tokenOwner tuple
     *
     * @param  _tokenAddresses      Addresses of ERC20 contracts
     * @param  _ownerAddresses      Addresses of owner sequential to tokenAddress
     * @param  _spenderAddresses    Addresses of spenders sequential to tokenAddress
     * @return  uint256[]           Array of allowances for each ERC20 contract passed in
     */
    function batchFetchAllowances(
        address[] calldata _tokenAddresses,
        address[] calldata _ownerAddresses,
        address[] calldata _spenderAddresses
    )
        public
        view
        returns (uint256[] memory)
    {
        // Cache length of addresses to fetch allowances for
        uint256 addressesCount = _tokenAddresses.length;

        // Instantiate output array in memory
        uint256[] memory allowances = new uint256[](addressesCount);

        // Cycle through contract addresses array and fetching the balance of each for the owner
        for (uint256 i = 0; i < addressesCount; i++) {
            allowances[i] = ERC20(address(_tokenAddresses[i])).allowance(_ownerAddresses[i], _spenderAddresses[i]);
        }

        return allowances;
    }
}