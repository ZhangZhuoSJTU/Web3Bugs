// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../interfaces/IPoolBase.sol';

import '../storage/GovStorage.sol';

import '../libraries/LibPool.sol';

contract PoolBase is IPoolBase {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using SafeERC20 for ILock;

  //
  // View methods
  //

  function getCooldownFee(IERC20 _token) external view override returns (uint32) {
    return baseData().activateCooldownFee;
  }

  function getSherXWeight(IERC20 _token) external view override returns (uint16) {
    return baseData().sherXWeight;
  }

  function getGovPool(IERC20 _token) external view override returns (address) {
    return baseData().govPool;
  }

  function isPremium(IERC20 _token) external view override returns (bool) {
    return baseData().premiums;
  }

  function isStake(IERC20 _token) external view override returns (bool) {
    return baseData().stakes;
  }

  function getProtocolBalance(bytes32 _protocol, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    return baseData().protocolBalance[_protocol];
  }

  function getProtocolPremium(bytes32 _protocol, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    return baseData().protocolPremium[_protocol];
  }

  function getLockToken(IERC20 _token) external view override returns (ILock) {
    return baseData().lockToken;
  }

  function isProtocol(bytes32 _protocol, IERC20 _token) external view override returns (bool) {
    return baseData().isProtocol[_protocol];
  }

  function getProtocols(IERC20 _token) external view override returns (bytes32[] memory) {
    return baseData().protocols;
  }

  function getUnstakeEntry(
    address _staker,
    uint256 _id,
    IERC20 _token
  ) external view override returns (PoolStorage.UnstakeEntry memory) {
    return baseData().unstakeEntries[_staker][_id];
  }

  function getTotalAccruedDebt(IERC20 _token) external view override returns (uint256) {
    baseData();
    return LibPool.getTotalAccruedDebt(_token);
  }

  function getFirstMoneyOut(IERC20 _token) external view override returns (uint256) {
    return baseData().firstMoneyOut;
  }

  function getAccruedDebt(bytes32 _protocol, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    baseData();
    return LibPool.accruedDebt(_protocol, _token);
  }

  function getTotalPremiumPerBlock(IERC20 _token) external view override returns (uint256) {
    return baseData().totalPremiumPerBlock;
  }

  function getPremiumLastPaid(IERC20 _token) external view override returns (uint40) {
    return baseData().totalPremiumLastPaid;
  }

  function getSherXUnderlying(IERC20 _token) external view override returns (uint256) {
    return baseData().sherXUnderlying;
  }

  function getUnstakeEntrySize(address _staker, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    return baseData().unstakeEntries[_staker].length;
  }

  function getInitialUnstakeEntry(address _staker, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    PoolStorage.Base storage ps = baseData();
    GovStorage.Base storage gs = GovStorage.gs();
    for (uint256 i = 0; i < ps.unstakeEntries[_staker].length; i++) {
      if (ps.unstakeEntries[_staker][i].blockInitiated == 0) {
        continue;
      }
      if (
        ps.unstakeEntries[_staker][i].blockInitiated + gs.unstakeCooldown + gs.unstakeWindow <=
        uint40(block.number)
      ) {
        continue;
      }
      return i;
    }
    return ps.unstakeEntries[_staker].length;
  }

  function getUnactivatedStakersPoolBalance(IERC20 _token) public view override returns (uint256) {
    return baseData().stakeBalance;
  }

  function getStakersPoolBalance(IERC20 _token) public view override returns (uint256) {
    return LibPool.stakeBalance(baseData());
  }

  function getStakerPoolBalance(address _staker, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    PoolStorage.Base storage ps = baseData();
    if (ps.lockToken.totalSupply() == 0) {
      return 0;
    }
    return
      ps.lockToken.balanceOf(_staker).mul(getStakersPoolBalance(_token)).div(
        ps.lockToken.totalSupply()
      );
  }

  function getTotalUnmintedSherX(IERC20 _token) public view override returns (uint256) {
    baseData();
    return LibPool.getTotalUnmintedSherX(_token);
  }

  function getUnallocatedSherXStored(IERC20 _token) public view override returns (uint256) {
    return baseData().unallocatedSherX;
  }

  function getUnallocatedSherXTotal(IERC20 _token) external view override returns (uint256) {
    return getUnallocatedSherXStored(_token).add(LibPool.getTotalUnmintedSherX(_token));
  }

  function getUnallocatedSherXFor(address _user, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    baseData();
    return LibPool.getUnallocatedSherXFor(_user, _token);
  }

  function getTotalSherXPerBlock(IERC20 _token) public view override returns (uint256) {
    return SherXStorage.sx().sherXPerBlock.mul(baseData().sherXWeight).div(uint16(-1));
  }

  function getSherXPerBlock(IERC20 _token) external view override returns (uint256) {
    return getSherXPerBlock(msg.sender, _token);
  }

  function getSherXPerBlock(address _user, IERC20 _token) public view override returns (uint256) {
    PoolStorage.Base storage ps = baseData();
    if (ps.lockToken.totalSupply() == 0) {
      return 0;
    }
    return
      getTotalSherXPerBlock(_token).mul(ps.lockToken.balanceOf(_user)).div(
        ps.lockToken.totalSupply()
      );
  }

  function getSherXPerBlock(uint256 _lock, IERC20 _token) external view override returns (uint256) {
    // simulates staking (adding lock)
    return
      getTotalSherXPerBlock(_token).mul(_lock).div(baseData().lockToken.totalSupply().add(_lock));
  }

  function getSherXLastAccrued(IERC20 _token) external view override returns (uint40) {
    return baseData().sherXLastAccrued;
  }

  function LockToTokenXRate(IERC20 _token) external view override returns (uint256) {
    return LockToToken(10**18, _token);
  }

  function LockToToken(uint256 _amount, IERC20 _token) public view override returns (uint256) {
    PoolStorage.Base storage ps = baseData();
    uint256 balance = LibPool.stakeBalance(ps);
    uint256 totalLock = ps.lockToken.totalSupply();
    if (totalLock == 0 || balance == 0) {
      revert('NO_DATA');
    }
    return balance.mul(_amount).div(totalLock);
  }

  function TokenToLockXRate(IERC20 _token) external view override returns (uint256) {
    return TokenToLock(10**18, _token);
  }

  function TokenToLock(uint256 _amount, IERC20 _token) public view override returns (uint256) {
    PoolStorage.Base storage ps = baseData();
    uint256 balance = LibPool.stakeBalance(ps);
    uint256 totalLock = ps.lockToken.totalSupply();
    if (totalLock == 0 || balance == 0) {
      return 10**18;
    }
    return totalLock.mul(_amount).div(balance);
  }

  //
  // State changing methods
  //

  function setCooldownFee(uint32 _fee, IERC20 _token) external override {
    require(msg.sender == GovStorage.gs().govMain, 'NOT_GOV_MAIN');

    baseData().activateCooldownFee = _fee;
  }

  function depositProtocolBalance(
    bytes32 _protocol,
    uint256 _amount,
    IERC20 _token
  ) external override {
    require(_amount > 0, 'AMOUNT');
    require(GovStorage.gs().protocolIsCovered[_protocol], 'PROTOCOL');
    PoolStorage.Base storage ps = baseData();
    require(ps.isProtocol[_protocol], 'NO_DEPOSIT');

    _token.safeTransferFrom(msg.sender, address(this), _amount);
    ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].add(_amount);
  }

  function withdrawProtocolBalance(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver,
    IERC20 _token
  ) external override {
    require(msg.sender == GovStorage.gs().protocolAgents[_protocol], 'SENDER');
    require(_amount > 0, 'AMOUNT');
    require(_receiver != address(0), 'RECEIVER');
    PoolStorage.Base storage ps = baseData();

    LibPool.payOffDebtAll(_token);

    if (_amount == uint256(-1)) {
      _amount = ps.protocolBalance[_protocol];
    }

    _token.safeTransfer(_receiver, _amount);
    ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].sub(_amount);
  }

  function activateCooldown(uint256 _amount, IERC20 _token) external override returns (uint256) {
    require(_amount > 0, 'AMOUNT');
    PoolStorage.Base storage ps = baseData();

    ps.lockToken.safeTransferFrom(msg.sender, address(this), _amount);
    uint256 fee = _amount.mul(ps.activateCooldownFee).div(uint32(-1));
    if (fee > 0) {
      // stake of user gets burned
      // representative amount token get added to first money out pool
      uint256 tokenAmount = fee.mul(LibPool.stakeBalance(ps)).div(ps.lockToken.totalSupply());
      ps.firstMoneyOut = ps.firstMoneyOut.add(tokenAmount);

      ps.lockToken.burn(address(this), fee);
    }

    ps.unstakeEntries[msg.sender].push(
      PoolStorage.UnstakeEntry(uint40(block.number), _amount.sub(fee))
    );

    return ps.unstakeEntries[msg.sender].length - 1;
  }

  function cancelCooldown(uint256 _id, IERC20 _token) external override {
    PoolStorage.Base storage ps = baseData();
    GovStorage.Base storage gs = GovStorage.gs();

    PoolStorage.UnstakeEntry memory withdraw = ps.unstakeEntries[msg.sender][_id];
    require(withdraw.blockInitiated != 0, 'WITHDRAW_NOT_ACTIVE');

    require(
      withdraw.blockInitiated + gs.unstakeCooldown >= uint40(block.number),
      'COOLDOWN_EXPIRED'
    );
    delete ps.unstakeEntries[msg.sender][_id];
    ps.lockToken.safeTransfer(msg.sender, withdraw.lock);
  }

  function unstakeWindowExpiry(
    address _account,
    uint256 _id,
    IERC20 _token
  ) external override {
    PoolStorage.Base storage ps = baseData();
    GovStorage.Base storage gs = GovStorage.gs();

    PoolStorage.UnstakeEntry memory withdraw = ps.unstakeEntries[_account][_id];
    require(withdraw.blockInitiated != 0, 'WITHDRAW_NOT_ACTIVE');

    require(
      withdraw.blockInitiated + gs.unstakeCooldown + gs.unstakeWindow < uint40(block.number),
      'UNSTAKE_WINDOW_NOT_EXPIRED'
    );
    delete ps.unstakeEntries[_account][_id];
    ps.lockToken.safeTransfer(_account, withdraw.lock);
  }

  function unstake(
    uint256 _id,
    address _receiver,
    IERC20 _token
  ) external override returns (uint256 amount) {
    PoolStorage.Base storage ps = baseData();
    require(_receiver != address(0), 'RECEIVER');
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.UnstakeEntry memory withdraw = ps.unstakeEntries[msg.sender][_id];
    require(withdraw.blockInitiated != 0, 'WITHDRAW_NOT_ACTIVE');
    // period is including
    require(withdraw.blockInitiated + gs.unstakeCooldown < uint40(block.number), 'COOLDOWN_ACTIVE');
    require(
      withdraw.blockInitiated + gs.unstakeCooldown + gs.unstakeWindow >= uint40(block.number),
      'UNSTAKE_WINDOW_EXPIRED'
    );
    amount = withdraw.lock.mul(LibPool.stakeBalance(ps)).div(ps.lockToken.totalSupply());

    ps.stakeBalance = ps.stakeBalance.sub(amount);
    delete ps.unstakeEntries[msg.sender][_id];
    ps.lockToken.burn(address(this), withdraw.lock);
    _token.safeTransfer(_receiver, amount);
  }

  function payOffDebtAll(IERC20 _token) external override {
    baseData();
    LibPool.payOffDebtAll(_token);
  }

  function cleanProtocol(
    bytes32 _protocol,
    uint256 _index,
    bool _forceDebt,
    address _receiver,
    IERC20 _token
  ) external override {
    require(msg.sender == GovStorage.gs().govMain, 'NOT_GOV_MAIN');
    require(_receiver != address(0), 'RECEIVER');

    PoolStorage.Base storage ps = baseData();
    require(ps.protocols[_index] == _protocol, 'INDEX');

    // If protocol has 0 accrued debt, the premium should also be 0
    // If protocol has >0 accrued debt, needs to be bigger then balance
    // Otherwise just update premium to 0 for the protocol first and then delete
    uint256 accrued = LibPool.accruedDebt(_protocol, _token);
    if (accrued == 0) {
      require(ps.protocolPremium[_protocol] == 0, 'CAN_NOT_DELETE');
    } else {
      require(accrued > ps.protocolBalance[_protocol], 'CAN_NOT_DELETE2');
    }

    // send the remainder of the protocol balance to the sherx underlying
    if (_forceDebt && accrued > 0) {
      ps.sherXUnderlying = ps.sherXUnderlying.add(ps.protocolBalance[_protocol]);
      delete ps.protocolBalance[_protocol];
    }

    // send any leftovers back to the protocol receiver
    if (ps.protocolBalance[_protocol] > 0) {
      _token.safeTransfer(_receiver, ps.protocolBalance[_protocol]);
      delete ps.protocolBalance[_protocol];
    }

    // move last index to index of _protocol
    ps.protocols[_index] = ps.protocols[ps.protocols.length - 1];
    // remove last index
    ps.protocols.pop();
    ps.isProtocol[_protocol] = false;
    // could still be >0, if accrued more debt than needed.
    if (ps.protocolPremium[_protocol] > 0) {
      ps.totalPremiumPerBlock = ps.totalPremiumPerBlock.sub(ps.protocolPremium[_protocol]);
      delete ps.protocolPremium[_protocol];
    }
  }

  function baseData() internal view returns (PoolStorage.Base storage ps) {
    ps = PoolStorage.ps(bps());
    require(ps.govPool != address(0), 'INVALID_TOKEN');
  }

  function bps() internal pure returns (IERC20 rt) {
    // These fields are not accessible from assembly
    bytes memory array = msg.data;
    uint256 index = msg.data.length;

    // solhint-disable-next-line no-inline-assembly
    assembly {
      // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
      rt := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
    }
  }
}
