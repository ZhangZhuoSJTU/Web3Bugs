// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

import "../../interfaces/IBentoBoxMinimal.sol";
import "../../interfaces/IConcentratedLiquidityPool.sol";
import "../../interfaces/IMasterDeployer.sol";
import "../../interfaces/ITridentRouter.sol";
import "../../libraries/concentratedPool/FullMath.sol";
import "./TridentNFT.sol";
import "hardhat/console.sol";

/// @notice Trident Concentrated Liquidity Pool periphery contract that combines non-fungible position management and staking.
abstract contract ConcentratedLiquidityPosition is TridentNFT {
    event Mint(address indexed pool, address indexed recipient, uint256 indexed positionId);
    event Burn(address indexed pool, address indexed owner, uint256 indexed positionId);

    address public immutable wETH;
    IBentoBoxMinimal public immutable bento;
    IMasterDeployer public immutable masterDeployer;

    mapping(uint256 => Position) public positions;

    struct Position {
        IConcentratedLiquidityPool pool;
        uint128 liquidity;
        int24 lower;
        int24 upper;
        uint256 feeGrowthInside0; /// @dev Per unit of liquidity.
        uint256 feeGrowthInside1;
    }

    constructor(address _wETH, address _masterDeployer) {
        wETH = _wETH;
        masterDeployer = IMasterDeployer(_masterDeployer);
        bento = IBentoBoxMinimal(IMasterDeployer(_masterDeployer).bento());
    }

    function positionMintCallback(
        address recipient,
        int24 lower,
        int24 upper,
        uint128 amount,
        uint256 feeGrowthInside0,
        uint256 feeGrowthInside1
    ) external returns (uint256 positionId) {
        require(IMasterDeployer(masterDeployer).pools(msg.sender), "NOT_POOL");
        positions[totalSupply] = Position(IConcentratedLiquidityPool(msg.sender), amount, lower, upper, feeGrowthInside0, feeGrowthInside1);
        positionId = totalSupply;
        _mint(recipient);
        emit Mint(msg.sender, recipient, positionId);
    }

    function burn(
        uint256 tokenId,
        uint128 amount,
        address recipient,
        bool unwrapBento
    ) external {
        require(msg.sender == ownerOf[tokenId], "NOT_ID_OWNER");
        Position storage position = positions[tokenId];
        if (position.liquidity < amount) amount = position.liquidity;

        position.pool.burn(abi.encode(position.lower, position.upper, amount, recipient, unwrapBento));

        if (amount < position.liquidity) {
            position.liquidity -= amount;
        } else {
            delete positions[tokenId];
            _burn(tokenId);
        }
        emit Burn(address(position.pool), msg.sender, tokenId);
    }

    function collect(
        uint256 tokenId,
        address recipient,
        bool unwrapBento
    ) external returns (uint256 token0amount, uint256 token1amount) {
        require(msg.sender == ownerOf[tokenId], "NOT_ID_OWNER");

        Position storage position = positions[tokenId];

        (address token0, address token1) = _getAssets(position.pool);

        {
            (uint256 feeGrowthInside0, uint256 feeGrowthInside1) = position.pool.rangeFeeGrowth(position.lower, position.upper);
            token0amount = FullMath.mulDiv(
                feeGrowthInside0 - position.feeGrowthInside0,
                position.liquidity,
                0x100000000000000000000000000000000
            );
            token1amount = FullMath.mulDiv(
                feeGrowthInside1 - position.feeGrowthInside1,
                position.liquidity,
                0x100000000000000000000000000000000
            );

            position.feeGrowthInside0 = feeGrowthInside0;
            position.feeGrowthInside1 = feeGrowthInside1;
        }

        uint256 balance0 = bento.balanceOf(token0, address(this));
        uint256 balance1 = bento.balanceOf(token1, address(this));
        if (balance0 < token0amount || balance1 < token1amount) {
            (uint256 amount0fees, uint256 amount1fees) = position.pool.collect(position.lower, position.upper, address(this), false);

            uint256 newBalance0 = amount0fees + balance0;
            uint256 newBalance1 = amount1fees + balance1;

            /// @dev Rounding errors due to frequent claiming of other users in the same position may cost us some raw
            if (token0amount > newBalance0) token0amount = newBalance0;
            if (token1amount > newBalance1) token1amount = newBalance1;
        }
        _transfer(token0, address(this), recipient, token0amount, unwrapBento);
        _transfer(token1, address(this), recipient, token1amount, unwrapBento);
    }

    function _getAssets(IConcentratedLiquidityPool pool) internal view returns (address token0, address token1) {
        address[] memory pair = pool.getAssets();
        token0 = pair[0];
        token1 = pair[1];
    }

    function _transfer(
        address token,
        address from,
        address to,
        uint256 shares,
        bool unwrapBento
    ) internal {
        if (unwrapBento) {
            bento.withdraw(token, from, to, 0, shares);
        } else {
            bento.transfer(token, from, to, shares);
        }
    }
}
