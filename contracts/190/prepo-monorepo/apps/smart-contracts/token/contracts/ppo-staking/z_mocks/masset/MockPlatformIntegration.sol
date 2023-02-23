// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.7;

// Internal
import {IPlatformIntegration} from "../../interfaces/IPlatformIntegration.sol";
import {ImmutableModule} from "../../shared/ImmutableModule.sol";
import {IAaveATokenV2, IAaveLendingPoolV2, ILendingPoolAddressesProviderV2} from "../../peripheral/Aave/IAave.sol";

// Libs
import {MassetHelpers} from "../../shared/MassetHelpers.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockPlatformIntegration is IPlatformIntegration, ImmutableModule {
  using SafeERC20 for IERC20;

  event PTokenAdded(address indexed _bAsset, address _pToken);
  event Whitelisted(address indexed _address);

  event Deposit(address indexed _bAsset, address _pToken, uint256 _amount);
  event Withdrawal(address indexed _bAsset, address _pToken, uint256 _amount);
  event PlatformWithdrawal(
    address indexed bAsset,
    address pToken,
    uint256 totalAmount,
    uint256 userAmount
  );

  // Core address for the given platform */
  address public platformAddress;

  // bAsset => pToken (Platform Specific Token Address)
  mapping(address => address) public bAssetToPToken;
  // Full list of all bAssets supported here
  address[] internal bAssetsMapped;

  mapping(address => bool) public whitelist;

  /**
   * @dev Modifier to allow function calls only from the whitelisted address.
   */
  modifier onlyWhitelisted() {
    require(whitelist[msg.sender], "Not a whitelisted address");
    _;
  }

  constructor(
    address _nexus,
    address _platformAddress,
    address[] memory _bAssets,
    address[] memory _pTokens
  ) ImmutableModule(_nexus) {
    platformAddress = _platformAddress;

    uint256 bAssetCount = _bAssets.length;
    require(bAssetCount == _pTokens.length, "Invalid input arrays");
    for (uint256 i = 0; i < bAssetCount; i++) {
      _setPTokenAddress(_bAssets[i], _pTokens[i]);
    }
  }

  function addWhitelist(address[] memory _whitelisted) external {
    require(_whitelisted.length > 0, "Empty whitelist array");

    for (uint256 i = 0; i < _whitelisted.length; i++) {
      _addWhitelist(_whitelisted[i]);
    }
  }

  /**
   * @dev Adds a new whitelist address
   * @param _address Address to add in whitelist
   */
  function _addWhitelist(address _address) internal {
    require(_address != address(0), "Address is zero");
    require(!whitelist[_address], "Already whitelisted");

    whitelist[_address] = true;

    emit Whitelisted(_address);
  }

  /***************************************
                    CONFIG
    ****************************************/

  /**
   * @dev Provide support for bAsset by passing its pToken address.
   * This method can only be called by the system Governor
   * @param _bAsset   Address for the bAsset
   * @param _pToken   Address for the corresponding platform token
   */
  function setPTokenAddress(address _bAsset, address _pToken)
    external
    onlyGovernor
  {
    _setPTokenAddress(_bAsset, _pToken);
  }

  function _setPTokenAddress(address _bAsset, address _pToken) internal {
    require(bAssetToPToken[_bAsset] == address(0), "pToken already set");
    require(
      _bAsset != address(0) && _pToken != address(0),
      "Invalid addresses"
    );

    bAssetToPToken[_bAsset] = _pToken;
    bAssetsMapped.push(_bAsset);

    emit PTokenAdded(_bAsset, _pToken);

    _abstractSetPToken(_bAsset, _pToken);
  }

  /***************************************
                    CORE
    ****************************************/

  /**
   * @dev Deposit a quantity of bAsset into the platform. Credited aTokens
   *      remain here in the vault. Can only be called by whitelisted addresses
   *      (mAsset and corresponding BasketManager)
   * @param _bAsset              Address for the bAsset
   * @param _amount              Units of bAsset to deposit
   * @param _hasTxFee            Is the bAsset known to have a tx fee?
   * @return quantityDeposited   Quantity of bAsset that entered the platform
   */
  function deposit(
    address _bAsset,
    uint256 _amount,
    bool _hasTxFee
  ) external override onlyWhitelisted returns (uint256 quantityDeposited) {
    require(_amount > 0, "Must deposit something");

    IAaveATokenV2 aToken = _getATokenFor(_bAsset);

    quantityDeposited = _amount;

    if (_hasTxFee) {
      // If we charge a fee, account for it
      uint256 prevBal = _checkBalance(aToken);
      _getLendingPool().deposit(_bAsset, _amount, address(this), 36);
      uint256 newBal = _checkBalance(aToken);
      quantityDeposited = _min(quantityDeposited, newBal - prevBal);
    } else {
      _getLendingPool().deposit(_bAsset, _amount, address(this), 36);
    }

    emit Deposit(_bAsset, address(aToken), quantityDeposited);
  }

  /**
   * @dev Withdraw a quantity of bAsset from the platform
   * @param _receiver     Address to which the bAsset should be sent
   * @param _bAsset       Address of the bAsset
   * @param _amount       Units of bAsset to withdraw
   * @param _hasTxFee     Is the bAsset known to have a tx fee?
   */
  function withdraw(
    address _receiver,
    address _bAsset,
    uint256 _amount,
    bool _hasTxFee
  ) external override onlyWhitelisted {
    _withdraw(_receiver, _bAsset, _amount, _amount, _hasTxFee);
  }

  /**
   * @dev Withdraw a quantity of bAsset from the platform
   * @param _receiver     Address to which the bAsset should be sent
   * @param _bAsset       Address of the bAsset
   * @param _amount       Units of bAsset to send to recipient
   * @param _totalAmount  Total units to pull from lending platform
   * @param _hasTxFee     Is the bAsset known to have a tx fee?
   */
  function withdraw(
    address _receiver,
    address _bAsset,
    uint256 _amount,
    uint256 _totalAmount,
    bool _hasTxFee
  ) external override onlyWhitelisted {
    _withdraw(_receiver, _bAsset, _amount, _totalAmount, _hasTxFee);
  }

  /** @dev Withdraws _totalAmount from the lending pool, sending _amount to user */
  function _withdraw(
    address _receiver,
    address _bAsset,
    uint256 _amount,
    uint256 _totalAmount,
    bool _hasTxFee
  ) internal {
    require(_totalAmount > 0, "Must withdraw something");

    IAaveATokenV2 aToken = _getATokenFor(_bAsset);

    if (_hasTxFee) {
      require(_amount == _totalAmount, "Cache inactive for assets with fee");
      _getLendingPool().withdraw(_bAsset, _amount, _receiver);
    } else {
      _getLendingPool().withdraw(_bAsset, _totalAmount, address(this));
      // Send redeemed bAsset to the receiver
      IERC20(_bAsset).safeTransfer(_receiver, _amount);
    }

    emit PlatformWithdrawal(_bAsset, address(aToken), _totalAmount, _amount);
  }

  /**
   * @dev Withdraw a quantity of bAsset from the cache.
   * @param _receiver     Address to which the bAsset should be sent
   * @param _bAsset       Address of the bAsset
   * @param _amount       Units of bAsset to withdraw
   */
  function withdrawRaw(
    address _receiver,
    address _bAsset,
    uint256 _amount
  ) external override onlyWhitelisted {
    require(_amount > 0, "Must withdraw something");
    require(_receiver != address(0), "Must specify recipient");

    // Send redeemed bAsset to the receiver
    IERC20(_bAsset).safeTransfer(_receiver, _amount);

    emit Withdrawal(_bAsset, address(0), _amount);
  }

  /**
   * @dev Get the total bAsset value held in the platform
   *      This includes any interest that was generated since depositing
   *      Aave gradually increases the balances of all aToken holders, as the interest grows
   * @param _bAsset     Address of the bAsset
   * @return balance    Total value of the bAsset in the platform
   */
  function checkBalance(address _bAsset)
    external
    view
    override
    returns (uint256 balance)
  {
    // balance is always with token aToken decimals
    IAaveATokenV2 aToken = _getATokenFor(_bAsset);
    return _checkBalance(aToken);
  }

  /***************************************
                    APPROVALS
    ****************************************/

  /**
   * @dev Re-approve the spending of all bAssets by the Aave lending pool core,
   *      if for some reason is it necessary for example if the address of core changes.
   *      Only callable through Governance.
   */
  function reApproveAllTokens() external onlyGovernor {
    uint256 bAssetCount = bAssetsMapped.length;
    address lendingPoolVault = address(_getLendingPool());
    // approve the pool to spend the bAsset
    for (uint256 i = 0; i < bAssetCount; i++) {
      MassetHelpers.safeInfiniteApprove(bAssetsMapped[i], lendingPoolVault);
    }
  }

  /**
   * @dev Internal method to respond to the addition of new bAsset / pTokens
   *      We need to approve the Aave lending pool core conrtact and give it permission
   *      to spend the bAsset
   * @param _bAsset Address of the bAsset to approve
   */
  function _abstractSetPToken(
    address _bAsset,
    address /*_pToken*/
  ) internal {
    address lendingPool = address(_getLendingPool());
    // approve the pool to spend the bAsset
    MassetHelpers.safeInfiniteApprove(_bAsset, lendingPool);
  }

  /***************************************
                    HELPERS
    ****************************************/

  /**
   * @dev Get the current address of the Aave lending pool, which is the gateway to
   *      depositing.
   * @return Current lending pool implementation
   */
  function _getLendingPool() internal view returns (IAaveLendingPoolV2) {
    address lendingPool = ILendingPoolAddressesProviderV2(platformAddress)
      .getLendingPool();
    require(lendingPool != address(0), "Lending pool does not exist");
    return IAaveLendingPoolV2(lendingPool);
  }

  /**
   * @dev Get the pToken wrapped in the IAaveAToken interface for this bAsset, to use
   *      for withdrawing or balance checking. Fails if the pToken doesn't exist in our mappings.
   * @param _bAsset  Address of the bAsset
   * @return aToken  Corresponding to this bAsset
   */
  function _getATokenFor(address _bAsset)
    internal
    view
    returns (IAaveATokenV2)
  {
    address aToken = bAssetToPToken[_bAsset];
    require(aToken != address(0), "aToken does not exist");
    return IAaveATokenV2(aToken);
  }

  /**
   * @dev Get the total bAsset value held in the platform
   * @param _aToken     aToken for which to check balance
   * @return balance    Total value of the bAsset in the platform
   */
  function _checkBalance(IAaveATokenV2 _aToken)
    internal
    view
    returns (uint256 balance)
  {
    return _aToken.balanceOf(address(this));
  }

  /***************************************
                    HELPERS
    ****************************************/

  /**
   * @dev Simple helper func to get the min of two values
   */
  function _min(uint256 x, uint256 y) internal pure returns (uint256) {
    return x > y ? y : x;
  }
}
