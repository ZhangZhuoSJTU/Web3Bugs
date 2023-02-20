// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IWETH} from '../interfaces/IWETH.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IWithdraw} from '../interfaces/IWithdraw.sol';
import {ETH} from './ETH.sol';

library Withdraw {
    function collect(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IFactory factory,
        IWithdraw.Collect calldata params
    ) external returns (IPair.Tokens memory tokensOut) {
        tokensOut = _collect(
            natives,
            IWithdraw._Collect(
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                params.assetTo,
                params.collateralTo,
                params.claimsIn
            )
        );
    }

    function collectETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IFactory factory,
        IWETH weth,
        IWithdraw.CollectETHAsset calldata params
    ) external returns (IPair.Tokens memory tokensOut) {
        tokensOut = _collect(
            natives,
            IWithdraw._Collect(
                factory,
                weth,
                params.collateral,
                params.maturity,
                address(this),
                params.collateralTo,
                params.claimsIn
            )
        );

        if (tokensOut.asset != 0) {
            weth.withdraw(tokensOut.asset);
            ETH.transfer(params.assetTo, tokensOut.asset);
        }
    }

    function collectETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IFactory factory,
        IWETH weth,
        IWithdraw.CollectETHCollateral calldata params
    ) external returns (IPair.Tokens memory tokensOut) {
        tokensOut = _collect(
            natives,
            IWithdraw._Collect(
                factory,
                params.asset,
                weth,
                params.maturity,
                params.assetTo,
                address(this),
                params.claimsIn
            )
        );

        if (tokensOut.collateral != 0) {
            weth.withdraw(tokensOut.collateral);
            ETH.transfer(params.collateralTo, tokensOut.collateral);
        }
    }

    function _collect(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IWithdraw._Collect memory params
    ) private returns (IPair.Tokens memory tokensOut) {
        IPair pair = params.factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');

        IConvenience.Native memory native = natives[params.asset][params.collateral][params.maturity];
        require(address(native.liquidity) != address(0), 'E502');

        tokensOut = pair.withdraw(
            IPair.WithdrawParam(params.maturity, params.assetTo, params.collateralTo, params.claimsIn)
        );

        if (params.claimsIn.bondInterest != 0) native.bondInterest.burn(msg.sender, params.claimsIn.bondInterest);
        if (params.claimsIn.bondPrincipal != 0) native.bondPrincipal.burn(msg.sender, params.claimsIn.bondPrincipal);
        if (params.claimsIn.insuranceInterest != 0)
            native.insuranceInterest.burn(msg.sender, params.claimsIn.insuranceInterest);
        if (params.claimsIn.insurancePrincipal != 0)
            native.insurancePrincipal.burn(msg.sender, params.claimsIn.insurancePrincipal);
    }
}
