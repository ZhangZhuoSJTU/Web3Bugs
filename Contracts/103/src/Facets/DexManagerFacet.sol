// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../Libraries/LibStorage.sol";
import "../Libraries/LibDiamond.sol";

/**
 * @title Optics Router Facet
 * @author Li.Finance (https://li.finance)
 * @notice Facet contract for managing approved DEXs to be used in swaps.
 */
contract DexManagerFacet {
    LibStorage internal s;

    /// @notice Register the address of a DEX contract to be approved for swapping.
    /// @param _dex The address of the DEX contract to be approved.
    function addDex(address _dex) external {
        LibDiamond.enforceIsContractOwner();

        if (s.dexWhitelist[_dex] == true) {
            return;
        }

        s.dexWhitelist[_dex] = true;
        s.dexs.push(_dex);
    }

    /// @notice Batch register the addresss of DEX contracts to be approved for swapping.
    /// @param _dexs The addresses of the DEX contracts to be approved.
    function batchAddDex(address[] calldata _dexs) external {
        LibDiamond.enforceIsContractOwner();

        for (uint256 i; i < _dexs.length; i++) {
            if (s.dexWhitelist[_dexs[i]] == true) {
                continue;
            }
            s.dexWhitelist[_dexs[i]] = true;
            s.dexs.push(_dexs[i]);
        }
    }

    /// @notice Unregister the address of a DEX contract approved for swapping.
    /// @param _dex The address of the DEX contract to be unregistered.
    function removeDex(address _dex) external {
        LibDiamond.enforceIsContractOwner();

        if (s.dexWhitelist[_dex] == false) {
            return;
        }

        s.dexWhitelist[_dex] = false;
        for (uint256 i; i < s.dexs.length; i++) {
            if (s.dexs[i] == _dex) {
                _removeDex(i);
                return;
            }
        }
    }

    /// @notice Batch unregister the addresses of DEX contracts approved for swapping.
    /// @param _dexs The addresses of the DEX contracts to be unregistered.
    function batchRemoveDex(address[] calldata _dexs) external {
        LibDiamond.enforceIsContractOwner();

        for (uint256 i; i < _dexs.length; i++) {
            if (s.dexWhitelist[_dexs[i]] == false) {
                continue;
            }
            s.dexWhitelist[_dexs[i]] = false;
            for (uint256 j; j < s.dexs.length; j++) {
                if (s.dexs[j] == _dexs[i]) {
                    _removeDex(j);
                    return;
                }
            }
        }
    }

    function approvedDexs() external view returns (address[] memory) {
        return s.dexs;
    }

    function _removeDex(uint256 index) private {
        // Move the last element into the place to delete
        s.dexs[index] = s.dexs[s.dexs.length - 1];
        // Remove the last element
        s.dexs.pop();
    }
}
