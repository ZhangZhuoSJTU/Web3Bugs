pragma solidity =0.8.7;

import "../Collateral.sol";
import "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";

contract TestCollateral is Collateral, MulticallUpgradeable {}
