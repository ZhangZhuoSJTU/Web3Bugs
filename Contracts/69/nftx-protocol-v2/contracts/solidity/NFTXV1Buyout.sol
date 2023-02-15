pragma solidity ^0.8.0;

import "./token/IERC20Upgradeable.sol";
import "./util/ReentrancyGuardUpgradeable.sol"; 
import "./util/PausableUpgradeable.sol"; 

interface IV1Token is IERC20Upgradeable {
  function burnFrom(address account, uint256 amount) external;
}

contract NFTXV1Buyout is PausableUpgradeable, ReentrancyGuardUpgradeable { 
  uint256 constant BASE = 10*18;
  mapping(address => uint256) public ethAvailiable;

  event TokenBuyout(address tokenAddress, uint256 totalEth);
  event BuyoutComplete(address tokenAddress);

  function __NFTXV1Buyout_init() external initializer {
    __Pausable_init();
    __ReentrancyGuard_init();
  }

  // Emergency functions.
  function emergencyWithdraw() external onlyOwner {
    payable(msg.sender).transfer(address(this).balance);
  }

  function clearBuyout(address v1TokenAddr) external onlyOwner {
    ethAvailiable[v1TokenAddr] = 0;
    emit BuyoutComplete(v1TokenAddr);
  }

  function addBuyout(address v1TokenAddr) external payable onlyOwner {
    require(msg.value > 0, "Cannot pair with 0 ETH");
    ethAvailiable[v1TokenAddr] += msg.value;

    emit TokenBuyout(v1TokenAddr, msg.value);
  }

  function removeBuyout(address v1TokenAddr) external onlyOwner {
    uint256 amount = ethAvailiable[v1TokenAddr];
    require(amount > 0, "Cannot remove 0");
    ethAvailiable[v1TokenAddr] = 0;
    payable(msg.sender).transfer(amount);
    emit BuyoutComplete(v1TokenAddr);
  }

  function claimETH(address v1TokenAddr) external nonReentrant {
    onlyOwnerIfPaused(0);
    uint256 ethAvail = ethAvailiable[v1TokenAddr];
    require(ethAvail > 0, "Not a valid buyout token");

    uint256 userBal = IV1Token(v1TokenAddr).balanceOf(msg.sender);
    require(userBal > 0, "cant be zero");
    uint256 totalSupply = IV1Token(v1TokenAddr).totalSupply();
    IV1Token(v1TokenAddr).burnFrom(msg.sender, userBal);
    uint256 ethToSend = (ethAvail * userBal)/totalSupply;
    ethToSend = ethToSend > ethAvail ? ethAvail : ethToSend;
    ethAvailiable[v1TokenAddr] -= ethToSend;
    (bool success, ) = msg.sender.call{ value: ethToSend }("");
    require(success, "Address: unable to send value, recipient may have reverted");

    if (ethAvailiable[v1TokenAddr] == 0) {
      emit BuyoutComplete(v1TokenAddr);
    }
  }
}