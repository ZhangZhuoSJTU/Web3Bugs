// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;
pragma abicoder v2;

import "../masset/MassetStructs.sol";

abstract contract IFeederPool {
  // Mint
  function mint(
    address _input,
    uint256 _inputQuantity,
    uint256 _minOutputQuantity,
    address _recipient
  ) external virtual returns (uint256 mintOutput);

  function mintMulti(
    address[] calldata _inputs,
    uint256[] calldata _inputQuantities,
    uint256 _minOutputQuantity,
    address _recipient
  ) external virtual returns (uint256 mintOutput);

  function getMintOutput(address _input, uint256 _inputQuantity)
    external
    view
    virtual
    returns (uint256 mintOutput);

  function getMintMultiOutput(
    address[] calldata _inputs,
    uint256[] calldata _inputQuantities
  ) external view virtual returns (uint256 mintOutput);

  // Swaps
  function swap(
    address _input,
    address _output,
    uint256 _inputQuantity,
    uint256 _minOutputQuantity,
    address _recipient
  ) external virtual returns (uint256 swapOutput);

  function getSwapOutput(
    address _input,
    address _output,
    uint256 _inputQuantity
  ) external view virtual returns (uint256 swapOutput);

  // Redemption
  function redeem(
    address _output,
    uint256 _fpTokenQuantity,
    uint256 _minOutputQuantity,
    address _recipient
  ) external virtual returns (uint256 outputQuantity);

  function redeemProportionately(
    uint256 _fpTokenQuantity,
    uint256[] calldata _minOutputQuantities,
    address _recipient
  ) external virtual returns (uint256[] memory outputQuantities);

  function redeemExactBassets(
    address[] calldata _outputs,
    uint256[] calldata _outputQuantities,
    uint256 _maxMassetQuantity,
    address _recipient
  ) external virtual returns (uint256 mAssetRedeemed);

  function getRedeemOutput(address _output, uint256 _fpTokenQuantity)
    external
    view
    virtual
    returns (uint256 bAssetOutput);

  function getRedeemExactBassetsOutput(
    address[] calldata _outputs,
    uint256[] calldata _outputQuantities
  ) external view virtual returns (uint256 mAssetAmount);

  // Views
  function mAsset() external view virtual returns (address);

  function getPrice() public view virtual returns (uint256 price, uint256 k);

  function getConfig()
    external
    view
    virtual
    returns (FeederConfig memory config);

  function getBasset(address _token)
    external
    view
    virtual
    returns (BassetPersonal memory personal, BassetData memory data);

  function getBassets()
    external
    view
    virtual
    returns (BassetPersonal[] memory personal, BassetData[] memory data);

  // SavingsManager
  function collectPlatformInterest()
    external
    virtual
    returns (uint256 mintAmount, uint256 newSupply);

  function collectPendingFees() external virtual;
}
