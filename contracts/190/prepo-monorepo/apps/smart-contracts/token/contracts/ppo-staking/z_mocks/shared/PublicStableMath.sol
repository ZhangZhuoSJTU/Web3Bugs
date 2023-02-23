// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {StableMath} from "../../shared/StableMath.sol";

contract PublicStableMath {
  using StableMath for uint256;

  function getFullScale() external pure returns (uint256) {
    return StableMath.getFullScale();
  }

  function getRatioScale() external pure returns (uint256) {
    return StableMath.getRatioScale();
  }

  function scaleInteger(uint256 x) external pure returns (uint256) {
    return x.scaleInteger();
  }

  function mulTruncateScale(
    uint256 x,
    uint256 y,
    uint256 scale
  ) external pure returns (uint256) {
    return x.mulTruncateScale(y, scale);
  }

  function mulTruncate(uint256 x, uint256 y) external pure returns (uint256) {
    return x.mulTruncate(y);
  }

  function mulTruncateCeil(uint256 x, uint256 y)
    external
    pure
    returns (uint256)
  {
    return x.mulTruncateCeil(y);
  }

  function divPrecisely(uint256 x, uint256 y) external pure returns (uint256) {
    return x.divPrecisely(y);
  }

  function mulRatioTruncate(uint256 x, uint256 ratio)
    external
    pure
    returns (uint256)
  {
    return x.mulRatioTruncate(ratio);
  }

  function mulRatioTruncateCeil(uint256 x, uint256 ratio)
    external
    pure
    returns (uint256)
  {
    return x.mulRatioTruncateCeil(ratio);
  }

  function divRatioPrecisely(uint256 x, uint256 ratio)
    external
    pure
    returns (uint256)
  {
    return x.divRatioPrecisely(ratio);
  }

  function min(uint256 x, uint256 y) external pure returns (uint256) {
    return x.min(y);
  }

  function max(uint256 x, uint256 y) external pure returns (uint256) {
    return x.max(y);
  }

  function clamp(uint256 x, uint256 upperBound)
    external
    pure
    returns (uint256)
  {
    return x.clamp(upperBound);
  }
}
