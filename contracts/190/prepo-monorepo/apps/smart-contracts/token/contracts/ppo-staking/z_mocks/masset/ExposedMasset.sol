// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {Masset, InvariantConfig} from "../../masset/Masset.sol";
import {MassetLogic} from "../../masset/MassetLogic.sol";

contract ExposedMasset is Masset {
  constructor(address _nexus, uint256 _recolFee) Masset(_nexus, _recolFee) {}

  uint256 private amountToMint = 0;

  function getK() external view returns (uint256 k) {
    (, k) = MassetLogic.computePrice(data.bAssetData, _getConfig());
  }

  function getA() public view returns (uint256) {
    return super._getA();
  }

  function simulateRedeemMasset(
    uint256 _amt,
    uint256[] calldata _minOut,
    uint256 _recolFee
  ) external {
    // Get config before burning. Burn > CacheSize
    InvariantConfig memory config = _getConfig();
    config.recolFee = _recolFee;
    MassetLogic.redeemProportionately(data, config, _amt, _minOut, msg.sender);
  }

  // Inject amount of tokens to mint
  function setAmountForCollectInterest(uint256 _amount) public {
    amountToMint = _amount;
  }
}
