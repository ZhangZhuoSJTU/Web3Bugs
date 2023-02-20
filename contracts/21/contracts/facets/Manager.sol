// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../interfaces/IManager.sol';

import '../libraries/LibSherX.sol';
import '../libraries/LibPool.sol';

contract Manager is IManager {
  using SafeMath for uint256;

  // Once transaction has been mined, protocol is officialy insured.

  //
  // Modifiers
  //

  modifier onlyGovMain() {
    require(msg.sender == GovStorage.gs().govMain, 'NOT_GOV_MAIN');
    _;
  }

  // Validates if token is eligble for premium payments
  function onlyValidToken(PoolStorage.Base storage ps, IERC20 _token) private view {
    require(address(_token) != address(this), 'SHERX');
    require(ps.premiums, 'WHITELIST');
  }

  //
  // State changing methods
  //

  function setTokenPrice(IERC20 _token, uint256 _newUsd) external override onlyGovMain {
    LibPool.payOffDebtAll(_token);
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    (usdPerBlock, usdPool) = _setTokenPrice(_token, _newUsd, usdPerBlock, usdPool);
    _setData(usdPerBlock, usdPool);
  }

  function setTokenPrice(IERC20[] memory _token, uint256[] memory _newUsd)
    external
    override
    onlyGovMain
  {
    require(_token.length == _newUsd.length, 'LENGTH');

    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    for (uint256 i; i < _token.length; i++) {
      LibPool.payOffDebtAll(_token[i]);
      (usdPerBlock, usdPool) = _setTokenPrice(_token[i], _newUsd[i], usdPerBlock, usdPool);
    }
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremium(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium
  ) external override onlyGovMain {
    LibPool.payOffDebtAll(_token);
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    (usdPerBlock, usdPool) = _setProtocolPremium(_protocol, _token, _premium, usdPerBlock, usdPool);
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremium(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium
  ) external override onlyGovMain {
    require(_token.length == _premium.length, 'LENGTH');

    (uint256 usdPerBlock, uint256 usdPool) = _getData();

    for (uint256 i; i < _token.length; i++) {
      LibPool.payOffDebtAll(_token[i]);
      (usdPerBlock, usdPool) = _setProtocolPremium(
        _protocol,
        _token[i],
        _premium[i],
        usdPerBlock,
        usdPool
      );
    }
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremium(
    bytes32[] memory _protocol,
    IERC20[][] memory _token,
    uint256[][] memory _premium
  ) external override onlyGovMain {
    require(_protocol.length == _token.length, 'LENGTH_1');
    require(_protocol.length == _premium.length, 'LENGTH_2');

    (uint256 usdPerBlock, uint256 usdPool) = _getData();

    for (uint256 i; i < _protocol.length; i++) {
      require(_token[i].length == _premium[i].length, 'LENGTH_3');
      for (uint256 j; j < _token[i].length; j++) {
        LibPool.payOffDebtAll(_token[i][j]);
        (usdPerBlock, usdPool) = _setProtocolPremium(
          _protocol[i],
          _token[i][j],
          _premium[i][j],
          usdPerBlock,
          usdPool
        );
      }
    }
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 _newUsd
  ) external override onlyGovMain {
    LibPool.payOffDebtAll(_token);
    (uint256 usdPerBlock, uint256 usdPool) = _getData();

    (usdPerBlock, usdPool) = _setProtocolPremiumAndTokenPrice(
      _protocol,
      _token,
      _premium,
      _newUsd,
      usdPerBlock,
      usdPool
    );
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium,
    uint256[] memory _newUsd
  ) external override onlyGovMain {
    require(_token.length == _premium.length, 'LENGTH_1');
    require(_token.length == _newUsd.length, 'LENGTH_2');

    (uint256 usdPerBlock, uint256 usdPool) = _getData();

    for (uint256 i; i < _token.length; i++) {
      LibPool.payOffDebtAll(_token[i]);
      (usdPerBlock, usdPool) = _setProtocolPremiumAndTokenPrice(
        _protocol,
        _token[i],
        _premium[i],
        _newUsd[i],
        usdPerBlock,
        usdPool
      );
    }
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremiumAndTokenPrice(
    bytes32[] memory _protocol,
    IERC20 _token,
    uint256[] memory _premium,
    uint256 _newUsd
  ) external override onlyGovMain {
    require(_protocol.length == _premium.length, 'LENGTH');
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    onlyValidToken(ps, _token);
    LibPool.payOffDebtAll(_token);

    uint256 oldPremium = ps.totalPremiumPerBlock;
    uint256 newPremium = oldPremium;
    (uint256 usdPerBlock, uint256 usdPool) = _getData();

    uint256 oldUsd = _setTokenPrice(_token, _newUsd);

    for (uint256 i; i < _protocol.length; i++) {
      require(ps.isProtocol[_protocol[i]], 'NON_PROTOCOL');
      // This calculation mimicks the logic in `_setProtocolPremium() private`
      // But only write `newPremium` to storage once
      newPremium = newPremium.sub(ps.protocolPremium[_protocol[i]]).add(_premium[i]);
      ps.protocolPremium[_protocol[i]] = _premium[i];
    }
    ps.totalPremiumPerBlock = newPremium;
    (usdPerBlock, usdPool) = _updateData(
      ps,
      usdPerBlock,
      usdPool,
      oldPremium,
      newPremium,
      oldUsd,
      _newUsd
    );
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremiumAndTokenPrice(
    bytes32[] memory _protocol,
    IERC20[][] memory _token,
    uint256[][] memory _premium,
    uint256[][] memory _newUsd
  ) external override onlyGovMain {
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    require(_protocol.length == _token.length, 'LENGTH_1');
    require(_protocol.length == _premium.length, 'LENGTH_2');
    require(_protocol.length == _newUsd.length, 'LENGTH_3');

    for (uint256 i; i < _protocol.length; i++) {
      require(_token[i].length == _premium[i].length, 'LENGTH_4');
      require(_token[i].length == _newUsd[i].length, 'LENGTH_5');
      for (uint256 j; j < _token[i].length; j++) {
        LibPool.payOffDebtAll(_token[i][j]);
        (usdPerBlock, usdPool) = _setProtocolPremiumAndTokenPrice(
          _protocol[i],
          _token[i][j],
          _premium[i][j],
          _newUsd[i][j],
          usdPerBlock,
          usdPool
        );
      }
    }
    _setData(usdPerBlock, usdPool);
  }

  /// @notice Update internal (storage) USD price of `_token` with `_newUsd` and return updated memory variables
  /// @param _token Token address
  /// @param _newUsd USD amount
  /// @param usdPerBlock The sum of internal USD that protocols pay as premium
  /// @param usdPool The sum of all premiums paid that are still in the pool, multiplied by the internal USD value
  /// @return Updated usdPerBlock based on `_newUsd`
  /// @return Updated usdPool based on `_newUsd`
  function _setTokenPrice(
    IERC20 _token,
    uint256 _newUsd,
    uint256 usdPerBlock,
    uint256 usdPool
  ) private returns (uint256, uint256) {
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    onlyValidToken(ps, _token);

    uint256 oldUsd = _setTokenPrice(_token, _newUsd);
    uint256 premium = ps.totalPremiumPerBlock;
    (usdPerBlock, usdPool) = _updateData(
      ps,
      usdPerBlock,
      usdPool,
      premium,
      premium,
      oldUsd,
      _newUsd
    );
    return (usdPerBlock, usdPool);
  }

  /// @notice Update internal (storage) USD price of `_token` with `_newUsd`
  /// @param _token Token address
  /// @param _newUsd USD amount
  /// @return oldUsd The previous usd amount that was stored
  function _setTokenPrice(IERC20 _token, uint256 _newUsd) private returns (uint256 oldUsd) {
    SherXStorage.Base storage sx = SherXStorage.sx();

    oldUsd = sx.tokenUSD[_token];
    // used for setProtocolPremiumAndTokenPrice, if same token prices are updated
    if (oldUsd != _newUsd) {
      sx.tokenUSD[_token] = _newUsd;
    }
  }

  /// @notice Update premium of `_protocol` using `_token` with `_premium` and return updated memory variables
  /// @param _protocol Protocol identifier
  /// @param _token Token address
  /// @param _premium The new premium per block
  /// @param usdPerBlock The sum of internal USD that protocols pay as premium
  /// @param usdPool The sum of all premiums paid that are still in the pool, multiplied by the internal USD value
  /// @return Updated usdPerBlock based on `_premium`
  /// @return Updated usdPool based on `_premium`
  function _setProtocolPremium(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 usdPerBlock,
    uint256 usdPool
  ) private returns (uint256, uint256) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    onlyValidToken(ps, _token);

    (uint256 oldPremium, uint256 newPremium) = _setProtocolPremium(ps, _protocol, _premium);

    uint256 usd = sx.tokenUSD[_token];
    (usdPerBlock, usdPool) = _updateData(
      ps,
      usdPerBlock,
      usdPool,
      oldPremium,
      newPremium,
      usd,
      usd
    );
    return (usdPerBlock, usdPool);
  }

  /// @notice Update premium of `_protocol` with `_premium` using pool storage `ps` and return old and new total premium per block
  /// @param ps Pointer to pool storage based on token address
  /// @param _protocol Protocol identifier
  /// @param _premium The new premium per block
  /// @return oldPremium Previous sum of premiums being paid in the used token
  /// @return newPremium Updated sum of premiums being paid in the used token
  function _setProtocolPremium(
    PoolStorage.Base storage ps,
    bytes32 _protocol,
    uint256 _premium
  ) private returns (uint256 oldPremium, uint256 newPremium) {
    require(ps.isProtocol[_protocol], 'NON_PROTOCOL');

    oldPremium = ps.totalPremiumPerBlock;
    // to calculate the new totalPremiumPerBlock
    // - subtract the original premium the protocol paid.
    // - add the new premium the protocol is about to pay.
    newPremium = oldPremium.sub(ps.protocolPremium[_protocol]).add(_premium);

    ps.totalPremiumPerBlock = newPremium;
    // Actually register the new premium for the protocol
    ps.protocolPremium[_protocol] = _premium;
  }

  /// @notice Update premium of `_protocol` using `_token` with `_premium` + update `_token` USD value with `_newUsd` and returns updated memory variables
  /// @param _protocol Protocol identifier
  /// @param _token Token address
  /// @param _premium The new premium per block
  /// @param _newUsd USD amount
  /// @param usdPerBlock The sum of internal USD that protocols pay as premium
  /// @param usdPool The sum of all premiums paid that are still in the pool, multiplied by the internal USD value
  /// @return Updated usdPerBlock based on `_premium`
  /// @return Updated usdPool based on `_premium`
  function _setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 _newUsd,
    uint256 usdPerBlock,
    uint256 usdPool
  ) private returns (uint256, uint256) {
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    onlyValidToken(ps, _token);

    uint256 oldUsd = _setTokenPrice(_token, _newUsd);
    (uint256 oldPremium, uint256 newPremium) = _setProtocolPremium(ps, _protocol, _premium);
    (usdPerBlock, usdPool) = _updateData(
      ps,
      usdPerBlock,
      usdPool,
      oldPremium,
      newPremium,
      oldUsd,
      _newUsd
    );
    return (usdPerBlock, usdPool);
  }

  /// @notice Read current usdPerBlock and usdPool from storage
  /// @return usdPerBlock Current usdPerBlock
  /// @return usdPool Current usdPool
  function _getData() private view returns (uint256 usdPerBlock, uint256 usdPool) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    usdPerBlock = sx.totalUsdPerBlock;
    usdPool = LibSherX.viewAccrueUSDPool();
  }

  /// @notice Update in memory `usdPerBlock` and `usdPool` based on the old/new premiums and prices. Return updated values.
  /// @param ps Pointer to pool storage based on token address
  /// @param usdPerBlock Current in memory value of usdPerBlock
  /// @param usdPool Current in memory value of usdPool
  /// @param _oldPremium Old sum of premiums paid by protocols using token
  /// @param _newPremium new sum of premium paid by protocols using token (based on update)
  /// @param _oldUsd Old stored usd price of token
  /// @param _newUsd New stored usd price of token (based on update)
  /// @return Updated usdPerBlock
  /// @return Updated usdPool
  function _updateData(
    PoolStorage.Base storage ps,
    uint256 usdPerBlock,
    uint256 usdPool,
    uint256 _oldPremium,
    uint256 _newPremium,
    uint256 _oldUsd,
    uint256 _newUsd
  ) private view returns (uint256, uint256) {
    // `sub` represents the old usdPerBlock for this particulair token
    // This is calculated using the previous stored `totalPremiumPerBlock` and `tokenUSD`
    uint256 sub = _oldPremium.mul(_oldUsd);
    // `add` represents the new usdPerblock for this particulair token
    // This is calculated using the current in memory value of `_newPremium` and `_newUsd`
    uint256 add = _newPremium.mul(_newUsd);

    // To make sure the usdPerBlock uint doesn't attempt a potential underflow operation
    // Changed the order of sub and add's based on if statement
    // Goal is to subtract the old value `sub` and add the new value `add from `usdPerBlock`
    if (sub > add) {
      usdPerBlock = usdPerBlock.sub(sub.sub(add).div(10**18));
    } else {
      usdPerBlock = usdPerBlock.add(add.sub(sub).div(10**18));
    }

    // In case underyling == 0, the token is not part of the usdPool.
    if (ps.sherXUnderlying > 0) {
      // To make sure the usdPool uint doesn't attempt a potential underflow operation
      // Goal is to update the current usdPool based on the `_newUsd` value
      // ~ substract `_oldUsd` * `ps.sherXUnderlying`
      // ~ add `_newUsd` * `ps.sherXUnderlying`
      // If _newUsd == _oldUsd, nothing changes
      if (_newUsd > _oldUsd) {
        usdPool = usdPool.add(_newUsd.sub(_oldUsd).mul(ps.sherXUnderlying).div(10**18));
      } else if (_newUsd < _oldUsd) {
        usdPool = usdPool.sub(_oldUsd.sub(_newUsd).mul(ps.sherXUnderlying).div(10**18));
      }
    }

    return (usdPerBlock, usdPool);
  }

  /// @notice Use in memory variables of `usdPerBlock` and `usdPool` and write to storage
  /// @param usdPerBlock Current in memory value of usdPerBlock
  /// @param usdPool Current in memory value of usdPool
  function _setData(uint256 usdPerBlock, uint256 usdPool) private {
    SherXStorage.Base storage sx = SherXStorage.sx();
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

    LibSherX.accrueSherX();

    uint256 _currentTotalSupply = sx20.totalSupply;

    if (usdPerBlock > 0 && _currentTotalSupply == 0) {
      // initial accrue, mint 1 SHERX per block
      sx.sherXPerBlock = 10**18;
    } else if (usdPool > 0) {
      // Calculate new sherXPerBlock based on the updated usdPerBlock and usdPool values
      sx.sherXPerBlock = _currentTotalSupply.mul(usdPerBlock).div(usdPool);
    } else {
      sx.sherXPerBlock = 0;
    }
    sx.internalTotalSupply = _currentTotalSupply;
    sx.internalTotalSupplySettled = block.number;

    sx.totalUsdPerBlock = usdPerBlock;
    sx.totalUsdPool = usdPool;
    sx.totalUsdLastSettled = block.number;
  }
}
