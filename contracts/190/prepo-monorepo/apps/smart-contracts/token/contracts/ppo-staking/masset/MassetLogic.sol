// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

// External
import {IPlatformIntegration} from "../interfaces/IPlatformIntegration.sol";

// Internal
import "../masset/MassetStructs.sol";

// Libs
import {Root} from "../shared/Root.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {MassetHelpers} from "../shared/MassetHelpers.sol";
import {StableMath} from "../shared/StableMath.sol";

/**
 * @title   MassetLogic
 * @author  mStable
 * @notice  Builds on and enforces the StableSwap invariant conceived by Michael Egorov. (https://www.curve.fi/stableswap-paper.pdf)
 *          Derived by mStable and adapted for the needs of an mAsset, as described in MIP-7 (http://mips.mstable.org/MIPS/mip-7)
 *          Calculates and validates the result of Masset operations with respect to the invariant.
 *          This supports low slippage swaps and applies penalties towards min and max regions.
 * @dev     VERSION: 1.0
 *          DATE:    2021-04-23
 */
library MassetLogic {
  using StableMath for uint256;
  using SafeERC20 for IERC20;

  uint256 internal constant A_PRECISION = 100;

  /***************************************
                    MINT
    ****************************************/

  /**
   * @notice Transfers token in, updates internal balances and computes the mAsset output
   * @param _data                 Masset storage state
   * @param _config               Core config for use in the invariant validator
   * @param _input                Data on the bAsset to deposit for the minted mAsset.
   * @param _inputQuantity        Quantity in input token units.
   * @param _minOutputQuantity    Minimum mAsset quantity to be minted. This protects against slippage.
   * @return mintOutput           Quantity of mAsset minted from the deposited bAsset.
   */
  function mint(
    MassetData storage _data,
    InvariantConfig calldata _config,
    Asset calldata _input,
    uint256 _inputQuantity,
    uint256 _minOutputQuantity
  ) external returns (uint256 mintOutput) {
    BassetData[] memory cachedBassetData = _data.bAssetData;
    // Transfer collateral to the platform integration address and call deposit
    uint256 quantityDeposited = _depositTokens(
      _data.bAssetPersonal[_input.idx],
      cachedBassetData[_input.idx].ratio,
      _inputQuantity,
      _getCacheDetails(_data, _config.supply)
    );
    // Validation should be after token transfer, as bAssetQty is unknown before
    mintOutput = computeMint(
      cachedBassetData,
      _input.idx,
      quantityDeposited,
      _config
    );
    require(mintOutput >= _minOutputQuantity, "Mint quantity < min qty");
    // Log the Vault increase - can only be done when basket is healthy
    _data.bAssetData[_input.idx].vaultBalance =
      cachedBassetData[_input.idx].vaultBalance +
      SafeCast.toUint128(quantityDeposited);
  }

  /**
   * @notice Transfers tokens in, updates internal balances and computes the mAsset output.
   * Only fAsset & mAsset are supported in this path.
   * @param _data                 Masset storage state
   * @param _config               Core config for use in the invariant validator
   * @param _indices              Non-duplicate addresses of the bAssets to deposit for the minted mAsset.
   * @param _inputQuantities      Quantity of each input in input token units.
   * @param _minOutputQuantity    Minimum mAsset quantity to be minted. This protects against slippage.
   * @return mintOutput           Quantity of mAsset minted from the deposited bAsset.
   */
  function mintMulti(
    MassetData storage _data,
    InvariantConfig calldata _config,
    uint8[] calldata _indices,
    uint256[] calldata _inputQuantities,
    uint256 _minOutputQuantity
  ) external returns (uint256 mintOutput) {
    uint256 len = _indices.length;
    uint256[] memory quantitiesDeposited = new uint256[](len);
    BassetData[] memory cachedBassetData = _data.bAssetData;
    uint256 maxCache = _getCacheDetails(_data, _config.supply);
    // Transfer the Bassets to the integrator, update storage and calc MassetQ
    for (uint256 i = 0; i < len; i++) {
      if (_inputQuantities[i] > 0) {
        uint8 idx = _indices[i];
        BassetData memory bData = cachedBassetData[idx];
        quantitiesDeposited[i] = _depositTokens(
          _data.bAssetPersonal[idx],
          bData.ratio,
          _inputQuantities[i],
          maxCache
        );

        _data.bAssetData[idx].vaultBalance =
          bData.vaultBalance +
          SafeCast.toUint128(quantitiesDeposited[i]);
      }
    }
    // Validate the proposed mint, after token transfer
    mintOutput = computeMintMulti(
      cachedBassetData,
      _indices,
      quantitiesDeposited,
      _config
    );
    require(mintOutput >= _minOutputQuantity, "Mint quantity < min qty");
    require(mintOutput > 0, "Zero mAsset quantity");
  }

  /***************************************
                    SWAP
    ****************************************/

  /**
   * @notice Swaps two assets - either internally between fAsset<>mAsset, or between fAsset<>mpAsset by
   * first routing through the mAsset pool.
   * @param _data              Masset storage state
   * @param _config            Core config for use in the invariant validator
   * @param _input             Data on bAsset to deposit
   * @param _output            Data on bAsset to withdraw
   * @param _inputQuantity     Units of input bAsset to swap in
   * @param _minOutputQuantity Minimum quantity of the swap output asset. This protects against slippage
   * @param _recipient         Address to transfer output asset to
   * @return swapOutput        Quantity of output asset returned from swap
   * @return scaledFee          Fee paid, in mAsset terms
   */
  function swap(
    MassetData storage _data,
    InvariantConfig calldata _config,
    Asset calldata _input,
    Asset calldata _output,
    uint256 _inputQuantity,
    uint256 _minOutputQuantity,
    address _recipient
  ) external returns (uint256 swapOutput, uint256 scaledFee) {
    BassetData[] memory cachedBassetData = _data.bAssetData;
    // 3. Deposit the input tokens
    uint256 quantityDeposited = _depositTokens(
      _data.bAssetPersonal[_input.idx],
      cachedBassetData[_input.idx].ratio,
      _inputQuantity,
      _getCacheDetails(_data, _config.supply)
    );
    // 3.1. Update the input balance
    _data.bAssetData[_input.idx].vaultBalance =
      cachedBassetData[_input.idx].vaultBalance +
      SafeCast.toUint128(quantityDeposited);

    // 3. Validate the swap
    (swapOutput, scaledFee) = computeSwap(
      cachedBassetData,
      _input.idx,
      _output.idx,
      quantityDeposited,
      _data.swapFee,
      _config
    );
    require(swapOutput >= _minOutputQuantity, "Output qty < minimum qty");
    require(swapOutput > 0, "Zero output quantity");
    //4. Settle the swap
    //4.1. Decrease output bal
    uint256 maxCache = _getCacheDetails(_data, _config.supply);
    _withdrawTokens(
      swapOutput,
      _data.bAssetPersonal[_output.idx],
      cachedBassetData[_output.idx],
      _recipient,
      maxCache
    );
    _data.bAssetData[_output.idx].vaultBalance =
      cachedBassetData[_output.idx].vaultBalance -
      SafeCast.toUint128(swapOutput);
    // Save new surplus to storage
    _data.surplus += scaledFee;
  }

  /***************************************
                    REDEEM
    ****************************************/

  /**
   * @notice Burns a specified quantity of the senders mAsset in return for a bAsset. The output amount is derived
   * from the invariant. Supports redemption into either the fAsset, mAsset or assets in the mAsset basket.
   * @param _data              Masset storage state
   * @param _config            Core config for use in the invariant validator
   * @param _output            Data on bAsset to withdraw
   * @param _inputQuantity   Quantity of mAsset to burn
   * @param _minOutputQuantity Minimum bAsset quantity to receive for the burnt mAsset. This protects against slippage.
   * @param _recipient         Address to transfer the withdrawn bAssets to.
   * @return bAssetQuantity    Quanity of bAsset units received for the burnt mAsset
   * @return scaledFee          Fee paid, in mAsset terms
   */
  function redeem(
    MassetData storage _data,
    InvariantConfig calldata _config,
    Asset calldata _output,
    uint256 _inputQuantity,
    uint256 _minOutputQuantity,
    address _recipient
  ) external returns (uint256 bAssetQuantity, uint256 scaledFee) {
    // Load the bAsset data from storage into memory
    BassetData[] memory cachedBassetData = _data.bAssetData;
    // Calculate redemption quantities
    (bAssetQuantity, scaledFee) = computeRedeem(
      cachedBassetData,
      _output.idx,
      _inputQuantity,
      _config,
      _data.swapFee
    );
    require(bAssetQuantity >= _minOutputQuantity, "bAsset qty < min qty");
    require(bAssetQuantity > 0, "Output == 0");
    // Apply fees, burn mAsset and return bAsset to recipient
    _data.surplus += scaledFee;
    // 2.0. Transfer the Bassets to the recipient
    uint256 maxCache = _getCacheDetails(
      _data,
      _config.supply - _inputQuantity + scaledFee
    );
    _withdrawTokens(
      bAssetQuantity,
      _data.bAssetPersonal[_output.idx],
      cachedBassetData[_output.idx],
      _recipient,
      maxCache
    );
    // 3.0. Set vault balance
    _data.bAssetData[_output.idx].vaultBalance =
      cachedBassetData[_output.idx].vaultBalance -
      SafeCast.toUint128(bAssetQuantity);
  }

  /**
   * @dev Credits a recipient with a proportionate amount of bAssets, relative to current vault
   * balance levels and desired mAsset quantity. Burns the mAsset as payment. Only fAsset & mAsset are supported in this path.
   * @param _data                 Masset storage state
   * @param _config               Core config for use in the invariant validator
   * @param _inputQuantity        Quantity of mAsset to redeem
   * @param _minOutputQuantities  Min units of output to receive
   * @param _recipient            Address to credit the withdrawn bAssets
   * @return scaledFee            Fee collected in mAsset terms
   * @return outputs              Array of output asset addresses
   * @return outputQuantities     Array of output asset quantities
   */
  function redeemProportionately(
    MassetData storage _data,
    InvariantConfig calldata _config,
    uint256 _inputQuantity,
    uint256[] calldata _minOutputQuantities,
    address _recipient
  )
    external
    returns (
      uint256 scaledFee,
      address[] memory outputs,
      uint256[] memory outputQuantities
    )
  {
    // Load the bAsset data from storage into memory
    BassetData[] memory cachedBassetData = _data.bAssetData;

    // Calculate mAsset redemption quantities
    uint256 deductedInput;
    (deductedInput, scaledFee) = _getDeducted(
      cachedBassetData,
      _config,
      _inputQuantity,
      _data.redemptionFee
    );

    _data.surplus += scaledFee;

    // Calc cache and total mAsset circulating
    uint256 maxCache = _getCacheDetails(
      _data,
      _config.supply - _inputQuantity + scaledFee
    );

    uint256 len = cachedBassetData.length;
    outputs = new address[](len);
    outputQuantities = new uint256[](len);
    for (uint256 i = 0; i < len; i++) {
      // Get amount out, proportionate to redemption quantity
      uint256 amountOut = (cachedBassetData[i].vaultBalance * deductedInput) /
        _config.supply;
      require(amountOut > 1, "Output == 0");
      amountOut -= 1;
      require(amountOut >= _minOutputQuantities[i], "bAsset qty < min qty");
      // reduce vaultBalance
      _data.bAssetData[i].vaultBalance =
        cachedBassetData[i].vaultBalance -
        SafeCast.toUint128(amountOut);
      // Set output in array
      BassetPersonal memory personal = _data.bAssetPersonal[i];
      (outputQuantities[i], outputs[i]) = (amountOut, personal.addr);
      // Transfer the bAsset to the recipient
      _withdrawTokens(
        amountOut,
        personal,
        cachedBassetData[i],
        _recipient,
        maxCache
      );
    }
  }

  /** @dev Internal func to get the deducted input to avoid stack depth error */
  function _getDeducted(
    BassetData[] memory _bData,
    InvariantConfig memory _config,
    uint256 _input,
    uint256 _redemptionFee
  ) internal pure returns (uint256 deductedInput, uint256 scaledFee) {
    deductedInput = _input;
    // If supply > k, deduct recolFee
    (uint256 price, ) = computePrice(_bData, _config);
    if (price < 1e18) {
      deductedInput -= ((_input * _config.recolFee) / 1e18);
    }
    scaledFee = deductedInput.mulTruncate(_redemptionFee);
    deductedInput -= scaledFee;
  }

  /**
   * @dev Credits a recipient with a certain quantity of selected bAssets, in exchange for burning the
   *      relative mAsset quantity from the sender. Only fAsset & mAsset (0,1) are supported in this path.
   * @param _data                 Masset storage state
   * @param _config               Core config for use in the invariant validator
   * @param _indices              Indices of the bAssets to receive
   * @param _outputQuantities     Units of the bAssets to receive
   * @param _maxMassetQuantity     Maximum mAsset quantity to burn for the received bAssets. This protects against slippage.
   * @param _recipient            Address to receive the withdrawn bAssets
   * @return mAssetQuantity      Quantity of mAsset units to burn as payment
   * @return fee             Fee collected, in mAsset terms
   */
  function redeemExactBassets(
    MassetData storage _data,
    InvariantConfig memory _config,
    uint8[] calldata _indices,
    uint256[] calldata _outputQuantities,
    uint256 _maxMassetQuantity,
    address _recipient
  ) external returns (uint256 mAssetQuantity, uint256 fee) {
    // Load bAsset data from storage to memory
    BassetData[] memory cachedBassetData = _data.bAssetData;

    (mAssetQuantity, fee) = computeRedeemExact(
      cachedBassetData,
      _indices,
      _outputQuantities,
      _config,
      _data.swapFee
    );
    require(
      mAssetQuantity <= _maxMassetQuantity,
      "Redeem mAsset qty > max quantity"
    );
    // Apply fees, burn mAsset and return bAsset to recipient
    _data.surplus += fee;
    // Transfer the Bassets to the recipient and count fees
    uint256 maxCache = _getCacheDetails(
      _data,
      _config.supply - mAssetQuantity + fee
    );
    for (uint256 i = 0; i < _indices.length; i++) {
      uint8 idx = _indices[i];
      _withdrawTokens(
        _outputQuantities[i],
        _data.bAssetPersonal[idx],
        cachedBassetData[idx],
        _recipient,
        maxCache
      );
      _data.bAssetData[idx].vaultBalance =
        cachedBassetData[idx].vaultBalance -
        SafeCast.toUint128(_outputQuantities[i]);
    }
  }

  /***************************************
                FORGING - INTERNAL
    ****************************************/

  /**
   * @dev Deposits a given asset to the system. If there is sufficient room for the asset
   * in the cache, then just transfer, otherwise reset the cache to the desired mid level by
   * depositing the delta in the platform
   */
  function _depositTokens(
    BassetPersonal memory _bAsset,
    uint256 _bAssetRatio,
    uint256 _quantity,
    uint256 _maxCache
  ) internal returns (uint256 quantityDeposited) {
    // 0. If integration is 0, short circuit
    if (_bAsset.integrator == address(0)) {
      (uint256 received, ) = MassetHelpers.transferReturnBalance(
        msg.sender,
        address(this),
        _bAsset.addr,
        _quantity
      );
      return received;
    }

    // 1 - Send all to PI, using the opportunity to get the cache balance and net amount transferred
    uint256 cacheBal;
    (quantityDeposited, cacheBal) = MassetHelpers.transferReturnBalance(
      msg.sender,
      _bAsset.integrator,
      _bAsset.addr,
      _quantity
    );

    // 2 - Deposit X if necessary
    // 2.1 - Deposit if xfer fees
    if (_bAsset.hasTxFee) {
      uint256 deposited = IPlatformIntegration(_bAsset.integrator).deposit(
        _bAsset.addr,
        quantityDeposited,
        true
      );

      return StableMath.min(deposited, quantityDeposited);
    }
    // 2.2 - Else Deposit X if Cache > %
    // This check is in place to ensure that any token with a txFee is rejected
    require(quantityDeposited == _quantity, "Asset not fully transferred");

    uint256 relativeMaxCache = _maxCache.divRatioPrecisely(_bAssetRatio);

    if (cacheBal > relativeMaxCache) {
      uint256 delta = cacheBal - (relativeMaxCache / 2);
      IPlatformIntegration(_bAsset.integrator).deposit(
        _bAsset.addr,
        delta,
        false
      );
    }
  }

  /**
   * @dev Withdraws a given asset from its platformIntegration. If there is sufficient liquidity
   * in the cache, then withdraw from there, otherwise withdraw from the lending market and reset the
   * cache to the mid level.
   */
  function _withdrawTokens(
    uint256 _quantity,
    BassetPersonal memory _personal,
    BassetData memory _data,
    address _recipient,
    uint256 _maxCache
  ) internal {
    if (_quantity == 0) return;

    // 1.0 If there is no integrator, send from here
    if (_personal.integrator == address(0)) {
      IERC20(_personal.addr).safeTransfer(_recipient, _quantity);
    }
    // 1.1 If txFee then short circuit - there is no cache
    else if (_personal.hasTxFee) {
      IPlatformIntegration(_personal.integrator).withdraw(
        _recipient,
        _personal.addr,
        _quantity,
        _quantity,
        true
      );
    }
    // 1.2. Else, withdraw from either cache or main vault
    else {
      uint256 cacheBal = IERC20(_personal.addr).balanceOf(
        _personal.integrator
      );
      // 2.1 - If balance b in cache, simply withdraw
      if (cacheBal >= _quantity) {
        IPlatformIntegration(_personal.integrator).withdrawRaw(
          _recipient,
          _personal.addr,
          _quantity
        );
      }
      // 2.2 - Else reset the cache to X, or as far as possible
      //       - Withdraw X+b from platform
      //       - Send b to user
      else {
        uint256 relativeMidCache = _maxCache.divRatioPrecisely(_data.ratio) /
          2;
        uint256 totalWithdrawal = StableMath.min(
          relativeMidCache + _quantity - cacheBal,
          _data.vaultBalance - SafeCast.toUint128(cacheBal)
        );

        IPlatformIntegration(_personal.integrator).withdraw(
          _recipient,
          _personal.addr,
          _quantity,
          totalWithdrawal,
          false
        );
      }
    }
  }

  /**
   * @dev Gets the max cache size, given the supply of mAsset
   * @return maxCache    Max units of any given bAsset that should be held in the cache
   */
  function _getCacheDetails(MassetData storage _data, uint256 _supply)
    internal
    view
    returns (uint256 maxCache)
  {
    maxCache = (_supply * _data.cacheSize) / 1e18;
  }

  /***************************************
                    INVARIANT
    ****************************************/

  /**
   * @notice Compute the amount of mAsset received for minting
   * with `quantity` amount of bAsset index `i`.
   * @param _bAssets      Array of all bAsset Data
   * @param _i            Index of bAsset with which to mint
   * @param _rawInput     Raw amount of bAsset to use in mint
   * @param _config       Generalised invariantConfig stored externally
   * @return mintAmount   Quantity of mAssets minted
   */
  function computeMint(
    BassetData[] memory _bAssets,
    uint8 _i,
    uint256 _rawInput,
    InvariantConfig memory _config
  ) public pure returns (uint256 mintAmount) {
    // 1. Get raw reserves
    (uint256[] memory x, uint256 sum) = _getReserves(_bAssets);
    // 2. Get value of reserves according to invariant
    uint256 k0 = _invariant(x, sum, _config.a);
    uint256 scaledInput = (_rawInput * _bAssets[_i].ratio) / 1e8;

    // 3. Add deposit to x and sum
    x[_i] += scaledInput;
    sum += scaledInput;
    // 4. Finalise mint
    require(_inBounds(x, sum, _config.limits), "Exceeds weight limits");
    mintAmount = _computeMintOutput(x, sum, k0, _config);
  }

  /**
   * @notice Compute the amount of mAsset received for minting
   * with the given array of inputs.
   * @param _bAssets      Array of all bAsset Data
   * @param _indices      Indexes of bAssets with which to mint
   * @param _rawInputs    Raw amounts of bAssets to use in mint
   * @param _config       Generalised invariantConfig stored externally
   * @return mintAmount   Quantity of mAssets minted
   */
  function computeMintMulti(
    BassetData[] memory _bAssets,
    uint8[] memory _indices,
    uint256[] memory _rawInputs,
    InvariantConfig memory _config
  ) public pure returns (uint256 mintAmount) {
    // 1. Get raw reserves
    (uint256[] memory x, uint256 sum) = _getReserves(_bAssets);
    // 2. Get value of reserves according to invariant
    uint256 k0 = _invariant(x, sum, _config.a);

    // 3. Add deposits to x and sum
    uint256 len = _indices.length;
    uint8 idx;
    uint256 scaledInput;
    for (uint256 i = 0; i < len; i++) {
      idx = _indices[i];
      scaledInput = (_rawInputs[i] * _bAssets[idx].ratio) / 1e8;
      x[idx] += scaledInput;
      sum += scaledInput;
    }
    // 4. Finalise mint
    require(_inBounds(x, sum, _config.limits), "Exceeds weight limits");
    mintAmount = _computeMintOutput(x, sum, k0, _config);
  }

  /**
   * @notice Compute the amount of bAsset received for swapping
   * `quantity` amount of index `input_idx` to index `output_idx`.
   * @param _bAssets      Array of all bAsset Data
   * @param _i            Index of bAsset to swap IN
   * @param _o            Index of bAsset to swap OUT
   * @param _rawInput     Raw amounts of input bAsset to input
   * @param _feeRate      Swap fee rate to apply to output
   * @param _config       Generalised invariantConfig stored externally
   * @return bAssetOutputQuantity   Raw bAsset output quantity
   * @return scaledSwapFee          Swap fee collected, in mAsset terms
   */
  function computeSwap(
    BassetData[] memory _bAssets,
    uint8 _i,
    uint8 _o,
    uint256 _rawInput,
    uint256 _feeRate,
    InvariantConfig memory _config
  ) public pure returns (uint256 bAssetOutputQuantity, uint256 scaledSwapFee) {
    // 1. Get raw reserves
    (uint256[] memory x, uint256 sum) = _getReserves(_bAssets);
    // 2. Get value of reserves according to invariant
    uint256 k0 = _invariant(x, sum, _config.a);
    // 3. Add deposits to x and sum
    uint256 scaledInput = (_rawInput * _bAssets[_i].ratio) / 1e8;
    x[_i] += scaledInput;
    sum += scaledInput;
    // 4. Calc total mAsset q
    uint256 k2;
    (k2, scaledSwapFee) = _getSwapFee(
      k0,
      _invariant(x, sum, _config.a),
      _feeRate,
      _config
    );
    // 5. Calc output bAsset
    uint256 newOutputReserve = _solveInvariant(x, _config.a, _o, k2);
    require(newOutputReserve < x[_o], "Zero swap output");
    uint256 output = x[_o] - newOutputReserve - 1;
    bAssetOutputQuantity = (output * 1e8) / _bAssets[_o].ratio;
    // 6. Check for bounds
    x[_o] -= output;
    sum -= output;
    require(_inBounds(x, sum, _config.limits), "Exceeds weight limits");
  }

  /** @dev Gets swap fee and scales to avoid stack depth errors in computeSwap */
  function _getSwapFee(
    uint256 _k0,
    uint256 _k1,
    uint256 _feeRate,
    InvariantConfig memory _config
  ) internal pure returns (uint256 k2, uint256 scaledSwapFee) {
    uint256 minted = _k1 - _k0;
    // Under col? Deduct fee
    if (_config.supply > _k0) {
      minted -= ((minted * _config.recolFee) / 1e18);
    }
    // base swap fee
    scaledSwapFee = (minted * _feeRate) / 1e18;
    k2 = _k1 - minted + scaledSwapFee;
    // swap fee in lpToken terms
    scaledSwapFee = (scaledSwapFee * _config.supply) / _k0;
  }

  /**
   * @notice Compute the amount of bAsset index `i` received for
   * redeeming `quantity` amount of mAsset.
   * @param _bAssets              Array of all bAsset Data
   * @param _o                    Index of output bAsset
   * @param _grossMassetQuantity  Net amount of mAsset to redeem
   * @param _config               Generalised invariantConfig stored externally
   * @return rawOutputUnits       Raw bAsset output returned
   */
  function computeRedeem(
    BassetData[] memory _bAssets,
    uint8 _o,
    uint256 _grossMassetQuantity,
    InvariantConfig memory _config,
    uint256 _feeRate
  ) public pure returns (uint256 rawOutputUnits, uint256 scaledFee) {
    // 1. Get raw reserves
    (uint256[] memory x, uint256 sum) = _getReserves(_bAssets);
    // 2. Get value of reserves according to invariant
    uint256 k0 = _invariant(x, sum, _config.a);
    uint256 redemption;
    (redemption, scaledFee) = _getFee(
      _grossMassetQuantity,
      _config,
      _feeRate,
      k0
    );
    uint256 kFinal = (k0 * (_config.supply - redemption)) / _config.supply + 1;
    // 3. Compute bAsset output
    uint256 newOutputReserve = _solveInvariant(x, _config.a, _o, kFinal);
    uint256 output = x[_o] - newOutputReserve - 1;
    rawOutputUnits = (output * 1e8) / _bAssets[_o].ratio;
    // 4. Check for max weight
    x[_o] -= output;
    sum -= output;
    require(_inBounds(x, sum, _config.limits), "Exceeds weight limits");
  }

  function _getFee(
    uint256 _grossMassetQuantity,
    InvariantConfig memory _config,
    uint256 _feeRate,
    uint256 _k0
  ) internal pure returns (uint256 redemption, uint256 scaledFee) {
    redemption = _grossMassetQuantity;
    if (_config.supply > _k0) {
      redemption -= ((redemption * _config.recolFee) / 1e18);
    }
    scaledFee = redemption.mulTruncate(_feeRate);
    redemption -= scaledFee;
  }

  /**
   * @notice Compute the amount of mAsset required to redeem
   * a given selection of bAssets.
   * @param _bAssets          Array of all bAsset Data
   * @param _indices          Indexes of output bAssets
   * @param _rawOutputs       Desired raw bAsset outputs
   * @param _config           Generalised invariantConfig stored externally
   * @return grossMasset      Amount of mAsset required to redeem bAssets
   * @return fee              Fee to subtract from gross
   */
  function computeRedeemExact(
    BassetData[] memory _bAssets,
    uint8[] memory _indices,
    uint256[] memory _rawOutputs,
    InvariantConfig memory _config,
    uint256 _feeRate
  ) public pure returns (uint256 grossMasset, uint256 fee) {
    // 1. Get raw reserves
    (uint256[] memory x, uint256 sum) = _getReserves(_bAssets);
    // 2. Get value of reserves according to invariant
    uint256 k0 = _invariant(x, sum, _config.a);
    // 3. Sub deposits from x and sum
    uint256 len = _indices.length;
    uint256 ratioed;
    for (uint256 i = 0; i < len; i++) {
      ratioed = (_rawOutputs[i] * _bAssets[_indices[i]].ratio) / 1e8;
      x[_indices[i]] -= ratioed;
      sum -= ratioed;
    }
    require(_inBounds(x, sum, _config.limits), "Exceeds weight limits");
    // 4. Get new value of reserves according to invariant
    uint256 k1 = _invariant(x, sum, _config.a);
    // 5. Total mAsset is the difference between values
    uint256 redeemed = (_config.supply * (k0 - k1)) / k0;
    require(redeemed > 1e6, "Must redeem > 1e6 units");
    grossMasset = redeemed.divPrecisely(1e18 - _feeRate);
    fee = grossMasset - redeemed;
    grossMasset += 1;
    if (_config.supply > k0) {
      grossMasset = ((grossMasset * 1e18) / (1e18 - _config.recolFee));
    }
  }

  /**
   * @notice Gets the price of the mAsset, and invariant value k
   * @param _bAssets  Array of all bAsset Data
   * @param _config   Generalised InvariantConfig stored externally
   * @return price    Price of an mAsset
   * @return k        Total value of basket, k
   */
  function computePrice(
    BassetData[] memory _bAssets,
    InvariantConfig memory _config
  ) public pure returns (uint256 price, uint256 k) {
    (uint256[] memory x, uint256 sum) = _getReserves(_bAssets);
    k = _invariant(x, sum, _config.a);
    price = (1e18 * k) / _config.supply;
  }

  /***************************************
                    INTERNAL
    ****************************************/

  /**
   * @dev Computes the actual mint output after adding mint inputs
   * to the vault balances.
   * @param _x            Scaled vaultBalances
   * @param _sum          Sum of vaultBalances, to avoid another loop
   * @param _k            Previous value of invariant, k, before addition
   * @param _config       Generalised InvariantConfig stored externally
   * @return mintAmount   Amount of value added to invariant, in mAsset terms
   */
  function _computeMintOutput(
    uint256[] memory _x,
    uint256 _sum,
    uint256 _k,
    InvariantConfig memory _config
  ) internal pure returns (uint256 mintAmount) {
    // 1. Get value of reserves according to invariant
    uint256 kFinal = _invariant(_x, _sum, _config.a);
    // 2. Total minted is the difference between values, with respect to total supply
    if (_config.supply == 0) {
      mintAmount = kFinal - _k;
    } else {
      mintAmount = (_config.supply * (kFinal - _k)) / _k;
    }
    // 3. Deviation? deduct recolFee of 0.5 bps
    if (_config.supply > _k) {
      mintAmount -= ((mintAmount * _config.recolFee) / 1e18);
    }
  }

  /**
   * @dev Simply scaled raw reserve values and returns the sum
   * @param _bAssets  All bAssets
   * @return x        Scaled vault balances
   * @return sum      Sum of scaled vault balances
   */
  function _getReserves(BassetData[] memory _bAssets)
    internal
    pure
    returns (uint256[] memory x, uint256 sum)
  {
    uint256 len = _bAssets.length;
    x = new uint256[](len);
    uint256 r;
    for (uint256 i = 0; i < len; i++) {
      BassetData memory bAsset = _bAssets[i];
      r = (bAsset.vaultBalance * bAsset.ratio) / 1e8;
      x[i] = r;
      sum += r;
    }
  }

  /**
   * @dev Checks that no bAsset reserves exceed max weight
   * @param _x            Scaled bAsset reserves
   * @param _sum          Sum of x, precomputed
   * @param _limits       Config object containing max and min weights
   * @return inBounds     Bool, true if all assets are within bounds
   */
  function _inBounds(
    uint256[] memory _x,
    uint256 _sum,
    WeightLimits memory _limits
  ) internal pure returns (bool inBounds) {
    uint256 len = _x.length;
    inBounds = true;
    uint256 w;
    for (uint256 i = 0; i < len; i++) {
      w = (_x[i] * 1e18) / _sum;
      if (w > _limits.max || w < _limits.min) return false;
    }
  }

  /***************************************
                    INVARIANT
    ****************************************/

  /**
   * @dev Compute the invariant f(x) for a given array of supplies `x`.
   * @param _x        Scaled vault balances
   * @param _sum      Sum of scaled vault balances
   * @param _a        Precise amplification coefficient
   * @return k        Cumulative value of all assets according to the invariant
   */
  function _invariant(
    uint256[] memory _x,
    uint256 _sum,
    uint256 _a
  ) internal pure returns (uint256 k) {
    uint256 len = _x.length;

    if (_sum == 0) return 0;

    uint256 nA = _a * len;
    uint256 kPrev;
    k = _sum;

    for (uint256 i = 0; i < 256; i++) {
      uint256 kP = k;
      for (uint256 j = 0; j < len; j++) {
        kP = (kP * k) / (_x[j] * len);
      }
      kPrev = k;
      k =
        (((nA * _sum) / A_PRECISION + (kP * len)) * k) /
        (((nA - A_PRECISION) * k) / A_PRECISION + ((len + 1) * kP));
      if (_hasConverged(k, kPrev)) {
        return k;
      }
    }

    revert("Invariant did not converge");
  }

  /**
   * @dev Checks if a given solution has converged within a factor of 1
   * @param _k              Current solution k
   * @param _kPrev          Previous iteration solution
   * @return hasConverged   Bool, true if diff abs(k, kPrev) <= 1
   */
  function _hasConverged(uint256 _k, uint256 _kPrev)
    internal
    pure
    returns (bool)
  {
    if (_kPrev > _k) {
      return (_kPrev - _k) <= 1;
    } else {
      return (_k - _kPrev) <= 1;
    }
  }

  /**
   * @dev Solves the invariant for _i with respect to target K, given an array of reserves.
   * @param _x        Scaled reserve balances
   * @param _a        Precise amplification coefficient
   * @param _idx      Index of asset for which to solve
   * @param _targetK  Target invariant value K
   * @return y        New reserve of _i
   */
  function _solveInvariant(
    uint256[] memory _x,
    uint256 _a,
    uint8 _idx,
    uint256 _targetK
  ) internal pure returns (uint256 y) {
    uint256 len = _x.length;
    require(_idx >= 0 && _idx < len, "Invalid index");

    (uint256 sum_, uint256 nA, uint256 kP) = (0, _a * len, _targetK);

    for (uint256 i = 0; i < len; i++) {
      if (i != _idx) {
        sum_ += _x[i];
        kP = (kP * _targetK) / (_x[i] * len);
      }
    }

    uint256 c = (((kP * _targetK) * A_PRECISION) / nA) / len;
    uint256 g = (_targetK * (nA - A_PRECISION)) / nA;
    uint256 b = 0;

    if (g > sum_) {
      b = g - sum_;
      y = (Root.sqrt((b**2) + (4 * c)) + b) / 2 + 1;
    } else {
      b = sum_ - g;
      y = (Root.sqrt((b**2) + (4 * c)) - b) / 2 + 1;
    }

    if (y < 1e8) revert("Invalid solution");
  }
}
