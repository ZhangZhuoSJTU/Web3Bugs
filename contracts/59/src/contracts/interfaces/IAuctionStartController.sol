pragma solidity >=0.6.6;

interface IAuctionStartController {
  function checkForStart() external view returns(bool);
}
