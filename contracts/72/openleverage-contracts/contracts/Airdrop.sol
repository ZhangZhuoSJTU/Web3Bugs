// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2 ;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Airdrop is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    event TrancheAdded (uint256 tranchId, bytes32 merkleRoot, uint64 startTime, uint64 endTime, uint256 totalAmount);
    event Claimed(uint256 tranchId, address account, uint256 balance);
    event TrancheExpired (uint256 tranchId, uint expireAmount);
    struct Tranche {
        bytes32 merkleRoot;
        uint64 startTime;
        uint64 endTime;
        uint256 totalAmount;
        uint256 claimedAmount;
    }

    IERC20 public token;
    mapping(uint256 => Tranche) public tranches;
    mapping(uint256 => mapping(address => bool)) public claimed;
    uint256 public trancheIdx;

    constructor (IERC20 _token){
        token = _token;
    }

    function newTranche(bytes32 merkleRoot, uint64 startTime, uint64 endTime, uint256 totalAmount) external onlyOwner
    {
        require(endTime > block.timestamp, 'Incorrect endtime');
        uint trancheId = trancheIdx;
        tranches[trancheId] = Tranche(merkleRoot, startTime, endTime, totalAmount, 0);
        trancheIdx = trancheIdx.add(1);
        emit TrancheAdded(trancheId, merkleRoot, startTime, endTime, totalAmount);
    }

    function expireTranche(uint256 _trancheId) external onlyOwner {
        Tranche memory tranche = tranches[_trancheId];
        require(block.timestamp > tranche.endTime, 'Not End');
        uint expireAmount = tranche.totalAmount.sub(tranche.claimedAmount);
        if (expireAmount > 0) {
            token.safeTransfer(owner(), expireAmount);
        }
        delete tranches[_trancheId];
        emit TrancheExpired(_trancheId, expireAmount);
    }

    function claim(address account, uint256 _trancheId, uint256 _balance, bytes32[] calldata _merkleProof) external
    {
        _claim(account, _trancheId, _balance, _merkleProof);
        _disburse(account, _balance);
    }

    function claims(address account, uint256[] calldata _trancheIds, uint256[] calldata _balances, bytes32[][] calldata _merkleProofs) external {
        uint256 len = _trancheIds.length;
        require(len == _balances.length && len == _merkleProofs.length, "Mismatching inputs");
        uint256 totalBalance = 0;
        for (uint256 i = 0; i < len; i ++) {
            _claim(account, _trancheIds[i], _balances[i], _merkleProofs[i]);
            totalBalance = totalBalance.add(_balances[i]);
        }
        _disburse(account, totalBalance);
    }

    function verifyClaim(address account, uint256 _trancheId, uint256 _balance, bytes32[] calldata _merkleProof) external view returns (bool valid) {
        return _verifyClaim(account, tranches[_trancheId].merkleRoot, _balance, _merkleProof);
    }

    function _claim(address account, uint256 _trancheId, uint256 _balance, bytes32[] memory _merkleProof) private {
        require(_trancheId < trancheIdx, "Incorrect trancheId");
        require(tranches[_trancheId].startTime < block.timestamp, "Not Start");
        require(tranches[_trancheId].endTime > block.timestamp, "Expire");
        require(!claimed[_trancheId][account], "Already claimed");
        require(_verifyClaim(account, tranches[_trancheId].merkleRoot, _balance, _merkleProof), "Incorrect merkle proof");
        claimed[_trancheId][account] = true;
        tranches[_trancheId].claimedAmount = tranches[_trancheId].claimedAmount.add(_balance);
        emit Claimed(_trancheId, account, _balance);
    }

    function _verifyClaim(address account, bytes32 root, uint256 _balance, bytes32[] memory _merkleProof) private pure returns (bool valid) {
        bytes32 leaf = keccak256(abi.encodePacked(account, _balance));
        return MerkleProof.verify(_merkleProof, root, leaf);
    }

    function _disburse(address account, uint256 _balance) private {
        if (_balance > 0) {
            token.safeTransfer(account, _balance);
        } else {
            revert("No balance would be transferred");
        }
    }
}