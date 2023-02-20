// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import 'diamond-2/contracts/libraries/LibDiamond.sol';

import '../interfaces/IGov.sol';

import '../storage/GovStorage.sol';
import '../storage/PoolStorage.sol';
import '../storage/SherXStorage.sol';

contract Gov is IGov {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  //
  // Modifiers
  //

  modifier onlyGovMain() {
    require(msg.sender == GovStorage.gs().govMain, 'NOT_GOV_MAIN');
    _;
  }

  //
  // View methods
  //

  function getGovMain() external view override returns (address) {
    return GovStorage.gs().govMain;
  }

  function getWatsons() external view override returns (address) {
    return GovStorage.gs().watsonsAddress;
  }

  function getWatsonsSherXWeight() external view override returns (uint16) {
    return GovStorage.gs().watsonsSherxWeight;
  }

  function getWatsonsSherxLastAccrued() external view override returns (uint40) {
    return GovStorage.gs().watsonsSherxLastAccrued;
  }

  function getWatsonsSherXPerBlock() public view override returns (uint256) {
    GovStorage.Base storage gs = GovStorage.gs();
    SherXStorage.Base storage sx = SherXStorage.sx();

    return sx.sherXPerBlock.mul(gs.watsonsSherxWeight).div(uint16(-1));
  }

  function getWatsonsUnmintedSherX() external view override returns (uint256) {
    GovStorage.Base storage gs = GovStorage.gs();

    return block.number.sub(gs.watsonsSherxLastAccrued).mul(getWatsonsSherXPerBlock());
  }

  function getUnstakeWindow() external view override returns (uint40) {
    return GovStorage.gs().unstakeWindow;
  }

  function getCooldown() external view override returns (uint40) {
    return GovStorage.gs().unstakeCooldown;
  }

  function getTokensStaker() external view override returns (IERC20[] memory) {
    return GovStorage.gs().tokensStaker;
  }

  function getTokensSherX() external view override returns (IERC20[] memory) {
    return GovStorage.gs().tokensSherX;
  }

  function getProtocolIsCovered(bytes32 _protocol) external view override returns (bool) {
    return GovStorage.gs().protocolIsCovered[_protocol];
  }

  function getProtocolManager(bytes32 _protocol) external view override returns (address) {
    // NOTE: UNUSED
    return GovStorage.gs().protocolManagers[_protocol];
  }

  function getProtocolAgent(bytes32 _protocol) external view override returns (address) {
    return GovStorage.gs().protocolAgents[_protocol];
  }

  //
  // State changing methods
  //

  function setInitialGovMain(address _govMain) external override {
    GovStorage.Base storage gs = GovStorage.gs();

    require(_govMain != address(0), 'ZERO_GOV');
    require(msg.sender == LibDiamond.contractOwner(), 'NOT_DEV');
    require(gs.govMain == address(0), 'ALREADY_SET');

    gs.govMain = _govMain;
  }

  function transferGovMain(address _govMain) external override onlyGovMain {
    require(_govMain != address(0), 'ZERO_GOV');
    require(GovStorage.gs().govMain != _govMain, 'SAME_GOV');
    GovStorage.gs().govMain = _govMain;
  }

  function setWatsonsAddress(address _watsons) external override onlyGovMain {
    GovStorage.Base storage gs = GovStorage.gs();

    require(_watsons != address(0), 'ZERO_WATS');
    require(gs.watsonsAddress != _watsons, 'SAME_WATS');
    gs.watsonsAddress = _watsons;
  }

  function setUnstakeWindow(uint40 _unstakeWindow) external override onlyGovMain {
    require(_unstakeWindow < 25000000, 'MAX'); // ~ approximate 10 years of blocks
    GovStorage.gs().unstakeWindow = _unstakeWindow;
  }

  function setCooldown(uint40 _period) external override onlyGovMain {
    require(_period < 25000000, 'MAX'); // ~ approximate 10 years of blocks
    GovStorage.gs().unstakeCooldown = _period;
  }

  function protocolAdd(
    bytes32 _protocol,
    address _eoaProtocolAgent,
    address _eoaManager,
    IERC20[] memory _tokens
  ) external override onlyGovMain {
    GovStorage.Base storage gs = GovStorage.gs();
    require(!gs.protocolIsCovered[_protocol], 'COVERED');
    gs.protocolIsCovered[_protocol] = true;

    protocolUpdate(_protocol, _eoaProtocolAgent, _eoaManager);
    protocolDepositAdd(_protocol, _tokens);
  }

  function protocolUpdate(
    bytes32 _protocol,
    address _eoaProtocolAgent,
    address _eoaManager
  ) public override onlyGovMain {
    require(_protocol != bytes32(0), 'ZERO_PROTOCOL');
    require(_eoaProtocolAgent != address(0), 'ZERO_AGENT');
    require(_eoaManager != address(0), 'ZERO_MANAGER');

    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');

    // NOTE: UNUSED
    gs.protocolManagers[_protocol] = _eoaManager;
    gs.protocolAgents[_protocol] = _eoaProtocolAgent;
  }

  function protocolDepositAdd(bytes32 _protocol, IERC20[] memory _tokens)
    public
    override
    onlyGovMain
  {
    require(_protocol != bytes32(0), 'ZERO_PROTOCOL');
    require(_tokens.length > 0, 'ZERO');

    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');

    for (uint256 i; i < _tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(_tokens[i]);
      require(ps.premiums, 'INIT');
      require(!ps.isProtocol[_protocol], 'ALREADY_ADDED');

      ps.isProtocol[_protocol] = true;
      ps.protocols.push(_protocol);
    }
  }

  function protocolRemove(bytes32 _protocol) external override onlyGovMain {
    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');

    for (uint256 i; i < gs.tokensSherX.length; i++) {
      IERC20 token = gs.tokensSherX[i];

      PoolStorage.Base storage ps = PoolStorage.ps(token);
      // basically need to check if accruedDebt > 0, but this is true in case protocolPremium > 0
      require(ps.protocolPremium[_protocol] == 0, 'DEBT');
      require(!ps.isProtocol[_protocol], 'POOL_PROTOCOL');
    }
    delete gs.protocolIsCovered[_protocol];
    delete gs.protocolManagers[_protocol];
    delete gs.protocolAgents[_protocol];
  }

  function tokenInit(
    IERC20 _token,
    address _govPool,
    ILock _lock,
    bool _protocolPremium
  ) external override onlyGovMain {
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    require(address(_token) != address(0), 'ZERO_TOKEN');

    if (_govPool != address(0)) {
      ps.govPool = _govPool;
    }
    require(ps.govPool != address(0), 'ZERO_GOV');

    if (address(_lock) != address(0)) {
      if (address(ps.lockToken) == address(0)) {
        require(_lock.getOwner() == address(this), 'OWNER');
        require(_lock.totalSupply() == 0, 'SUPPLY');
        // If not native (e.g. NOT SherX), verify underlying mapping
        if (address(_token) != address(this)) {
          require(_lock.underlying() == _token, 'UNDERLYING');
        }
        ps.lockToken = _lock;
      }
      if (address(ps.lockToken) == address(_lock)) {
        require(!ps.stakes, 'STAKES_SET');
        ps.stakes = true;
        gs.tokensStaker.push(_token);
      } else {
        revert('WRONG_LOCK');
      }
    }

    if (_protocolPremium) {
      require(!ps.premiums, 'PREMIUMS_SET');
      ps.premiums = true;
      gs.tokensSherX.push(_token);
    }
  }

  function tokenDisableStakers(IERC20 _token, uint256 _index) external override onlyGovMain {
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    require(gs.tokensStaker[_index] == _token, 'INDEX');
    require(ps.sherXWeight == 0, 'ACTIVE_WEIGHT');

    delete ps.stakes;
    // lockToken is kept, as stakers should be able to unstake
    // staking can be reenabled by calling tokenInit
    gs.tokensStaker[_index] = gs.tokensStaker[gs.tokensStaker.length - 1];
    gs.tokensStaker.pop();
  }

  function tokenDisableProtocol(IERC20 _token, uint256 _index) external override onlyGovMain {
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    require(gs.tokensSherX[_index] == _token, 'INDEX');
    require(ps.totalPremiumPerBlock == 0, 'ACTIVE_PREMIUM');
    // Can not remove with active underlying, SherX holders will see drop in underlying value
    require(ps.sherXUnderlying == 0, 'ACTIVE_SHERX');

    delete ps.premiums;
    gs.tokensSherX[_index] = gs.tokensSherX[gs.tokensSherX.length - 1];
    gs.tokensSherX.pop();
  }

  // Unloading all tokens, likely before calling tokenRemove
  function tokenUnload(
    IERC20 _token,
    IRemove _native,
    address _remaining
  ) external override onlyGovMain {
    require(address(_native) != address(0), 'ZERO_NATIVE');
    require(_remaining != address(0), 'ZERO_REMAIN');
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    require(ps.govPool != address(0), 'EMPTY');

    // Protocol are technically still able to deposit, ps.premiums is still true
    // This makes sure the sherx underlying doesn't grow anymore
    // this function is called before the disable protocol
    // disable stakes --> unload tokens --> disable protocol (sherx) --> remove

    require(!ps.stakes, 'STAKES_SET');
    require(ps.totalPremiumPerBlock == 0, 'ACTIVE_PREMIUM');
    require(address(ps.strategy) == address(0), 'ACTIVE_STRATEGY');

    uint256 totalToken = ps.firstMoneyOut.add(ps.sherXUnderlying);

    // `firstMoneyOut` and `sherXUnderlying` are two 'pools' that needs to be swapped
    // in a single transaction.
    // If `sherXUnderlying` is not swapped in a single tx, the price of SherX (underlying value)
    // will drop
    // If `firstMoneyOut` is not swapped in a single tx, the buffer will be reduced in $ value
    // This code piece swaps these tokens for other tokens in the solution
    // The goal is to keep the current $ value of these two 'pools' somewhat equal before/after swap
    if (totalToken > 0) {
      _token.approve(address(_native), totalToken);

      (IERC20 newToken, uint256 newFmo, uint256 newSherxUnderlying) =
        _native.swap(_token, ps.firstMoneyOut, ps.sherXUnderlying);

      PoolStorage.Base storage ps2 = PoolStorage.ps(newToken);
      require(ps2.govPool != address(0), 'EMPTY_SWAP');

      ps2.stakeBalance = ps2.stakeBalance.add(newFmo);
      ps2.firstMoneyOut = ps2.firstMoneyOut.add(newFmo);
      ps2.sherXUnderlying = ps2.sherXUnderlying.add(newSherxUnderlying);
    }

    uint256 totalFee = ps.unallocatedSherX;
    if (totalFee > 0) {
      IERC20(address(this)).safeTransfer(_remaining, totalFee);
      delete ps.unallocatedSherX;
    }

    uint256 balance = ps.stakeBalance.sub(ps.firstMoneyOut);
    if (balance > 0) {
      _token.safeTransfer(_remaining, balance);
      delete ps.stakeBalance;
    }

    delete ps.sherXUnderlying;
    delete ps.firstMoneyOut;
  }

  function tokenRemove(IERC20 _token) external override onlyGovMain {
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    require(ps.govPool != address(0), 'EMPTY');
    require(!ps.stakes, 'STAKES_SET');
    require(!ps.premiums, 'PREMIUMS_SET');
    require(ps.protocols.length == 0, 'ACTIVE_PROTOCOLS');
    require(ps.stakeBalance == 0, 'BALANCE_SET');
    // NOTE: removed because firstMoneyOut will always be less or equal to stakeBalance
    require(ps.unallocatedSherX == 0, 'SHERX_SET');

    delete ps.govPool;
    delete ps.lockToken;
    delete ps.activateCooldownFee;
    delete ps.sherXWeight;
    delete ps.sherXLastAccrued;

    // NOTE: storage variables need to be kept. To make sure readding the token works
    // IF readding the token, verify off chain if the storage is sufficient.
    // Create re-adding plan off chain if this isn't the case. (e.g. clean storage by doing calls)
    //delete ps.sWithdrawn
    //delete ps.sWeight;

    delete ps.totalPremiumLastPaid;
  }
}
