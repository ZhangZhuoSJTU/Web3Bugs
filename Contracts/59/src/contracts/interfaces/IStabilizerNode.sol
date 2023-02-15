pragma solidity >=0.6.6;

import "./IAuction.sol";

interface IStabilizerNode {
  function stabilize() external;
  function auction() external view returns (IAuction);
}
