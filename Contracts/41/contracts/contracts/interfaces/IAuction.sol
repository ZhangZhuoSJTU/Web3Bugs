pragma solidity =0.8.7;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IBasket.sol";
import "./IFactory.sol";

interface IAuction {
    struct Bounty {
        address token;
        uint256 amount;
        bool active;
    }

    function startAuction() external;
    function bondForRebalance() external;
    function settleAuction(
        uint256[] calldata,
        address[] calldata,
        uint256[] calldata,
        address[] calldata,
        uint256[] calldata
    ) external;
    function bondBurn() external;
    function killAuction() external;
    function addBounty(IERC20, uint256) external returns (uint256);
    function initialize(address, address) external;
    function initialized() external view returns (bool);

    function auctionOngoing() external view returns (bool);
    function auctionStart() external view returns (uint256);
    function hasBonded() external view returns (bool);
    function bondAmount() external view returns (uint256);
    function bondBlock() external view returns (uint256);

    function basket() external view returns (IBasket);
    function factory() external view returns (IFactory);
    function auctionBonder() external view returns (address);

    event AuctionStarted();
    event Bonded(address _bonder, uint256 _amount);
    event AuctionSettled(address _settler);
    event BondBurned(address _burned, address _burnee, uint256 _amount);
    event BountyAdded(IERC20 _token, uint256 _amount, uint256 _id);
    event BountyClaimed(address _claimer, address _token, uint256 _amount, uint256 _id);
}