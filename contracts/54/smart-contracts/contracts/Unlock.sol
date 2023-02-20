// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

/**
 * @title The Unlock contract
 * @author Julien Genestoux (unlock-protocol.com)
 * This smart contract has 3 main roles:
 *  1. Distribute discounts to discount token holders
 *  2. Grant dicount tokens to users making referrals and/or publishers granting discounts.
 *  3. Create & deploy Public Lock contracts.
 * In order to achieve these 3 elements, it keeps track of several things such as
 *  a. Deployed locks addresses and balances of discount tokens granted by each lock.
 *  b. The total network product (sum of all key sales, net of discounts)
 *  c. Total of discounts granted
 *  d. Balances of discount tokens, including 'frozen' tokens (which have been used to claim
 * discounts and cannot be used/transferred for a given period)
 *  e. Growth rate of Network Product
 *  f. Growth rate of Discount tokens supply
 * The smart contract has an owner who only can perform the following
 *  - Upgrades
 *  - Change in golden rules (20% of GDP available in discounts, and supply growth rate is at most
 * 50% of GNP growth rate)
 * NOTE: This smart contract is partially implemented for now until enough Locks are deployed and
 * in the wild.
 * The partial implementation includes the following features:
 *  a. Keeping track of deployed locks
 *  b. Keeping track of GNP
 */

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';
import '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';
import 'hardlydifficult-eth/contracts/protocols/Uniswap/IUniswapOracle.sol';
import './utils/UnlockOwnable.sol';
import './interfaces/IPublicLock.sol';
import './interfaces/IMintableERC20.sol';

