// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ITimeswapBorrowCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapBorrowCallback.sol';
import {ITimeswapLendCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapLendCallback.sol';
import {ITimeswapMintCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapMintCallback.sol';
import {ITimeswapPayCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapPayCallback.sol';

contract TimeswapPairCallee {
    IPair public immutable pairContract;
    IFactory public immutable factoryContract;

    constructor(address pair) {
        pairContract = IPair(pair);
        factoryContract = IPair(pair).factory();
    }

    struct PairCalleeInfo {
        IERC20 asset;
        IERC20 collateral;
        address from;
    }
    struct PairCalleeInfoMint {
        IERC20 asset;
        IERC20 collateral;
        address assetFrom;
        address collateralFrom;
    }

    function getData(address from) public view returns (bytes memory data) {
        data = abi.encode(PairCalleeInfo(pairContract.asset(), pairContract.collateral(), from));
    }

    function getDataMint(address from) public view returns (bytes memory data) {
        data = abi.encode(PairCalleeInfoMint(pairContract.asset(), pairContract.collateral(), from, from));
    }

    function mint(
        uint256 maturity,
        address liquidityTo,
        uint112 xIncrease,
        uint112 yIncrease,
        uint112 zIncrease
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        return
            pairContract.mint(
                IPair.MintParam(
                    maturity,
                    liquidityTo,
                    address(this),
                    xIncrease,
                    yIncrease,
                    zIncrease,
                    getDataMint(msg.sender)
                )
            );
    }

    function lend(
        uint256 maturity,
        address bondTo,
        address insuranceTo,
        uint112 xIncrease,
        uint112 yDecrease,
        uint112 zDecrease
    ) external returns (uint256 assetIn, IPair.Claims memory claimsOut) {
        return
            pairContract.lend(
                IPair.LendParam(maturity, bondTo, insuranceTo, xIncrease, yDecrease, zDecrease, getData(msg.sender))
            );
    }

    function borrow(
        uint256 maturity,
        address assetTo,
        address dueTo,
        uint112 xDecrease,
        uint112 yIncrease,
        uint112 zIncrease
    )
        external
        returns (
            uint256 assetOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        return
            pairContract.borrow(
                IPair.BorrowParam(maturity, assetTo, dueTo, xDecrease, yIncrease, zIncrease, getData(msg.sender))
            );
    }

    function pay(
        uint256 maturity,
        address to,
        address owner,
        uint256[] memory ids,
        uint112[] memory assetsIn,
        uint112[] memory collateralsOut
    ) external returns (uint128 assetIn, uint128 collateralOut) {
        return
            pairContract.pay(IPair.PayParam(maturity, to, owner, ids, assetsIn, collateralsOut, getData(msg.sender)));
    }

    function timeswapMintCallback(
        uint256 assetIn,
        uint112 collateralIn,
        bytes calldata data
    ) external {
        (IERC20 asset, IERC20 collateral, address assetFrom, address collateralFrom) = abi.decode(
            data,
            (IERC20, IERC20, address, address)
        );
        IPair pair = factoryContract.getPair(asset, collateral);

        require(msg.sender == address(pair), 'Invalid sender');
        asset.transferFrom(assetFrom, address(pair), assetIn);
        collateral.transferFrom(collateralFrom, address(pair), collateralIn);
    }

    function timeswapLendCallback(uint256 assetIn, bytes calldata data) external {
        (IERC20 asset, IERC20 collateral, address from) = abi.decode(data, (IERC20, IERC20, address));
        IPair pair = factoryContract.getPair(asset, collateral);

        require(msg.sender == address(pair), 'Invalid sender');
        asset.transferFrom(from, address(pair), assetIn);
    }

    function timeswapBorrowCallback(uint112 collateralIn, bytes calldata data) external {
        (IERC20 asset, IERC20 collateral, address from) = abi.decode(data, (IERC20, IERC20, address));
        IPair pair = factoryContract.getPair(asset, collateral);

        require(msg.sender == address(pair), 'Invalid sender');
        collateral.transferFrom(from, address(pair), collateralIn);
    }

    function timeswapPayCallback(uint128 assetIn, bytes calldata data) external {
        (IERC20 asset, IERC20 collateral, address from) = abi.decode(data, (IERC20, IERC20, address));
        IPair pair = factoryContract.getPair(asset, collateral);
        asset.transferFrom(from, address(pair), assetIn);
    }
}
