// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;
pragma abicoder v2;

// Internal
import {Initializable} from "../shared/@openzeppelin-2.5/Initializable.sol";
import {InitializableToken, IERC20} from "../shared/InitializableToken.sol";
import {ImmutableModule} from "../shared/ImmutableModule.sol";
import {InitializableReentrancyGuard} from "../shared/InitializableReentrancyGuard.sol";
import {IMasset} from "../interfaces/IMasset.sol";
import "./MassetStructs.sol";

// Libs
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {StableMath} from "../shared/StableMath.sol";
import {MassetLogic} from "./MassetLogic.sol";
import {MassetManager} from "./MassetManager.sol";

/**
 * @title   Masset
 * @author  mStable
 * @notice  An incentivised constant sum market maker with hard limits at max region. This supports
 *          low slippage swaps and applies penalties towards min and max regions. AMM produces a
 *          stablecoin (mAsset) and redirects lending market interest and swap fees to the savings
 *          contract, producing a second yield bearing asset.
 * @dev     VERSION: 3.0
 *          DATE:    2021-04-22
 */
contract Masset is
  IMasset,
  Initializable,
  InitializableToken,
  ImmutableModule,
  InitializableReentrancyGuard
{
  using StableMath for uint256;

  // Forging Events
  event Minted(
    address indexed minter,
    address recipient,
    uint256 mAssetQuantity,
    address input,
    uint256 inputQuantity
  );
  event MintedMulti(
    address indexed minter,
    address recipient,
    uint256 mAssetQuantity,
    address[] inputs,
    uint256[] inputQuantities
  );
  event Swapped(
    address indexed swapper,
    address input,
    address output,
    uint256 outputAmount,
    uint256 scaledFee,
    address recipient
  );
  event Redeemed(
    address indexed redeemer,
    address recipient,
    uint256 mAssetQuantity,
    address output,
    uint256 outputQuantity,
    uint256 scaledFee
  );
  event RedeemedMulti(
    address indexed redeemer,
    address recipient,
    uint256 mAssetQuantity,
    address[] outputs,
    uint256[] outputQuantity,
    uint256 scaledFee
  );

  // State Events
  event CacheSizeChanged(uint256 cacheSize);
  event FeesChanged(uint256 swapFee, uint256 redemptionFee);
  event WeightLimitsChanged(uint128 min, uint128 max);
  event ForgeValidatorChanged(address forgeValidator);
  event DeficitMinted(uint256 amt);
  event SurplusBurned(address creditor, uint256 amt);

  // Amplification Data
  uint256 private constant MAX_FEE = 1e16;
  uint256 private constant A_PRECISION = 100;
  uint256 private immutable RECOL_FEE;
  // Core data storage
  mapping(address => uint8) public override bAssetIndexes;
  MassetData public data;

  /**
   * @dev Constructor to set immutable bytecode
   * @param _nexus   Nexus address
   */
  constructor(address _nexus, uint256 _recolFee) ImmutableModule(_nexus) {
    require(_recolFee <= 5e13, "RecolFee too high");
    RECOL_FEE = _recolFee;
  }

  /**
   * @dev Initialization function for upgradable proxy contract.
   *      This function should be called via Proxy just after contract deployment.
   *      To avoid variable shadowing appended `Arg` after arguments name.
   * @param _nameArg          Name of the mAsset
   * @param _symbolArg        Symbol of the mAsset
   * @param _bAssets          Array of Basset data
   */
  function initialize(
    string calldata _nameArg,
    string calldata _symbolArg,
    BassetPersonal[] calldata _bAssets,
    BasicConfig memory _config
  ) public initializer {
    InitializableToken._initialize(_nameArg, _symbolArg);

    _initializeReentrancyGuard();

    uint256 len = _bAssets.length;
    require(len > 0, "No bAssets");
    for (uint256 i = 0; i < len; i++) {
      MassetManager.addBasset(
        data.bAssetPersonal,
        data.bAssetData,
        bAssetIndexes,
        _bAssets[i].addr,
        _bAssets[i].integrator,
        1e8,
        _bAssets[i].hasTxFee
      );
    }

    uint64 startA = SafeCast.toUint64(_config.a * A_PRECISION);
    data.ampData = AmpData(startA, startA, 0, 0);
    data.weightLimits = _config.limits;

    data.swapFee = 6e14; // 0.06% or 6 bps
    data.redemptionFee = 3e14; // normally 3e14 0.03% or 3 bps
    data.cacheSize = 1e17; // normally 1e17 (10%)
  }

  /**
   * @dev Verifies that the caller is the Savings Manager contract
   */
  modifier onlySavingsManager() {
    _isSavingsManager();
    _;
  }

  // Internal fn for modifier to reduce deployment size
  function _isSavingsManager() internal view {
    require(_savingsManager() == msg.sender, "Must be savings manager");
  }

  /**
   * @dev Requires the overall basket composition to be healthy
   */
  modifier whenHealthy() {
    _isHealthy();
    _;
  }

  // Internal fn for modifier to reduce deployment size
  function _isHealthy() internal view {
    BasketState memory basket_ = data.basket;
    require(!basket_.undergoingRecol && !basket_.failed, "Unhealthy");
  }

  /**
   * @dev Requires the basket not to be undergoing recollateralisation
   */
  modifier whenNoRecol() {
    _noRecol();
    _;
  }

  // Internal fn for modifier to reduce deployment size
  function _noRecol() internal view {
    BasketState memory basket_ = data.basket;
    require(!basket_.undergoingRecol, "In recol");
  }

  /***************************************
                MINTING (PUBLIC)
    ****************************************/

  /**
   * @dev Mint a single bAsset, at a 1:1 ratio with the bAsset. This contract
   *      must have approval to spend the senders bAsset
   * @param _input             Address of the bAsset to deposit for the minted mAsset.
   * @param _inputQuantity     Quantity in bAsset units
   * @param _minOutputQuantity Minimum mAsset quanity to be minted. This protects against slippage.
   * @param _recipient         Receipient of the newly minted mAsset tokens
   * @return mintOutput        Quantity of newly minted mAssets for the deposited bAsset.
   */
  function mint(
    address _input,
    uint256 _inputQuantity,
    uint256 _minOutputQuantity,
    address _recipient
  ) external override nonReentrant whenHealthy returns (uint256 mintOutput) {
    require(_recipient != address(0), "Invalid recipient");
    require(_inputQuantity > 0, "Qty==0");

    Asset memory input = _getAsset(_input);

    mintOutput = MassetLogic.mint(
      data,
      _getConfig(),
      input,
      _inputQuantity,
      _minOutputQuantity
    );

    // Mint the Masset
    _mint(_recipient, mintOutput);
    emit Minted(msg.sender, _recipient, mintOutput, _input, _inputQuantity);
  }

  /**
   * @dev Mint with multiple bAssets, at a 1:1 ratio to mAsset. This contract
   *      must have approval to spend the senders bAssets
   * @param _inputs            Non-duplicate address array of bASset addresses to deposit for the minted mAsset tokens.
   * @param _inputQuantities   Quantity of each bAsset to deposit for the minted mAsset.
   *                           Order of array should mirror the above bAsset addresses.
   * @param _minOutputQuantity Minimum mAsset quanity to be minted. This protects against slippage.
   * @param _recipient         Address to receive the newly minted mAsset tokens
   * @return mintOutput    Quantity of newly minted mAssets for the deposited bAssets.
   */
  function mintMulti(
    address[] calldata _inputs,
    uint256[] calldata _inputQuantities,
    uint256 _minOutputQuantity,
    address _recipient
  ) external override nonReentrant whenHealthy returns (uint256 mintOutput) {
    require(_recipient != address(0), "Invalid recipient");
    uint256 len = _inputQuantities.length;
    require(len > 0 && len == _inputs.length, "Input array mismatch");

    uint8[] memory indexes = _getAssets(_inputs);
    mintOutput = MassetLogic.mintMulti(
      data,
      _getConfig(),
      indexes,
      _inputQuantities,
      _minOutputQuantity
    );

    // Mint the Masset
    _mint(_recipient, mintOutput);
    emit MintedMulti(
      msg.sender,
      _recipient,
      mintOutput,
      _inputs,
      _inputQuantities
    );
  }

  /**
   * @dev Get the projected output of a given mint
   * @param _input             Address of the bAsset to deposit for the minted mAsset
   * @param _inputQuantity     Quantity in bAsset units
   * @return mintOutput        Estimated mint output in mAsset terms
   */
  function getMintOutput(address _input, uint256 _inputQuantity)
    external
    view
    override
    returns (uint256 mintOutput)
  {
    require(_inputQuantity > 0, "Qty==0");

    Asset memory input = _getAsset(_input);

    mintOutput = MassetLogic.computeMint(
      data.bAssetData,
      input.idx,
      _inputQuantity,
      _getConfig()
    );
  }

  /**
   * @dev Get the projected output of a given mint
   * @param _inputs            Non-duplicate address array of addresses to bAssets to deposit for the minted mAsset tokens.
   * @param _inputQuantities  Quantity of each bAsset to deposit for the minted mAsset.
   * @return mintOutput        Estimated mint output in mAsset terms
   */
  function getMintMultiOutput(
    address[] calldata _inputs,
    uint256[] calldata _inputQuantities
  ) external view override returns (uint256 mintOutput) {
    uint256 len = _inputQuantities.length;
    require(len > 0 && len == _inputs.length, "Input array mismatch");
    uint8[] memory indexes = _getAssets(_inputs);
    return
      MassetLogic.computeMintMulti(
        data.bAssetData,
        indexes,
        _inputQuantities,
        _getConfig()
      );
  }

  /***************************************
                SWAP (PUBLIC)
    ****************************************/

  /**
   * @dev Swaps one bAsset for another bAsset using the bAsset addresses.
   * bAsset <> bAsset swaps will incur a small fee (swapFee()).
   * @param _input             Address of bAsset to deposit
   * @param _output            Address of bAsset to receive
   * @param _inputQuantity     Units of input bAsset to swap
   * @param _minOutputQuantity Minimum quantity of the swap output asset. This protects against slippage
   * @param _recipient         Address to transfer output asset to
   * @return swapOutput        Quantity of output asset returned from swap
   */
  function swap(
    address _input,
    address _output,
    uint256 _inputQuantity,
    uint256 _minOutputQuantity,
    address _recipient
  ) external override nonReentrant whenHealthy returns (uint256 swapOutput) {
    require(_recipient != address(0), "Invalid recipient");
    require(_input != _output, "Invalid pair");
    require(_inputQuantity > 0, "Invalid swap quantity");

    Asset memory input = _getAsset(_input);
    Asset memory output = _getAsset(_output);

    uint256 scaledFee;
    (swapOutput, scaledFee) = MassetLogic.swap(
      data,
      _getConfig(),
      input,
      output,
      _inputQuantity,
      _minOutputQuantity,
      _recipient
    );

    emit Swapped(
      msg.sender,
      input.addr,
      output.addr,
      swapOutput,
      scaledFee,
      _recipient
    );
  }

  /**
   * @dev Determines both if a trade is valid, and the expected fee or output.
   * Swap is valid if it does not result in the input asset exceeding its maximum weight.
   * @param _input             Address of bAsset to deposit
   * @param _output            Address of bAsset to receive
   * @param _inputQuantity     Units of input bAsset to swap
   * @return swapOutput        Quantity of output asset returned from swap
   */
  function getSwapOutput(
    address _input,
    address _output,
    uint256 _inputQuantity
  ) external view override returns (uint256 swapOutput) {
    require(_input != _output, "Invalid pair");
    require(_inputQuantity > 0, "Invalid swap quantity");

    // 1. Load the bAssets from storage
    Asset memory input = _getAsset(_input);
    Asset memory output = _getAsset(_output);

    // 2. If a bAsset swap, calculate the validity, output and fee
    (swapOutput, ) = MassetLogic.computeSwap(
      data.bAssetData,
      input.idx,
      output.idx,
      _inputQuantity,
      data.swapFee,
      _getConfig()
    );
  }

  /***************************************
                REDEMPTION (PUBLIC)
    ****************************************/

  /**
   * @notice Redeems a specified quantity of mAsset in return for a bAsset specified by bAsset address.
   * The bAsset is sent to the specified recipient.
   * The bAsset quantity is relative to current vault balance levels and desired mAsset quantity.
   * The quantity of mAsset is burnt as payment.
   * A minimum quantity of bAsset is specified to protect against price slippage between the mAsset and bAsset.
   * @param _output            Address of the bAsset to receive
   * @param _mAssetQuantity    Quantity of mAsset to redeem
   * @param _minOutputQuantity Minimum bAsset quantity to receive for the burnt mAssets. This protects against slippage.
   * @param _recipient         Address to transfer the withdrawn bAssets to.
   * @return outputQuantity    Quanity of bAsset units received for the burnt mAssets
   */
  function redeem(
    address _output,
    uint256 _mAssetQuantity,
    uint256 _minOutputQuantity,
    address _recipient
  )
    external
    override
    nonReentrant
    whenNoRecol
    returns (uint256 outputQuantity)
  {
    require(_recipient != address(0), "Invalid recipient");
    require(_mAssetQuantity > 0, "Qty==0");

    Asset memory output = _getAsset(_output);

    // Get config before burning. Config > Burn > CacheSize
    InvariantConfig memory config = _getConfig();
    _burn(msg.sender, _mAssetQuantity);

    uint256 scaledFee;
    (outputQuantity, scaledFee) = MassetLogic.redeem(
      data,
      config,
      output,
      _mAssetQuantity,
      _minOutputQuantity,
      _recipient
    );

    emit Redeemed(
      msg.sender,
      _recipient,
      _mAssetQuantity,
      output.addr,
      outputQuantity,
      scaledFee
    );
  }

  /**
   * @dev Credits a recipient with a proportionate amount of bAssets, relative to current vault
   * balance levels and desired mAsset quantity. Burns the mAsset as payment.
   * @param _mAssetQuantity       Quantity of mAsset to redeem
   * @param _minOutputQuantities  Min units of output to receive
   * @param _recipient            Address to credit the withdrawn bAssets
   */
  function redeemMasset(
    uint256 _mAssetQuantity,
    uint256[] calldata _minOutputQuantities,
    address _recipient
  )
    external
    override
    nonReentrant
    whenNoRecol
    returns (uint256[] memory outputQuantities)
  {
    require(_recipient != address(0), "Invalid recipient");
    require(_mAssetQuantity > 0, "Qty==0");

    // Get config before burning. Burn > CacheSize
    InvariantConfig memory config = _getConfig();
    _burn(msg.sender, _mAssetQuantity);

    address[] memory outputs;
    uint256 scaledFee;
    (scaledFee, outputs, outputQuantities) = MassetLogic.redeemProportionately(
      data,
      config,
      _mAssetQuantity,
      _minOutputQuantities,
      _recipient
    );

    emit RedeemedMulti(
      msg.sender,
      _recipient,
      _mAssetQuantity,
      outputs,
      outputQuantities,
      scaledFee
    );
  }

  /**
   * @dev Credits a recipient with a certain quantity of selected bAssets, in exchange for burning the
   *      relative Masset quantity from the sender. Sender also incurs a small fee on the outgoing asset.
   * @param _outputs           Addresses of the bAssets to receive
   * @param _outputQuantities  Units of the bAssets to redeem
   * @param _maxMassetQuantity Maximum mAsset quantity to burn for the received bAssets. This protects against slippage.
   * @param _recipient         Address to receive the withdrawn bAssets
   * @return mAssetQuantity    Quantity of mAsset units burned plus the swap fee to pay for the redeemed bAssets
   */
  function redeemExactBassets(
    address[] calldata _outputs,
    uint256[] calldata _outputQuantities,
    uint256 _maxMassetQuantity,
    address _recipient
  )
    external
    override
    nonReentrant
    whenNoRecol
    returns (uint256 mAssetQuantity)
  {
    require(_recipient != address(0), "Invalid recipient");
    uint256 len = _outputQuantities.length;
    require(len > 0 && len == _outputs.length, "Invalid array input");
    require(_maxMassetQuantity > 0, "Qty==0");

    uint8[] memory indexes = _getAssets(_outputs);

    uint256 fee;
    (mAssetQuantity, fee) = MassetLogic.redeemExactBassets(
      data,
      _getConfig(),
      indexes,
      _outputQuantities,
      _maxMassetQuantity,
      _recipient
    );

    _burn(msg.sender, mAssetQuantity);

    emit RedeemedMulti(
      msg.sender,
      _recipient,
      mAssetQuantity,
      _outputs,
      _outputQuantities,
      fee
    );
  }

  /**
   * @notice Gets the estimated output from a given redeem
   * @param _output            Address of the bAsset to receive
   * @param _mAssetQuantity    Quantity of mAsset to redeem
   * @return bAssetOutput      Estimated quantity of bAsset units received for the burnt mAssets
   */
  function getRedeemOutput(address _output, uint256 _mAssetQuantity)
    external
    view
    override
    returns (uint256 bAssetOutput)
  {
    require(_mAssetQuantity > 0, "Qty==0");

    Asset memory output = _getAsset(_output);

    (bAssetOutput, ) = MassetLogic.computeRedeem(
      data.bAssetData,
      output.idx,
      _mAssetQuantity,
      _getConfig(),
      data.swapFee
    );
  }

  /**
   * @notice Gets the estimated output from a given redeem
   * @param _outputs           Addresses of the bAsset to receive
   * @param _outputQuantities  Quantities of bAsset to redeem
   * @return mAssetQuantity    Estimated quantity of mAsset units needed to burn to receive output
   */
  function getRedeemExactBassetsOutput(
    address[] calldata _outputs,
    uint256[] calldata _outputQuantities
  ) external view override returns (uint256 mAssetQuantity) {
    uint256 len = _outputQuantities.length;
    require(len > 0 && len == _outputs.length, "Invalid array input");

    uint8[] memory indexes = _getAssets(_outputs);

    // calculate the value of mAssets need to cover the value of bAssets being redeemed
    (mAssetQuantity, ) = MassetLogic.computeRedeemExact(
      data.bAssetData,
      indexes,
      _outputQuantities,
      _getConfig(),
      data.swapFee
    );
  }

  /***************************************
                    GETTERS
    ****************************************/

  /**
   * @dev Get basket details for `Masset_MassetStructs.Basket`
   * @return b   Basket struct
   */
  function getBasket() external view override returns (bool, bool) {
    return (data.basket.undergoingRecol, data.basket.failed);
  }

  /**
   * @dev Get data for a all bAssets in basket
   * @return personal  Struct[] with full bAsset data
   * @return bData      Number of bAssets in the Basket
   */
  function getBassets()
    external
    view
    override
    returns (BassetPersonal[] memory personal, BassetData[] memory bData)
  {
    return (data.bAssetPersonal, data.bAssetData);
  }

  /**
   * @dev Get data for a specific bAsset, if it exists
   * @param _bAsset   Address of bAsset
   * @return personal  Struct with full bAsset data
   * @return bData  Struct with full bAsset data
   */
  function getBasset(address _bAsset)
    external
    view
    override
    returns (BassetPersonal memory personal, BassetData memory bData)
  {
    uint8 idx = bAssetIndexes[_bAsset];
    personal = data.bAssetPersonal[idx];
    require(personal.addr == _bAsset, "Invalid asset");
    bData = data.bAssetData[idx];
  }

  /**
   * @dev Gets all config needed for general InvariantValidator calls
   */
  function getConfig() external view returns (InvariantConfig memory config) {
    return _getConfig();
  }

  /**
   * @notice Gets the price of the fpToken, and invariant value k
   * @return price    Price of an fpToken
   * @return k        Total value of basket, k
   */
  function getPrice()
    external
    view
    override
    returns (uint256 price, uint256 k)
  {
    return MassetLogic.computePrice(data.bAssetData, _getConfig());
  }

  /***************************************
                GETTERS - INTERNAL
    ****************************************/

  /**
   * @dev Gets a bAsset from storage
   * @param _asset      Address of the asset
   * @return asset      Struct containing bAsset details (idx, data)
   */
  function _getAsset(address _asset)
    internal
    view
    returns (Asset memory asset)
  {
    asset.idx = bAssetIndexes[_asset];
    asset.addr = _asset;
    asset.exists = data.bAssetPersonal[asset.idx].addr == _asset;
    require(asset.exists, "Invalid asset");
  }

  /**
   * @dev Gets a an array of bAssets from storage and protects against duplicates
   * @param _bAssets    Addresses of the assets
   * @return indexes    Indexes of the assets
   */
  function _getAssets(address[] memory _bAssets)
    internal
    view
    returns (uint8[] memory indexes)
  {
    uint256 len = _bAssets.length;

    indexes = new uint8[](len);

    Asset memory input_;
    for (uint256 i = 0; i < len; i++) {
      input_ = _getAsset(_bAssets[i]);
      indexes[i] = input_.idx;

      for (uint256 j = i + 1; j < len; j++) {
        require(_bAssets[i] != _bAssets[j], "Duplicate asset");
      }
    }
  }

  /**
   * @dev Gets all config needed for general InvariantValidator calls
   */
  function _getConfig() internal view returns (InvariantConfig memory) {
    return
      InvariantConfig(
        totalSupply() + data.surplus,
        _getA(),
        data.weightLimits,
        RECOL_FEE
      );
  }

  /**
   * @dev Gets current amplification var A
   */
  function _getA() internal view returns (uint256) {
    AmpData memory ampData_ = data.ampData;

    uint64 endA = ampData_.targetA;
    uint64 endTime = ampData_.rampEndTime;

    // If still changing, work out based on current timestmap
    if (block.timestamp < endTime) {
      uint64 startA = ampData_.initialA;
      uint64 startTime = ampData_.rampStartTime;

      (uint256 elapsed, uint256 total) = (
        block.timestamp - startTime,
        endTime - startTime
      );

      if (endA > startA) {
        return startA + (((endA - startA) * elapsed) / total);
      } else {
        return startA - (((startA - endA) * elapsed) / total);
      }
    }
    // Else return final value
    else {
      return endA;
    }
  }

  /***************************************
                    YIELD
    ****************************************/

  /**
   * @dev Converts recently accrued swap and redeem fees into mAsset
   * @return mintAmount   mAsset units generated from swap and redeem fees
   * @return newSupply    mAsset total supply after mint
   */
  function collectInterest()
    external
    override
    onlySavingsManager
    returns (uint256 mintAmount, uint256 newSupply)
  {
    // Set the surplus variable to 1 to optimise for SSTORE costs.
    // If setting to 0 here, it would save 5k per savings deposit, but cost 20k for the
    // first surplus call (a SWAP or REDEEM).
    uint256 surplusFees = data.surplus;
    if (surplusFees > 1) {
      mintAmount = surplusFees - 1;
      data.surplus = 1;

      // mint new mAsset to savings manager
      _mint(msg.sender, mintAmount);
      emit MintedMulti(
        address(this),
        msg.sender,
        mintAmount,
        new address[](0),
        new uint256[](0)
      );
    }
    newSupply = totalSupply();
  }

  /**
   * @dev Collects the interest generated from the Basket, minting a relative
   *      amount of mAsset and sends it over to the SavingsMassetManager.
   * @return mintAmount   mAsset units generated from interest collected from lending markets
   * @return newSupply    mAsset total supply after mint
   */
  function collectPlatformInterest()
    external
    override
    onlySavingsManager
    whenHealthy
    nonReentrant
    returns (uint256 mintAmount, uint256 newSupply)
  {
    (uint8[] memory idxs, uint256[] memory gains) = MassetManager
      .collectPlatformInterest(data.bAssetPersonal, data.bAssetData);

    mintAmount = MassetLogic.computeMintMulti(
      data.bAssetData,
      idxs,
      gains,
      _getConfig()
    );

    require(mintAmount > 0, "Must collect something");

    _mint(msg.sender, mintAmount);
    emit MintedMulti(
      address(this),
      msg.sender,
      mintAmount,
      new address[](0),
      gains
    );

    newSupply = totalSupply();
  }

  /***************************************
                    STATE
    ****************************************/

  /**
   * @dev Sets the MAX cache size for each bAsset. The cache will actually revolve around
   *      _cacheSize * totalSupply / 2 under normal circumstances.
   * @param _cacheSize Maximum percent of total mAsset supply to hold for each bAsset
   */
  function setCacheSize(uint256 _cacheSize) external override onlyGovernor {
    require(_cacheSize <= 2e17, "Must be <= 20%");

    data.cacheSize = _cacheSize;

    emit CacheSizeChanged(_cacheSize);
  }

  /**
   * @dev Set the ecosystem fee for sewapping bAssets or redeeming specific bAssets
   * @param _swapFee Fee calculated in (%/100 * 1e18)
   */
  function setFees(uint256 _swapFee, uint256 _redemptionFee)
    external
    override
    onlyGovernor
  {
    require(_swapFee <= MAX_FEE, "Swap rate oob");
    require(_redemptionFee <= MAX_FEE, "Redemption rate oob");

    data.swapFee = _swapFee;
    data.redemptionFee = _redemptionFee;

    emit FeesChanged(_swapFee, _redemptionFee);
  }

  /**
   * @dev Set the maximum weight for a given bAsset
   * @param _min Weight where 100% = 1e18
   * @param _max Weight where 100% = 1e18
   */
  function setWeightLimits(uint128 _min, uint128 _max) external onlyGovernor {
    require(_min <= 1e18 / (data.bAssetData.length * 2), "Min weight oob");
    require(_max >= 1e18 / (data.bAssetData.length - 1), "Max weight oob");

    data.weightLimits = WeightLimits(_min, _max);

    emit WeightLimitsChanged(_min, _max);
  }

  /**
   * @dev Update transfer fee flag for a given bAsset, should it change its fee practice
   * @param _bAsset   bAsset address
   * @param _flag         Charge transfer fee when its set to 'true', otherwise 'false'
   */
  function setTransferFeesFlag(address _bAsset, bool _flag)
    external
    override
    onlyGovernor
  {
    MassetManager.setTransferFeesFlag(
      data.bAssetPersonal,
      bAssetIndexes,
      _bAsset,
      _flag
    );
  }

  /**
   * @dev Transfers all collateral from one lending market to another - used initially
   *      to handle the migration between Aave V1 and Aave V2. Note - only supports non
   *      tx fee enabled assets. Supports going from no integration to integration, but
   *      not the other way around.
   * @param _bAssets Array of basket assets to migrate
   * @param _newIntegration Address of the new platform integration
   */
  function migrateBassets(address[] calldata _bAssets, address _newIntegration)
    external
    override
    onlyGovernor
  {
    MassetManager.migrateBassets(
      data.bAssetPersonal,
      bAssetIndexes,
      _bAssets,
      _newIntegration
    );
  }

  /**
   * @dev Executes the Auto Redistribution event by isolating the bAsset from the Basket
   * @param _bAsset          Address of the ERC20 token to isolate
   * @param _belowPeg        Bool to describe whether the bAsset deviated below peg (t)
   *                         or above (f)
   */
  function handlePegLoss(address _bAsset, bool _belowPeg)
    external
    onlyGovernor
  {
    MassetManager.handlePegLoss(
      data.basket,
      data.bAssetPersonal,
      bAssetIndexes,
      _bAsset,
      _belowPeg
    );
  }

  /**
   * @dev Negates the isolation of a given bAsset
   * @param _bAsset Address of the bAsset
   */
  function negateIsolation(address _bAsset) external onlyGovernor {
    MassetManager.negateIsolation(
      data.basket,
      data.bAssetPersonal,
      bAssetIndexes,
      _bAsset
    );
  }

  /**
   * @dev Starts changing of the amplification var A
   * @param _targetA      Target A value
   * @param _rampEndTime  Time at which A will arrive at _targetA
   */
  function startRampA(uint256 _targetA, uint256 _rampEndTime)
    external
    onlyGovernor
  {
    MassetManager.startRampA(
      data.ampData,
      _targetA,
      _rampEndTime,
      _getA(),
      A_PRECISION
    );
  }

  /**
   * @dev Stops the changing of the amplification var A, setting
   * it to whatever the current value is.
   */
  function stopRampA() external onlyGovernor {
    MassetManager.stopRampA(data.ampData, _getA());
  }

  /**
   * @dev Mints deficit to SAVE if k > token supply
   */
  function mintDeficit() external returns (uint256 mintAmount) {
    require(
      msg.sender == _governor() || msg.sender == _proxyAdmin(),
      "Gov or ProxyAdmin"
    );

    InvariantConfig memory config = _getConfig();
    (, uint256 k) = MassetLogic.computePrice(data.bAssetData, config);
    require(k > config.supply, "No deficit");
    mintAmount = k - config.supply;
    data.surplus += mintAmount;

    emit DeficitMinted(mintAmount);
  }

  /**
   * @dev Burns surplus if token supply > k
   */
  function burnSurplus() external returns (uint256 burnAmount) {
    InvariantConfig memory config = _getConfig();
    (, uint256 k) = MassetLogic.computePrice(data.bAssetData, config);
    require(config.supply > k, "No surplus");
    burnAmount = config.supply - k;

    _burn(msg.sender, burnAmount);

    emit SurplusBurned(msg.sender, burnAmount);
  }
}
