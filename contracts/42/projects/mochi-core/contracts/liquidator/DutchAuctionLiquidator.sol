// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@mochifi/library/contracts/Float.sol";
import "@mochifi/library/contracts/BeaconProxyDeployer.sol";
import "../interfaces/ILiquidator.sol";
import "../interfaces/IMochiEngine.sol";

contract DutchAuctionLiquidator is ILiquidator {
    using Float for uint256;
    IMochiEngine public immutable engine;

    uint256 public constant DURATION = 2 days / 15;

    struct Auction {
        uint256 nftId;
        address vault;
        uint256 startedAt;
        uint256 boughtAt;
        uint256 collateral;
        uint256 debt;
    }

    mapping(uint256 => Auction) public auctions;

    constructor(address _engine) {
        engine = IMochiEngine(_engine);
    }

    function auctionId(address asset, uint256 nftId)
        public
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encodePacked(asset, nftId)));
    }

    function price(uint256 _auctionId) external view returns (uint256) {
        Auction memory auction = auctions[_auctionId];
        return auction.debt + currentLiquidationFee(_auctionId);
    }

    function currentLiquidationFee(uint256 _auctionId)
        public
        view
        returns (uint256 liquidationFee)
    {
        Auction memory auction = auctions[_auctionId];
        liquidationFee = auction
            .debt
            .multiply(
                engine.mochiProfile().liquidationFee(
                    address(IMochiVault(auction.vault).asset())
                )
            )
            .multiply(
                float({
                    numerator: auction.startedAt + DURATION > block.number
                        ? auction.startedAt + DURATION - block.number
                        : 0,
                    denominator: DURATION
                })
            );
    }

    function triggerLiquidation(address _asset, uint256 _nftId)
        external
        override
    {
        IMochiVault vault = engine.vaultFactory().getVault(_asset);
        Auction storage auction = auctions[auctionId(_asset, _nftId)];
        require(auction.startedAt == 0 || auction.boughtAt != 0, "on going");
        uint256 debt = vault.currentDebt(_nftId);
        (, uint256 collateral, , , ) = vault.details(_nftId);

        vault.liquidate(_nftId, collateral, debt);

        auction.nftId = _nftId;
        auction.vault = address(vault);
        auction.startedAt = block.number;
        auction.boughtAt = 0;
        auction.collateral = collateral;
        auction.debt = debt;

        uint256 liquidationFee = debt.multiply(
            engine.mochiProfile().liquidationFee(address(_asset))
        );
        emit Triggered(auctionId(_asset, _nftId), debt + liquidationFee);
    }

    function settleLiquidation(
        uint256 _auctionId,
        uint256 _collateral,
        uint256 _repaid
    ) internal {
        Auction storage auction = auctions[_auctionId];
        require(auction.boughtAt == 0, "liquidated");
        IMochiVault vault = IMochiVault(auction.vault);
        //repay the debt first
        engine.usdm().transferFrom(msg.sender, address(this), _repaid);
        engine.usdm().burn(_repaid);
        IERC20 asset = vault.asset();
        auction.boughtAt = block.number;
        asset.transfer(msg.sender, _collateral);
        //transfer liquidation fee to feePool
        uint256 liquidationFee = currentLiquidationFee(_auctionId);
        engine.usdm().transferFrom(
            msg.sender,
            address(engine.feePool()),
            liquidationFee
        );

        emit Settled(_auctionId, _repaid + liquidationFee);
    }

    function buy(uint256 _auctionId) external {
        Auction memory auction = auctions[_auctionId];
        require(auction.startedAt != 0 && auction.boughtAt == 0, "!on going");
        settleLiquidation(_auctionId, auction.collateral, auction.debt);
    }
}
