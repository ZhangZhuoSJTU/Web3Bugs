pragma solidity =0.8.7;

import "./IBasket.sol";

interface IFactory {
    struct Bounty {
        address token;
        uint256 amount;
        bool active;
    }

    struct Proposal {
        uint256 licenseFee;
        string tokenName;
        string tokenSymbol;
        address proposer;
        address[] tokens;
        uint256[] weights;
        address basket;
    }


    //TODO: validate these
    function proposal(uint256) external view returns (Proposal memory);
    function minLicenseFee() external view returns (uint256);
    function auctionDecrement() external view returns (uint256);
    function auctionMultiplier() external view returns (uint256);
    function bondPercentDiv() external view returns (uint256);
    function ownerSplit() external view returns (uint256);
    function auctionImpl() external view returns (IAuction);
    function basketImpl() external view returns (IBasket);
    function getProposalWeights(uint256 id) external view returns (address[] memory, uint256[] memory);

    function createBasket(uint256) external returns (IBasket);
    function proposeBasketLicense(uint256, string calldata, string calldata, address[] memory tokens, uint256[] memory weights) external returns (uint256);
    function setMinLicenseFee(uint256) external;
    function setAuctionDecrement(uint256) external;
    function setAuctionMultiplier(uint256) external;
    function setBondPercentDiv(uint256) external;
    function setOwnerSplit(uint256) external;

    event BasketCreated(address indexed basket);
    event BasketLicenseProposed(address indexed proposer, string indexed tokenName);
}