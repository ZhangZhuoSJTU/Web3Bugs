// SPDX-License-Identifier: UNLICENSED

// TODO update to 0.8.4 (or whatever latest is...)

// NOTE the pattern [underlying, maturity*, cToken, ...]

pragma solidity 0.8.4;

import './Abstracts.sol';
import './ZcToken.sol';
import './VaultTracker.sol';

contract MarketPlace {
  struct Market {
    address cTokenAddr;
    address zcTokenAddr;
    address vaultAddr;
  }

  mapping (address => mapping (uint256 => Market)) public markets;
  mapping (address => mapping (uint256 => bool)) public mature;
  mapping (address => mapping (uint256 => uint256)) public maturityRate;

  address public immutable admin;
  address public swivel;

  event Create(address indexed underlying, uint256 indexed maturity, address cToken, address zcToken, address vaultTracker);
  event Mature(address indexed underlying, uint256 indexed maturity, uint256 maturityRate, uint256 matured);
  event RedeemZcToken(address indexed underlying, uint256 indexed maturity, address indexed sender, uint256 amount);
  event RedeemVaultInterest(address indexed underlying, uint256 indexed maturity, address indexed sender);
  event CustodialInitiate(address indexed underlying, uint256 indexed maturity, address zcTarget, address nTarget, uint256 amount);
  event CustodialExit(address indexed underlying, uint256 indexed maturity, address zcTarget, address nTarget, uint256 amount);
  event P2pZcTokenExchange(address indexed underlying, uint256 indexed maturity, address from, address to, uint256 amount);
  event P2pVaultExchange(address indexed underlying, uint256 indexed maturity, address from, address to, uint256 amount);
  event TransferVaultNotional(address indexed underlying, uint256 indexed maturity, address from, address to, uint256 amount);

  constructor() {
    admin = msg.sender;
  }

  /// @param s Address of the deployed swivel contract
  function setSwivelAddress(address s) external onlyAdmin(admin) returns (bool) {
    swivel = s;
    return true;
  }

  /// @notice Allows the owner to create new markets
  /// @param u Underlying token address associated with the new market
  /// @param m Maturity timestamp of the new market
  /// @param c cToken address associated with underlying for the new market
  /// @param n Name of the new zcToken market
  /// @param s Symbol of the new zcToken market
  function createMarket(
    address u,
    uint256 m,
    address c,
    string memory n,
    string memory s,
    uint8 d
  ) public onlyAdmin(admin) returns (bool) {
    require(swivel != address(0), 'swivel contract address not set');
    // TODO can we live with the factory pattern here both bytecode size wise and CREATE opcode cost wise?
    address zctAddr = address(new ZcToken(u, m, n, s, d));
    address vAddr = address(new VaultTracker(m, c, swivel));
    markets[u][m] = Market(c, zctAddr, vAddr);

    emit Create(u, m, c, zctAddr, vAddr);

    return true;
  }

  /// @notice Can be called after maturity, allowing all of the zcTokens to earn floating interest on Compound until they release their funds
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  function matureMarket(address u, uint256 m) public returns (bool) {
    require(!mature[u][m], 'market already matured');
    require(block.timestamp >= ZcToken(markets[u][m].zcTokenAddr).maturity(), "maturity not reached");

    // set the base maturity cToken exchange rate at maturity to the current cToken exchange rate
    uint256 currentExchangeRate = CErc20(markets[u][m].cTokenAddr).exchangeRateCurrent();
    maturityRate[u][m] = currentExchangeRate;
    // set the maturity state to true (for zcb market)
    mature[u][m] = true;

    // set vault "matured" to true
    require(VaultTracker(markets[u][m].vaultAddr).matureVault(), 'maturity not reached');

    emit Mature(u, m, block.timestamp, currentExchangeRate);

    return true;
  }

  /// @notice Allows Swivel caller to deposit their underlying, in the process splitting it - minting both zcTokens and vault notional.
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param t Address of the depositing user
  /// @param a Amount of notional being added
  function mintZcTokenAddingNotional(address u, uint256 m, address t, uint256 a) external onlySwivel(swivel) returns (bool) {
    require(ZcToken(markets[u][m].zcTokenAddr).mint(t, a), 'mint zcToken failed');
    require(VaultTracker(markets[u][m].vaultAddr).addNotional(t, a), 'add notional failed');
    
    return true;
  }

  /// @notice Allows Swivel caller to deposit/burn both zcTokens + vault notional. This process is "combining" the two and redeeming underlying.
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param t Address of the combining/redeeming user
  /// @param a Amount of zcTokens being burned
  function burnZcTokenRemovingNotional(address u, uint256 m, address t, uint256 a) external onlySwivel(swivel) returns(bool) {
    require(ZcToken(markets[u][m].zcTokenAddr).burn(t, a), 'burn failed');
    require(VaultTracker(markets[u][m].vaultAddr).removeNotional(t, a), 'remove notional failed');
    
    return true;
  }

  /// @notice Allows (via swivel) zcToken holders to redeem their tokens for underlying tokens after maturity has been reached.
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param t Address of the redeeming user
  /// @param a Amount of zcTokens being redeemed
  function redeemZcToken(address u, uint256 m, address t, uint256 a) external onlySwivel(swivel) returns (uint256) {
    Market memory mkt = markets[u][m];
    bool matured = mature[u][m];

    if (!matured) {
      require(matureMarket(u, m), 'failed to mature the market');
    }

    // burn user's zcTokens
    require(ZcToken(mkt.zcTokenAddr).burn(t, a), 'could not burn');

    emit RedeemZcToken(u, m, t, a);

    if (!matured) {
      return a;
    } else { 
      // if the market was already mature the return should include the amount + marginal floating interest generated on Compound since maturity
      return calculateReturn(u, m, a);
    }
  }

  /// @notice Allows Vault owners (via Swivel) to redeem any currently accrued interest
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param t Address of the redeeming user
  function redeemVaultInterest(address u, uint256 m, address t) external onlySwivel(swivel) returns (uint256) {
    // call to the floating market contract to release the position and calculate the interest generated
    uint256 interest = VaultTracker(markets[u][m].vaultAddr).redeemInterest(t);

    emit RedeemVaultInterest(u, m, t);

    return interest;
  }

  /// @notice Calculates the total amount of underlying returned including interest generated since the `matureMarket` function has been called
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param a Amount of zcTokens being redeemed
  function calculateReturn(address u, uint256 m, uint256 a) internal returns (uint256) {
    // calculate difference between the cToken exchange rate @ maturity and the current cToken exchange rate
    uint256 yield = ((CErc20(markets[u][m].cTokenAddr).exchangeRateCurrent() * 1e26) / maturityRate[u][m]) - 1e26;
    uint256 interest = (yield * a) / 1e26;

    // calculate the total amount of underlying principle to return
    return a + interest;
  }

  function cTokenAddress(address a, uint256 m) external view returns (address) {
    return markets[a][m].cTokenAddr;
  }

  /// @notice called by swivel IVFZI && IZFVI
  /// @dev call with underlying, maturity, mint-target, add-notional-target and an amount
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param z Recipient of the minted zcToken
  /// @param n Recipient of the added notional
  /// @param a Amount of zcToken minted and notional added
  function custodialInitiate(address u, uint256 m, address z, address n, uint256 a) external onlySwivel(swivel) returns (bool) {
    require(ZcToken(markets[u][m].zcTokenAddr).mint(z, a), 'mint failed');
    require(VaultTracker(markets[u][m].vaultAddr).addNotional(n, a), 'add notional failed');
    emit CustodialInitiate(u, m, z, n, a);
    return true;
  }

  /// @notice called by swivel EVFZE FF EZFVE
  /// @dev call with underlying, maturity, burn-target, remove-notional-target and an amount
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param z Owner of the zcToken to be burned
  /// @param n Target to remove notional from
  /// @param a Amount of zcToken burned and notional removed
  function custodialExit(address u, uint256 m, address z, address n, uint256 a) external onlySwivel(swivel) returns (bool) {
    require(ZcToken(markets[u][m].zcTokenAddr).burn(z, a), 'burn failed');
    require(VaultTracker(markets[u][m].vaultAddr).removeNotional(n, a), 'remove notional failed');
    emit CustodialExit(u, m, z, n, a);
    return true;
  }

  /// @notice called by swivel IZFZE, EZFZI
  /// @dev call with underlying, maturity, transfer-from, transfer-to, amount
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param f Owner of the zcToken to be burned
  /// @param t Target to be minted to
  /// @param a Amount of zcToken transfer
  function p2pZcTokenExchange(address u, uint256 m, address f, address t, uint256 a) external onlySwivel(swivel) returns (bool) {
    require(ZcToken(markets[u][m].zcTokenAddr).burn(f, a), 'zcToken burn failed');
    require(ZcToken(markets[u][m].zcTokenAddr).mint(t, a), 'zcToken mint failed');
    emit P2pZcTokenExchange(u, m, f, t, a);
    return true;
  }

  /// @notice called by swivel IVFVE, EVFVI
  /// @dev call with underlying, maturity, remove-from, add-to, amount
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param f Owner of the notional to be transferred
  /// @param t Target to be transferred to
  /// @param a Amount of notional transfer
  function p2pVaultExchange(address u, uint256 m, address f, address t, uint256 a) external onlySwivel(swivel) returns (bool) {
    require(VaultTracker(markets[u][m].vaultAddr).transferNotionalFrom(f, t, a), 'transfer notional failed');
    emit P2pVaultExchange(u, m, f, t, a);
    return true;
  }

  /// @notice External method giving access to this functionality within a given vault
  /// @dev Note that this method calculates yield and interest as well
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param t Target to be transferred to
  /// @param a Amount of notional to be transferred
  function transferVaultNotional(address u, uint256 m, address t, uint256 a) public returns (bool) {
    require(VaultTracker(markets[u][m].vaultAddr).transferNotionalFrom(msg.sender, t, a), 'vault transfer failed');
    emit TransferVaultNotional(u, m, msg.sender, t, a);
    return true;
  }

  /// @notice transfers notional fee to the Swivel contract without recalculating marginal interest for from
  /// @param u Underlying token address associated with the market
  /// @param m Maturity timestamp of the market
  /// @param f Owner of the amount
  /// @param a Amount to transfer
  function transferVaultNotionalFee(address u, uint256 m, address f, uint256 a) public onlySwivel(swivel) returns (bool) {
    VaultTracker(markets[u][m].vaultAddr).transferNotionalFee(f, a);
    return true;
  }

  modifier onlyAdmin(address a) {
    require(msg.sender == a, 'sender must be admin');
    _;
  }

  modifier onlySwivel(address s) {
    require(msg.sender == s, 'sender must be Swivel contract');
    _;
  }
}
