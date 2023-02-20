// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {DeployERC20} from './DeployERC20.sol';
import {DeployERC721} from './DeployERC721.sol';

library Deploy {
    using Strings for uint256;
    using DeployERC20 for IConvenience.Native;
    using DeployERC721 for IConvenience.Native;

    /// @dev Emits when the new natives are deployed.
    /// @param asset The address of the asset ERC20 contract.
    /// @param collateral The address of the collateral ERC20 contract.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param native The native ERC20 and ERC721 contracts deployed.
    event DeployNative(IERC20 indexed asset, IERC20 indexed collateral, uint256 maturity, IConvenience.Native native);

    function deploy(
        IConvenience.Native storage native,
        IConvenience convenience,
        IPair pair,
        IERC20 asset,
        IERC20 collateral,
        uint256 maturity
    ) internal {
        bytes32 salt = keccak256(abi.encode(asset, collateral, maturity.toString()));
        native.deployERC20(salt, convenience, pair, maturity);
        native.deployERC721(salt, convenience, pair, maturity);

        emit DeployNative(asset, collateral, maturity, native);
    }
}
