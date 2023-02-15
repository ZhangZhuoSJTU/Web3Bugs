// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "./interface/INFTXLPStaking.sol";
import "./interface/INFTXFeeDistributor.sol";
import "./interface/INFTXVaultFactory.sol";
import "./token/IERC20Upgradeable.sol";
import "./util/SafeERC20Upgradeable.sol";
import "./util/SafeMathUpgradeable.sol";
import "./util/PausableUpgradeable.sol";

import "hardhat/console.sol";

contract NFTXFeeDistributor is INFTXFeeDistributor, PausableUpgradeable {

  using SafeERC20Upgradeable for IERC20Upgradeable;

  bool public distributionPaused;

  address public override nftxVaultFactory;
  address public override lpStaking;
  address public override treasury;
  uint256 public override defaultTreasuryAlloc;
  uint256 public override defaultLPAlloc;

  mapping(uint256 => uint256) public override allocTotal;
  mapping(uint256 => uint256) public override specificTreasuryAlloc;
  mapping(uint256 => FeeReceiver[]) feeReceivers;

  event AddFeeReceiver(uint256 vaultId, address receiver, uint256 allocPoint);
  event FeeReceiverAllocChange(uint256 vaultId, address receiver, uint256 allocPoint);
  event RemoveFeeReceiver(uint256 vaultId, address receiver);
  
  function __FeeDistributor__init__(address _lpStaking, address _treasury) public override initializer {
    __Pausable_init();
    lpStaking = _lpStaking;
    treasury = _treasury; 
    defaultTreasuryAlloc = 0.2 ether;
    defaultLPAlloc = 0.5 ether;
  }

  function rescue(address token) external override onlyOwner {
    uint256 balance = IERC20Upgradeable(token).balanceOf(address(this));
    IERC20Upgradeable(token).transfer(msg.sender, balance);
  }

  function distribute(uint256 vaultId) external override {
    require(nftxVaultFactory != address(0));
    address _vault = INFTXVaultFactory(nftxVaultFactory).vault(vaultId);

    uint256 tokenBalance = IERC20Upgradeable(_vault).balanceOf(address(this));
    if (tokenBalance <= 10**9) {
      return;
    }
    // Leave some balance for dust since we know we have more than 10**9.
    tokenBalance -= 1000;
    
    uint256 _treasuryAlloc = specificTreasuryAlloc[vaultId];
    if (_treasuryAlloc == 0) {
      _treasuryAlloc = defaultTreasuryAlloc;
    }

    uint256 _allocTotal = allocTotal[vaultId] + _treasuryAlloc;
    uint256 amountToSend = tokenBalance * _treasuryAlloc / _allocTotal;
    amountToSend = amountToSend > tokenBalance ? tokenBalance : amountToSend;
    IERC20Upgradeable(_vault).safeTransfer(treasury, amountToSend);

    if (distributionPaused) {
      return;
    } 

    FeeReceiver[] memory _feeReceivers = feeReceivers[vaultId];
    for (uint256 i = 0; i < _feeReceivers.length; i++) {
      _sendForReceiver(_feeReceivers[i], vaultId, _vault, tokenBalance, _allocTotal);
    } 
  }

  function addReceiver(uint256 _vaultId, uint256 _allocPoint, address _receiver, bool _isContract) external override onlyOwner  {
    _addReceiver(_vaultId, _allocPoint, _receiver, _isContract);
  }

  function initializeVaultReceivers(uint256 _vaultId) external override {
    require(msg.sender == nftxVaultFactory, "FeeReceiver: not factory");
    _addReceiver(_vaultId, defaultLPAlloc, lpStaking, true);
    INFTXLPStaking(lpStaking).addPoolForVault(_vaultId);
  }

  function changeReceiverAlloc(uint256 _vaultId, uint256 _receiverIdx, uint256 _allocPoint) external override onlyOwner {
    FeeReceiver storage feeReceiver = feeReceivers[_vaultId][_receiverIdx];
    allocTotal[_vaultId] -= feeReceiver.allocPoint;
    feeReceiver.allocPoint = _allocPoint;
    allocTotal[_vaultId] += _allocPoint;
    emit FeeReceiverAllocChange(_vaultId, feeReceiver.receiver, _allocPoint);
  }

  function changeReceiverAddress(uint256 _vaultId, uint256 _receiverIdx, address _address, bool _isContract) external override onlyOwner {
    FeeReceiver storage feeReceiver = feeReceivers[_vaultId][_receiverIdx];
    feeReceiver.receiver = _address;
    feeReceiver.isContract = _isContract;
  }

  function removeReceiver(uint256 _vaultId, uint256 _receiverIdx) external override onlyOwner {
    FeeReceiver[] storage feeReceiversForVault = feeReceivers[_vaultId];
    uint256 arrLength = feeReceiversForVault.length;
    require(_receiverIdx < arrLength, "FeeDistributor: Out of bounds");
    emit RemoveFeeReceiver(_vaultId, feeReceiversForVault[_receiverIdx].receiver);
    allocTotal[_vaultId] -= feeReceiversForVault[_receiverIdx].allocPoint;
    feeReceiversForVault[_receiverIdx] = feeReceiversForVault[arrLength-1];
    feeReceiversForVault.pop();
  }

  function setTreasuryAddress(address _treasury) external override onlyOwner {
    treasury = _treasury;
  }

  function setDefaultTreasuryAlloc(uint256 _allocPoint) external override onlyOwner {
    defaultTreasuryAlloc = _allocPoint;
  }

  function setSpecificTreasuryAlloc(uint256 vaultId, uint256 _allocPoint) external override onlyOwner {
    specificTreasuryAlloc[vaultId] = _allocPoint;
  }

  function setLPStakingAddress(address _lpStaking) external override onlyOwner {
    lpStaking = _lpStaking;
  }

  function setNFTXVaultFactory(address _factory) external override onlyOwner {
    nftxVaultFactory = _factory;
  }

  function setDefaultLPAlloc(uint256 _allocPoint) external override onlyOwner {
    defaultLPAlloc = _allocPoint;
  }

  function pauseFeeDistribution(bool pause) external onlyOwner {
    distributionPaused = pause;
  }

  function rescueTokens(uint256 _address) external override onlyOwner {
    uint256 balance = IERC20Upgradeable(_address).balanceOf(address(this));
    IERC20Upgradeable(_address).transfer(msg.sender, balance);
  }

  function _addReceiver(uint256 _vaultId, uint256 _allocPoint, address _receiver, bool _isContract) internal  {
    allocTotal[_vaultId] += _allocPoint;
    FeeReceiver memory _feeReceiver = FeeReceiver(_allocPoint, _receiver, _isContract);
    feeReceivers[_vaultId].push(_feeReceiver);
    emit AddFeeReceiver(_vaultId, _receiver, _allocPoint);
  }

  function _sendForReceiver(FeeReceiver memory _receiver, uint256 _vaultId, address _vault, uint256 _tokenBalance, uint256 _allocTotal) internal {
    uint256 amountToSend = _tokenBalance * _receiver.allocPoint / _allocTotal;
    // If we're at this point we know we have more than enough to perform this safely.
    uint256 balance = IERC20Upgradeable(_vault).balanceOf(address(this)) - 1000;
    amountToSend = amountToSend > balance ? balance : amountToSend;
    if (_receiver.isContract) {
      IERC20Upgradeable(_vault).approve(_receiver.receiver, amountToSend);
      // If the receive is not properly processed, send it to the treasury instead.
       
      bytes memory payload = abi.encodeWithSelector(INFTXLPStaking.receiveRewards.selector, _vaultId, amountToSend);
      (bool success, bytes memory returnData) = address(_receiver.receiver).call(payload);
      bool tokensReceived = abi.decode(returnData, (bool));
      if (!success || !tokensReceived) {
        console.log("treasury fallback");
        IERC20Upgradeable(_vault).safeTransfer(treasury, amountToSend);
      }
    } else {
      IERC20Upgradeable(_vault).safeTransfer(_receiver.receiver, amountToSend);
    }
  }
} 