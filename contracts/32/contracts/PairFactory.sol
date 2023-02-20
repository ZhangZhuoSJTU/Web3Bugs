// SPDX-License-Identifier: UNLICENSED

// Copyright (c) 2021 0xdev0 - All rights reserved
// https://twitter.com/0xdev0

pragma solidity 0.8.6;

import './interfaces/IPairFactory.sol';
import './interfaces/ILendingController.sol';

import './external/Ownable.sol';
import './external/Address.sol';
import './external/Clones.sol';

import './LendingPair.sol';

contract PairFactory is IPairFactory, Ownable {

  using Address for address;
  using Clones  for address;

  address public lendingPairMaster;
  address public lpTokenMaster;
  address public uniV3Helper;
  address public feeRecipient;
  ILendingController public lendingController;

  mapping(address => mapping(address => address)) public override pairByTokens;

  event PairCreated(address indexed pair, address indexed tokenA, address indexed tokenB);

  constructor(
    address _lendingPairMaster,
    address _lpTokenMaster,
    address _uniV3Helper,
    address _feeRecipient,
    ILendingController _lendingController
  ) {
    lendingPairMaster = _lendingPairMaster;
    lpTokenMaster     = _lpTokenMaster;
    uniV3Helper       = _uniV3Helper;
    feeRecipient      = _feeRecipient;
    lendingController = _lendingController;
  }

  function createPair(
    address _token0,
    address _token1
  ) external returns(address) {

    require(_token0 != _token1, 'PairFactory: duplicate tokens');
    require(_token0 != address(0) && _token1 != address(0), 'PairFactory: zero address');
    require(pairByTokens[_token0][_token1] == address(0), 'PairFactory: already exists');

    (address tokenA, address tokenB) = _token0 < _token1 ? (_token0, _token1) : (_token1, _token0);

    require(
      lendingController.tokenSupported(tokenA) && lendingController.tokenSupported(tokenB),
      "PairFactory: token not supported"
    );

    LendingPair lendingPair = LendingPair(payable(lendingPairMaster.clone()));

    lendingPair.initialize(
      lpTokenMaster,
      address(lendingController),
      uniV3Helper,
      feeRecipient,
      tokenA,
      tokenB
    );

    pairByTokens[tokenA][tokenB] = address(lendingPair);
    pairByTokens[tokenB][tokenA] = address(lendingPair);

    emit PairCreated(address(lendingPair), tokenA, tokenB);

    return address(lendingPair);
  }
}
