// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IWETH} from '../interfaces/IWETH.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {ILend} from '../interfaces/ILend.sol';
import {LendMath} from './LendMath.sol';
import {Deploy} from './Deploy.sol';
import {MsgValue} from './MsgValue.sol';

library Lend {
    using LendMath for IPair;
    using Deploy for IConvenience.Native;

    function lendGivenBond(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        ILend.LendGivenBond calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        (assetIn, claimsOut) = _lendGivenBond(
            natives,
            ILend._LendGivenBond(
                convenience,
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                params.bondTo,
                params.insuranceTo,
                params.assetIn,
                params.bondOut,
                params.minInsurance,
                params.deadline
            )
        );
    }

    function lendGivenBondETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        ILend.LendGivenBondETHAsset calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        uint112 assetInETH = MsgValue.getUint112();

        (assetIn, claimsOut) = _lendGivenBond(
            natives,
            ILend._LendGivenBond(
                convenience,
                factory,
                weth,
                params.collateral,
                params.maturity,
                address(this),
                params.bondTo,
                params.insuranceTo,
                assetInETH,
                params.bondOut,
                params.minInsurance,
                params.deadline
            )
        );
    }

    function lendGivenBondETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        ILend.LendGivenBondETHCollateral calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        (assetIn, claimsOut) = _lendGivenBond(
            natives,
            ILend._LendGivenBond(
                convenience,
                factory,
                params.asset,
                weth,
                params.maturity,
                msg.sender,
                params.bondTo,
                params.insuranceTo,
                params.assetIn,
                params.bondOut,
                params.minInsurance,
                params.deadline
            )
        );
    }

    function lendGivenInsurance(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        ILend.LendGivenInsurance calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        (assetIn, claimsOut) = _lendGivenInsurance(
            natives,
            ILend._LendGivenInsurance(
                convenience,
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                params.bondTo,
                params.insuranceTo,
                params.assetIn,
                params.insuranceOut,
                params.minBond,
                params.deadline
            )
        );
    }

    function lendGivenInsuranceETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        ILend.LendGivenInsuranceETHAsset calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        uint112 assetInETH = MsgValue.getUint112();

        (assetIn, claimsOut) = _lendGivenInsurance(
            natives,
            ILend._LendGivenInsurance(
                convenience,
                factory,
                weth,
                params.collateral,
                params.maturity,
                address(this),
                params.bondTo,
                params.insuranceTo,
                assetInETH,
                params.insuranceOut,
                params.minBond,
                params.deadline
            )
        );
    }

    function lendGivenInsuranceETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        ILend.LendGivenInsuranceETHCollateral calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        (assetIn, claimsOut) = _lendGivenInsurance(
            natives,
            ILend._LendGivenInsurance(
                convenience,
                factory,
                params.asset,
                weth,
                params.maturity,
                msg.sender,
                params.bondTo,
                params.insuranceTo,
                params.assetIn,
                params.insuranceOut,
                params.minBond,
                params.deadline
            )
        );
    }

    function lendGivenPercent(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        ILend.LendGivenPercent calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        (assetIn, claimsOut) = _lendGivenPercent(
            natives,
            ILend._LendGivenPercent(
                convenience,
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                params.bondTo,
                params.insuranceTo,
                params.assetIn,
                params.percent,
                params.minBond,
                params.minInsurance,
                params.deadline
            )
        );
    }

    function lendGivenPercentETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        ILend.LendGivenPercentETHAsset calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        uint112 assetInETH = MsgValue.getUint112();

        (assetIn, claimsOut) = _lendGivenPercent(
            natives,
            ILend._LendGivenPercent(
                convenience,
                factory,
                weth,
                params.collateral,
                params.maturity,
                address(this),
                params.bondTo,
                params.insuranceTo,
                assetInETH,
                params.percent,
                params.minBond,
                params.minInsurance,
                params.deadline
            )
        );
    }

    function lendGivenPercentETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        ILend.LendGivenPercentETHCollateral calldata params
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        (assetIn, claimsOut) = _lendGivenPercent(
            natives,
            ILend._LendGivenPercent(
                convenience,
                factory,
                params.asset,
                weth,
                params.maturity,
                msg.sender,
                params.bondTo,
                params.insuranceTo,
                params.assetIn,
                params.percent,
                params.minBond,
                params.minInsurance,
                params.deadline
            )
        );
    }

    function _lendGivenBond(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        ILend._LendGivenBond memory params
    ) private returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        require(params.bondOut > params.assetIn, 'E517');

        IPair pair = params.factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');
        (uint112 xIncrease, uint112 yDecrease, uint112 zDecrease) = pair.givenBond(
            params.maturity,
            params.assetIn,
            params.bondOut
        );

        (assetIn, claimsOut) = _lend(
            natives,
            ILend._Lend(
                params.convenience,
                pair,
                params.asset,
                params.collateral,
                params.maturity,
                params.from,
                params.bondTo,
                params.insuranceTo,
                xIncrease,
                yDecrease,
                zDecrease,
                params.deadline
            )
        );

        require(uint128(claimsOut.insuranceInterest) + claimsOut.insurancePrincipal >= params.minInsurance, 'E515');
    }

    function _lendGivenInsurance(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        ILend._LendGivenInsurance memory params
    ) private returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        IPair pair = params.factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');

        (uint112 xIncrease, uint112 yDecrease, uint112 zDecrease) = pair.givenInsurance(
            params.maturity,
            params.assetIn,
            params.insuranceOut
        );

        (assetIn, claimsOut) = _lend(
            natives,
            ILend._Lend(
                params.convenience,
                pair,
                params.asset,
                params.collateral,
                params.maturity,
                params.from,
                params.bondTo,
                params.insuranceTo,
                xIncrease,
                yDecrease,
                zDecrease,
                params.deadline
            )
        );

        require(uint128(claimsOut.bondInterest) + claimsOut.bondPrincipal >= params.minBond, 'E514');
    }

    function _lendGivenPercent(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        ILend._LendGivenPercent memory params
    ) private returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        require(params.percent <= 0x100000000, 'E505');

        IPair pair = params.factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');

        (uint112 xIncrease, uint112 yDecrease, uint112 zDecrease) = pair.givenPercent(
            params.maturity,
            params.assetIn,
            params.percent
        );

        (assetIn, claimsOut) = _lend(
            natives,
            ILend._Lend(
                params.convenience,
                pair,
                params.asset,
                params.collateral,
                params.maturity,
                params.from,
                params.bondTo,
                params.insuranceTo,
                xIncrease,
                yDecrease,
                zDecrease,
                params.deadline
            )
        );

        require(uint128(claimsOut.bondInterest) + claimsOut.bondPrincipal >= params.minBond, 'E514');
        require(uint128(claimsOut.insuranceInterest) + claimsOut.insurancePrincipal >= params.minInsurance, 'E515');
    }

    function _lend(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        ILend._Lend memory params
    ) private returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        require(params.deadline >= block.timestamp, 'E504');
        require(params.maturity > block.timestamp, 'E508');

        IConvenience.Native storage native = natives[params.asset][params.collateral][params.maturity];
        if (address(native.liquidity) == address(0))
            native.deploy(params.convenience, params.pair, params.asset, params.collateral, params.maturity);

        (assetIn, claimsOut) = params.pair.lend(
            IPair.LendParam(
                params.maturity,
                address(this),
                address(this),
                params.xIncrease,
                params.yDecrease,
                params.zDecrease,
                bytes(abi.encode(params.asset, params.collateral, params.from))
            )
        );

        native.bondInterest.mint(params.bondTo, claimsOut.bondInterest);
        native.bondPrincipal.mint(params.bondTo, claimsOut.bondPrincipal);
        native.insuranceInterest.mint(params.insuranceTo, claimsOut.insuranceInterest);
        native.insurancePrincipal.mint(params.insuranceTo, claimsOut.insurancePrincipal);
    }
}
