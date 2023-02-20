pragma solidity =0.8.7;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import './interfaces/IFactory.sol';
import './interfaces/IBasket.sol';
import "./interfaces/IAuction.sol";
import "hardhat/console.sol";

contract Auction is IAuction {
    using SafeERC20 for IERC20;

    uint256 private constant BASE = 1e18;
    uint256 private constant ONE_DAY = 4 * 60 * 24;
    uint256 private constant BLOCK_DECREMENT = 10000;
    
    bool public override auctionOngoing;
    uint256 public override auctionStart;
    bool public override hasBonded;
    uint256 public override bondAmount;
    uint256 public override bondTimestamp;
    bool public override initialized;

    IBasket public override basket;
    IFactory public override factory;
    address public override auctionBonder;

    Bounty[] private _bounties;

    modifier onlyBasket() {
        require(msg.sender == address(basket), 'not basket');
        _;
    }

    function startAuction() onlyBasket public override {
        require(auctionOngoing == false, 'ongoing auction');

        auctionOngoing = true;
        auctionStart = block.number;

        emit AuctionStarted();
    }

    function killAuction() onlyBasket public override {
        auctionOngoing = false;
    }

    function initialize(address basket_, address factory_) public override {
        require(!initialized);
        basket = IBasket(basket_);
        factory = IFactory(factory_);
        initialized = true;
    }

    function bondForRebalance() public override {
        require(auctionOngoing);
        require(!hasBonded);

        bondTimestamp = block.number;

        IERC20 basketToken = IERC20(address(basket));
        bondAmount = basketToken.totalSupply() / factory.bondPercentDiv();
        basketToken.safeTransferFrom(msg.sender, address(this), bondAmount);
        hasBonded = true;
        auctionBonder = msg.sender;

        emit Bonded(msg.sender, bondAmount);
    }

    function settleAuction(
        uint256[] memory bountyIDs,
        address[] memory inputTokens,
        uint256[] memory inputWeights,
        address[] memory outputTokens,
        uint256[] memory outputWeights
    ) public override {
        require(auctionOngoing);
        require(hasBonded);
        require(bondTimestamp + ONE_DAY > block.number);
        require(msg.sender == auctionBonder);

        for (uint256 i = 0; i < inputTokens.length; i++) {
            IERC20(inputTokens[i]).safeTransferFrom(msg.sender, address(basket), inputWeights[i]);
        }

        for (uint256 i = 0; i < outputTokens.length; i++) {
            IERC20(outputTokens[i]).safeTransferFrom(address(basket), msg.sender, outputWeights[i]);
        }

        uint256 a = factory.auctionMultiplier() * basket.ibRatio();
        uint256 b = (bondTimestamp - auctionStart) * BASE / factory.auctionDecrement();
        uint256 newRatio = a - b;

        (address[] memory pendingTokens, uint256[] memory pendingWeights) = basket.getPendingWeights();
        IERC20 basketAsERC20 = IERC20(address(basket));

        for (uint256 i = 0; i < pendingWeights.length; i++) {
            uint256 tokensNeeded = basketAsERC20.totalSupply() * pendingWeights[i] * newRatio / BASE / BASE;
            require(IERC20(pendingTokens[i]).balanceOf(address(basket)) >= tokensNeeded);
        }

        basketAsERC20.transfer(msg.sender, bondAmount);
        withdrawBounty(bountyIDs);
        basket.setNewWeights();
        basket.updateIBRatio(newRatio);
        auctionOngoing = false;
        hasBonded = false;

        emit AuctionSettled(msg.sender);
    }

    function bondBurn() external override {
        require(auctionOngoing);
        require(hasBonded);
        require(bondTimestamp + ONE_DAY <= block.number);

        basket.auctionBurn(bondAmount);
        hasBonded = false;
        auctionOngoing = false;
        basket.deleteNewIndex();

        emit BondBurned(msg.sender, auctionBonder, bondAmount);

        auctionBonder = address(0);
    }

    function addBounty(IERC20 token, uint256 amount) public override returns (uint256) {
        // add bounty to basket
        token.safeTransferFrom(msg.sender, address(this), amount);
        _bounties.push(Bounty({
            token: address(token),
            amount: amount,
            active: true
        }));

        uint256 id = _bounties.length - 1;
        emit BountyAdded(token, amount, id);
        return id;
    }

    function withdrawBounty(uint256[] memory bountyIds) internal {
        // withdraw bounties
        for (uint256 i = 0; i < bountyIds.length; i++) {
            Bounty memory bounty = _bounties[bountyIds[i]];
            require(bounty.active);

            IERC20(bounty.token).transfer(msg.sender, bounty.amount);
            bounty.active = false;

            emit BountyClaimed(msg.sender, bounty.token, bounty.amount, bountyIds[i]);
        }
    }
 }