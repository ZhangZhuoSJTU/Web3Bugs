pragma solidity =0.8.7;

import "hardhat/console.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IBasket.sol";
import "./interfaces/IFactory.sol";

contract Factory is IFactory, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant BASE = 1e18;

    constructor (IAuction _auctionImpl, IBasket _basketImpl) {
        auctionImpl = _auctionImpl;
        basketImpl = _basketImpl;
        ownerSplit = 0; //TODO: needed?
    }

    Proposal[] private _proposals;

    IAuction public override auctionImpl;
    IBasket public override basketImpl;

    uint256 public override minLicenseFee = 1e15; // 1e15 0.1%
    uint256 public override auctionDecrement = 10000;
    uint256 public override auctionMultiplier = 2;
    uint256 public override bondPercentDiv = 400;
    uint256 public override ownerSplit;

    function proposal(uint256 proposalId) external override view returns (Proposal memory) {
        return _proposals[proposalId];
    }

    function setMinLicenseFee(uint256 newMinLicenseFee) public override onlyOwner {
        minLicenseFee = newMinLicenseFee;
    }

    function setAuctionDecrement(uint256 newAuctionDecrement) public override onlyOwner {
        auctionDecrement = newAuctionDecrement;
    }

    function setAuctionMultiplier(uint256 newAuctionMultiplier) public override onlyOwner {
        auctionMultiplier = newAuctionMultiplier;
    }

    function setBondPercentDiv(uint256 newBondPercentDiv) public override onlyOwner {
        bondPercentDiv = newBondPercentDiv;
    }

    function setOwnerSplit(uint256 newOwnerSplit) public override onlyOwner {
        require(newOwnerSplit <= 2e17); // 20%

        ownerSplit = newOwnerSplit;
    }

    function getProposalWeights(uint256 id) external override view returns (address[] memory, uint256[] memory) {
        return (_proposals[id].tokens, _proposals[id].weights);
    }

    function proposeBasketLicense(
        uint256 licenseFee, 
        string memory tokenName, 
        string memory tokenSymbol, 
        address[] memory tokens,
        uint256[] memory weights
    ) public override returns (uint256 id) {
        basketImpl.validateWeights(tokens, weights);

        require(licenseFee >= minLicenseFee);

        // create proposal object
        Proposal memory proposal = Proposal({
            licenseFee: licenseFee,
            tokenName: tokenName,
            tokenSymbol: tokenSymbol,
            proposer: address(msg.sender),
            tokens: tokens,
            weights: weights,
            basket: address(0)
        });

        emit BasketLicenseProposed(msg.sender, tokenName);
        _proposals.push(proposal);

        return _proposals.length - 1;
    }

    function createBasket(uint256 idNumber) external override returns (IBasket) {
        Proposal memory bProposal = _proposals[idNumber];
        require(bProposal.basket == address(0));

        IAuction newAuction = IAuction(Clones.clone(address(auctionImpl)));
        IBasket newBasket = IBasket(Clones.clone(address(basketImpl)));

        _proposals[idNumber].basket = address(newBasket);

        newAuction.initialize(address(newBasket), address(this));
        newBasket.initialize(bProposal, newAuction);

        for (uint256 i = 0; i < bProposal.weights.length; i++) {
            IERC20 token = IERC20(bProposal.tokens[i]);
            token.safeTransferFrom(msg.sender, address(this), bProposal.weights[i]);
            token.safeApprove(address(newBasket), bProposal.weights[i]);
        }

        newBasket.mintTo(BASE, msg.sender);

        emit BasketCreated(address(newBasket));

        return newBasket;
    }
}
