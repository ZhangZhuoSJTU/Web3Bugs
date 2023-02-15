// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { IVault } from "./Interfaces.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";

/**
 * @title   BalLiquidityProvider
 * @notice  Provides initial liquidity to a Balancer pool on behalf of a given DAO
 */
contract BalLiquidityProvider {
    using SafeERC20 for IERC20;

    IERC20 public immutable startToken;
    IERC20 public immutable pairToken;
    uint256 public minPairAmount;

    address private immutable provider;
    address public immutable dao;

    IVault public immutable bVault;

    event LiquidityProvided(uint256[] input, uint256 output);
    event MinPairAmountChanged(uint256 oldMinPairAmount, uint256 newMinPairAmount);

    constructor(
        address _startToken,
        address _pairToken,
        uint256 _minPairAmount,
        address _dao,
        address _bVault
    ) {
        startToken = IERC20(_startToken);
        pairToken = IERC20(_pairToken);
        minPairAmount = _minPairAmount;
        provider = msg.sender;
        dao = _dao;
        bVault = IVault(_bVault);
    }

    /**
     * @dev Provides liquidity on behalf of the dao, in a non-custodial manner.
     *      Has protections in place to ensure that no erroneous liquidity data gets added.
     */
    function provideLiquidity(bytes32 _poolId, IVault.JoinPoolRequest memory _request) public {
        require(msg.sender == provider, "!auth");
        require(_request.assets.length == 2 && _request.maxAmountsIn.length == 2, "!valid");
        require(pairToken.balanceOf(address(this)) > minPairAmount, "!minLiq");

        for (uint256 i = 0; i < 2; i++) {
            address asset = address(_request.assets[i]);
            require(asset == address(startToken) || asset == address(pairToken), "!asset");

            IERC20 tkn = IERC20(asset);
            uint256 bal = tkn.balanceOf(address(this));
            require(bal > 0 && bal == _request.maxAmountsIn[i], "!bal");

            tkn.safeApprove(address(bVault), 0);
            tkn.safeApprove(address(bVault), bal);
        }

        (address pool, ) = bVault.getPool(_poolId);
        uint256 supplyBefore = IERC20(pool).totalSupply();
        require(supplyBefore == 0, "!init");

        bVault.joinPool(_poolId, address(this), dao, _request);

        uint256 balAfter = IERC20(pool).balanceOf(dao);
        require(balAfter > 0, "!mint");

        emit LiquidityProvided(_request.maxAmountsIn, balAfter);
    }

    /**
     * @dev Allows the DAO to change the minimum amount of the pair token that must be added as liquidity
     */
    function changeMinPairAmount(uint256 _newAmount) external {
        require(msg.sender == dao, "!auth");
        emit MinPairAmountChanged(minPairAmount, _newAmount);
        minPairAmount = _newAmount;
    }

    /**
     * @dev Rescues a given token from the contract.
     * Only provider or DAO can call this function.
     */
    function rescueToken(address _erc20) external {
        require(msg.sender == provider || msg.sender == dao, "!auth");
        IERC20 tkn = IERC20(_erc20);
        tkn.safeTransfer(dao, tkn.balanceOf(address(this)));
    }
}
