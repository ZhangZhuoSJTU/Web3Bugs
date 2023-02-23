// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IDepositHook.sol";
import "./interfaces/IDepositRecord.sol";
import "prepo-shared-contracts/contracts/AccountListCaller.sol";
import "prepo-shared-contracts/contracts/NFTScoreRequirement.sol";
import "prepo-shared-contracts/contracts/TokenSenderCaller.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract DepositHook is IDepositHook, AccountListCaller, NFTScoreRequirement, TokenSenderCaller, SafeAccessControlEnumerable {
  ICollateral private collateral;
  IDepositRecord private depositRecord;
  bool public override depositsAllowed;

  bytes32 public constant SET_COLLATERAL_ROLE = keccak256("DepositHook_setCollateral(address)");
  bytes32 public constant SET_DEPOSIT_RECORD_ROLE = keccak256("DepositHook_setDepositRecord(address)");
  bytes32 public constant SET_DEPOSITS_ALLOWED_ROLE = keccak256("DepositHook_setDepositsAllowed(bool)");
  bytes32 public constant SET_ACCOUNT_LIST_ROLE = keccak256("DepositHook_setAccountList(IAccountList)");
  bytes32 public constant SET_REQUIRED_SCORE_ROLE = keccak256("DepositHook_setRequiredScore(uint256)");
  bytes32 public constant SET_COLLECTION_SCORES_ROLE = keccak256("DepositHook_setCollectionScores(IERC721[],uint256[])");
  bytes32 public constant REMOVE_COLLECTIONS_ROLE = keccak256("DepositHook_removeCollections(IERC721[])");
  bytes32 public constant SET_TREASURY_ROLE = keccak256("DepositHook_setTreasury(address)");
  bytes32 public constant SET_TOKEN_SENDER_ROLE = keccak256("DepositHook_setTokenSender(ITokenSender)");

  modifier onlyCollateral() {
    require(msg.sender == address(collateral), "msg.sender != collateral");
    _;
  }

  /**
   * @dev Utilizes NFT-based requirement checks only if the depositor is not
   * within an external allowlist.
   * 
   * Records the deposit within `depositRecord`, and sends the fee to the
   * `_treasury`. Fees will be reimbursed to the user in `PPO` token using the
   * `_tokenSender` contract.
   *
   * Uses `_amountAfterFee` for updating global net deposits since the fee is
   * not counted towards the Collateral minted and thus is not a liability.
   */
  function hook(address _sender, uint256 _amountBeforeFee, uint256 _amountAfterFee) external override onlyCollateral {
    require(depositsAllowed, "deposits not allowed");
    if (!_accountList.isIncluded(_sender)) require(_satisfiesScoreRequirement(_sender), "depositor not allowed");
    depositRecord.recordDeposit(_sender, _amountAfterFee);
    uint256 _fee = _amountBeforeFee - _amountAfterFee;
    if (_fee > 0) {
      collateral.getBaseToken().transferFrom(address(collateral), _treasury, _fee);
      _tokenSender.send(_sender, _fee);
    }
  }

  function setCollateral(ICollateral _newCollateral) external override onlyRole(SET_COLLATERAL_ROLE) {
    collateral = _newCollateral;
    emit CollateralChange(address(_newCollateral));
  }

  function setDepositRecord(IDepositRecord _newDepositRecord) external override onlyRole(SET_DEPOSIT_RECORD_ROLE) {
    depositRecord = _newDepositRecord;
    emit DepositRecordChange(address(_newDepositRecord));
  }

  function setDepositsAllowed(bool _newDepositsAllowed) external override onlyRole(SET_DEPOSITS_ALLOWED_ROLE) {
    depositsAllowed = _newDepositsAllowed;
    emit DepositsAllowedChange(_newDepositsAllowed);
  }

  function setAccountList(IAccountList accountList) public override onlyRole(SET_ACCOUNT_LIST_ROLE) { super.setAccountList(accountList); }

  function setRequiredScore(uint256 _newRequiredScore) public override onlyRole(SET_REQUIRED_SCORE_ROLE) { super.setRequiredScore(_newRequiredScore); }

  function setCollectionScores(IERC721[] memory _collections, uint256[] memory _scores) public override onlyRole(SET_COLLECTION_SCORES_ROLE) { super.setCollectionScores(_collections, _scores); }

  function removeCollections(IERC721[] memory _collections) public override onlyRole(REMOVE_COLLECTIONS_ROLE) { super.removeCollections(_collections); }

  function setTreasury(address _treasury) public override onlyRole(SET_TREASURY_ROLE) { super.setTreasury(_treasury); }

  function setTokenSender(ITokenSender _tokenSender) public override onlyRole(SET_TOKEN_SENDER_ROLE) { super.setTokenSender(_tokenSender); }

  function getCollateral() external view override returns (ICollateral) { return collateral; }

  function getDepositRecord() external view override returns (IDepositRecord) { return depositRecord; }
}