/// @dev Must list the direct base contracts in the order from “most base-like” to “most derived”.
/// https://solidity.readthedocs.io/en/latest/contracts.html#multiple-inheritance-and-linearization
contract Unlock is
  Initializable,
  UnlockOwnable
{

  /**
   * The struct for a lock
   * We use deployed to keep track of deployments.
   * This is required because both totalSales and yieldedDiscountTokens are 0 when initialized,
   * which would be the same values when the lock is not set.
   */
  struct LockBalances
  {
    bool deployed;
    uint totalSales; // This is in wei
    uint yieldedDiscountTokens;
  }

  modifier onlyFromDeployedLock() {
    require(locks[msg.sender].deployed, 'ONLY_LOCKS');
    _;
  }

  uint public grossNetworkProduct;

  uint public totalDiscountGranted;

  // We keep track of deployed locks to ensure that callers are all deployed locks.
  mapping (address => LockBalances) public locks;

  // global base token URI
  // Used by locks where the owner has not set a custom base URI.
  string public globalBaseTokenURI;

  // global base token symbol
  // Used by locks where the owner has not set a custom symbol
  string public globalTokenSymbol;

  // The address of the latest public lock template, used by default when `createLock` is called
  address public publicLockAddress;

  // Map token address to oracle contract address if the token is supported
  // Used for GDP calculations
  mapping (address => IUniswapOracle) public uniswapOracles;

  // The WETH token address, used for value calculations
  address public weth;

  // The UDT token address, used to mint tokens on referral
  address public udt;

  // The approx amount of gas required to purchase a key
  uint public estimatedGasForPurchase;

  // Blockchain ID the network id on which this version of Unlock is operating
  uint public chainId;

  // store proxy admin
  address public proxyAdminAddress;
  ProxyAdmin private proxyAdmin;

  // publicLock templates
  mapping(address => uint16) private _publicLockVersions;
  mapping(uint16 => address) private _publicLockImpls;
  uint16 public publicLockLatestVersion;

  // Events
  event NewLock(
    address indexed lockOwner,
    address indexed newLockAddress
  );

  event LockUpgraded(
    address lockAddress,
    uint16 version
  );

  event ConfigUnlock(
    address udt,
    address weth,
    uint estimatedGasForPurchase,
    string globalTokenSymbol,
    string globalTokenURI,
    uint chainId
  );

  event SetLockTemplate(
    address publicLockAddress
  );

  event ResetTrackedValue(
    uint grossNetworkProduct,
    uint totalDiscountGranted
  );

  event UnlockTemplateAdded(
    address indexed impl,
    uint16 indexed version
  );

  // Use initialize instead of a constructor to support proxies (for upgradeability via OZ).
  function initialize(
    address _unlockOwner
  )
    public
    initializer()
  {
    // We must manually initialize Ownable
    UnlockOwnable.__initializeOwnable(_unlockOwner);
    // add a proxy admin on deployment
    _deployProxyAdmin();
  }

  function initializeProxyAdmin() public {
    require(proxyAdminAddress == address(0), "ProxyAdmin already deployed");
    _deployProxyAdmin();
  }

  /**
  * @dev Deploy the ProxyAdmin contract that will manage lock templates upgrades
  * This deploys an instance of ProxyAdmin used by PublicLock transparent proxies.
  */
  function _deployProxyAdmin() private returns(address) {
    proxyAdmin = new ProxyAdmin();
    proxyAdminAddress = address(proxyAdmin);
    return address(proxyAdmin);
  }

  /**
  * @dev Helper to get the version number of a template from his address
  */
  function publicLockVersions(address _impl) external view returns(uint16) {
    return _publicLockVersions[_impl];
  }

  /**
  * @dev Helper to get the address of a template based on its version number
  */
  function publicLockImpls(uint16 _version) external view returns(address) {
    return _publicLockImpls[_version];
  }

  /**
  * @dev Registers a new PublicLock template immplementation
  * The template is identified by a version number
  * Once registered, the template can be used to upgrade an existing Lock
  */
  function addLockTemplate(address impl, uint16 version) public onlyOwner {
    _publicLockVersions[impl] = version;
    _publicLockImpls[version] = impl;
    if (publicLockLatestVersion < version) publicLockLatestVersion = version;

    emit UnlockTemplateAdded(impl, version);
  }

  /**
  * @notice Create lock
  * This deploys a lock for a creator. It also keeps track of the deployed lock.
  * @param data bytes containing the call to initialize the lock template
  * @dev this call is passed as encoded function - for instance:
  *  bytes memory data = abi.encodeWithSignature(
  *    'initialize(address,uint256,address,uint256,uint256,string)',
  *    msg.sender,
  *    _expirationDuration,
  *    _tokenAddress,
  *    _keyPrice,
  *    _maxNumberOfKeys,
  *    _lockName
  *  );
  * @return address of the create lock
  */
  function createLock(
    bytes memory data
  ) public returns(address)
  {
    require(proxyAdminAddress != address(0), "proxyAdmin is not set");
    require(publicLockAddress != address(0), 'MISSING_LOCK_TEMPLATE');

    // deploy a proxy pointing to impl
    TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(publicLockAddress, proxyAdminAddress, data);
    address payable newLock = payable(address(proxy));

    // assign the new Lock
    locks[newLock] = LockBalances({
      deployed: true, totalSales: 0, yieldedDiscountTokens: 0
    });

    // trigger event
    emit NewLock(msg.sender, newLock);
    return newLock;
  }

  /**
   * @dev Upgrade a Lock template implementation
   * @param lockAddress the address of the lock to be upgraded
   * @param version the version number of the template
   */
  function upgradeLock(address payable lockAddress, uint16 version) public returns(address) {
    require(proxyAdminAddress != address(0), "proxyAdmin is not set");

    // check perms
    require(_isLockManager(lockAddress, msg.sender) == true, "caller is not a manager of this lock");

    // check version
    IPublicLock lock = IPublicLock(lockAddress);
    uint16 currentVersion = lock.publicLockVersion();
    require( version == currentVersion + 1, 'version error: only +1 increments are allowed');

    // make our upgrade
    address impl = _publicLockImpls[version];
    TransparentUpgradeableProxy proxy = TransparentUpgradeableProxy(lockAddress);
    proxyAdmin.upgrade(proxy, impl);

    emit LockUpgraded(lockAddress, version);
    return lockAddress;
  }

  function _isLockManager(address lockAddress, address _sender) private view returns(bool isManager) {
    IPublicLock lock = IPublicLock(lockAddress);
    return lock.isLockManager(_sender);
  }

  /**
   * This function returns the discount available for a user, when purchasing a
   * a key from a lock.
   * This does not modify the state. It returns both the discount and the number of tokens
   * consumed to grant that discount.
   * TODO: actually implement this.
   */
  function computeAvailableDiscountFor(
    address /* _purchaser */,
    uint /* _keyPrice */
  )
    public
    pure
    returns (uint discount, uint tokens)
  {
    // TODO: implement me
    return (0, 0);
  }

  /**
   * This function keeps track of the added GDP, as well as grants of discount tokens
   * to the referrer, if applicable.
   * The number of discount tokens granted is based on the value of the referal,
   * the current growth rate and the lock's discount token distribution rate
   * This function is invoked by a previously deployed lock only.
   * TODO: actually implement
   */
  function recordKeyPurchase(
    uint _value,
    address _referrer
  )
    public
    onlyFromDeployedLock()
  {
    if(_value > 0) {
      uint valueInETH;
      address tokenAddress = IPublicLock(msg.sender).tokenAddress();
      if(tokenAddress != address(0) && tokenAddress != weth) {
        // If priced in an ERC-20 token, find the supported uniswap oracle
        IUniswapOracle oracle = uniswapOracles[tokenAddress];
        if(address(oracle) != address(0)) {
          valueInETH = oracle.updateAndConsult(tokenAddress, _value, weth);
        }
      }
      else {
        // If priced in ETH (or value is 0), no conversion is required
        valueInETH = _value;
      }

      grossNetworkProduct = grossNetworkProduct + valueInETH;
      // If GNP does not overflow, the lock totalSales should be safe
      locks[msg.sender].totalSales += valueInETH;

      // Mint UDT
      if(_referrer != address(0))
      {
        IUniswapOracle udtOracle = uniswapOracles[udt];
        if(address(udtOracle) != address(0))
        {
          // Get the value of 1 UDT (w/ 18 decimals) in ETH
          uint udtPrice = udtOracle.updateAndConsult(udt, 10 ** 18, weth);

          // tokensToDistribute is either == to the gas cost times 1.25 to cover the 20% dev cut
          uint tokensToDistribute = (estimatedGasForPurchase * tx.gasprice) * (125 * 10 ** 18) / 100 / udtPrice;

          // or tokensToDistribute is capped by network GDP growth
          uint maxTokens = 0;
          if (chainId > 1)
          {
            // non mainnet: we distribute tokens using asymptotic curve between 0 and 0.5
            // maxTokens = IMintableERC20(udt).balanceOf(address(this)).mul((valueInETH / grossNetworkProduct) / (2 + 2 * valueInETH / grossNetworkProduct));
            maxTokens = IMintableERC20(udt).balanceOf(address(this)) * valueInETH / (2 + 2 * valueInETH / grossNetworkProduct) / grossNetworkProduct;
          } else {
            // Mainnet: we mint new token using log curve
            maxTokens = IMintableERC20(udt).totalSupply() * valueInETH / 2 / grossNetworkProduct;
          }

          // cap to GDP growth!
          if(tokensToDistribute > maxTokens)
          {
            tokensToDistribute = maxTokens;
          }

          if(tokensToDistribute > 0)
          {
            // 80% goes to the referrer, 20% to the Unlock dev - round in favor of the referrer
            uint devReward = tokensToDistribute * 20 / 100;
            if (chainId > 1)
            {
              uint balance = IMintableERC20(udt).balanceOf(address(this));
              if (balance > tokensToDistribute) {
                // Only distribute if there are enough tokens
                IMintableERC20(udt).transfer(_referrer, tokensToDistribute - devReward);
                IMintableERC20(udt).transfer(owner(), devReward);
              }
            } else {
              // No distribnution
              IMintableERC20(udt).mint(_referrer, tokensToDistribute - devReward);
              IMintableERC20(udt).mint(owner(), devReward);
            }
          }
        }
      }
    }
  }

  /**
   * This function will keep track of consumed discounts by a given user.
   * It will also grant discount tokens to the creator who is granting the discount based on the
   * amount of discount and compensation rate.
   * This function is invoked by a previously deployed lock only.
   */
  function recordConsumedDiscount(
    uint _discount,
    uint /* _tokens */
  )
    public
    onlyFromDeployedLock()
  {
    // TODO: implement me
    totalDiscountGranted += _discount;
    return;
  }

  // The version number of the current Unlock implementation on this network
  function unlockVersion(
  ) external pure
    returns (uint16)
  {
    return 10;
  }

  /**
   * @notice Allows the owner to update configuration variables
   */
  function configUnlock(
    address _udt,
    address _weth,
    uint _estimatedGasForPurchase,
    string calldata _symbol,
    string calldata _URI,
    uint _chainId
  ) external
    onlyOwner
  {
    udt = _udt;
    weth = _weth;
    estimatedGasForPurchase = _estimatedGasForPurchase;

    globalTokenSymbol = _symbol;
    globalBaseTokenURI = _URI;

    chainId = _chainId;

    emit ConfigUnlock(_udt, _weth, _estimatedGasForPurchase, _symbol, _URI, _chainId);
  }

  /**
   * @notice Upgrade the PublicLock template used for future calls to `createLock`.
   * @dev This will initialize the template and revokeOwnership.
   */
  function setLockTemplate(
    address _publicLockAddress
  ) external
    onlyOwner
  {
    // First claim the template so that no-one else could
    // this will revert if the template was already initialized.
    IPublicLock(_publicLockAddress).initialize(
      address(this), 0, address(0), 0, 0, ''
    );
    IPublicLock(_publicLockAddress).renounceLockManager();

    publicLockAddress = _publicLockAddress;

    emit SetLockTemplate(_publicLockAddress);
  }

  /**
   * @notice allows the owner to set the oracle address to use for value conversions
   * setting the _oracleAddress to address(0) removes support for the token
   * @dev This will also call update to ensure at least one datapoint has been recorded.
   */
  function setOracle(
    address _tokenAddress,
    address _oracleAddress
  ) external
    onlyOwner
  {
    uniswapOracles[_tokenAddress] = IUniswapOracle(_oracleAddress);
    if(_oracleAddress != address(0)) {
      IUniswapOracle(_oracleAddress).update(_tokenAddress, weth);
    }
  }

  // Allows the owner to change the value tracking variables as needed.
  function resetTrackedValue(
    uint _grossNetworkProduct,
    uint _totalDiscountGranted
  ) external
    onlyOwner
  {
    grossNetworkProduct = _grossNetworkProduct;
    totalDiscountGranted = _totalDiscountGranted;

    emit ResetTrackedValue(_grossNetworkProduct, _totalDiscountGranted);
  }

  /**
   * @dev Redundant with globalBaseTokenURI() for backwards compatibility with v3 & v4 locks.
   */
  function getGlobalBaseTokenURI()
    external
    view
    returns (string memory)
  {
    return globalBaseTokenURI;
  }

  /**
   * @dev Redundant with globalTokenSymbol() for backwards compatibility with v3 & v4 locks.
   */
  function getGlobalTokenSymbol()
    external
    view
    returns (string memory)
  {
    return globalTokenSymbol;
  }
}
