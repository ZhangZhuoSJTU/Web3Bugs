// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;
pragma abicoder v2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {Initializable} from "@openzeppelin/contracts/proxy/Initializable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/EnumerableSet.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import {EIP712} from "./EIP712.sol";
import {ERC1271} from "./ERC1271.sol";
import {OwnableERC721} from "./OwnableERC721.sol";
import {IRageQuit} from "../hypervisor/Hypervisor.sol";

import {IUniversalVault} from "../interfaces/IUniversalVault.sol";
import {IVisorService} from "../interfaces/IVisorService.sol";

/// @title Visor
/// @notice Vault for isolated storage of staking tokens
/// @dev Warning: not compatible with rebasing tokens
contract Visor is
    IUniversalVault,
    EIP712("UniversalVault", "1.0.0"),
    ERC1271,
    OwnableERC721,
    Initializable,
    IERC721Receiver
{
    using SafeMath for uint256;
    using Address for address;
    using Address for address payable;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /* constant */

    // Hardcoding a gas limit for rageQuit() is required to prevent gas DOS attacks
    // the gas requirement cannot be determined at runtime by querying the delegate
    // as it could potentially be manipulated by a malicious delegate who could force
    // the calls to revert.
    // The gas limit could alternatively be set upon vault initialization or creation
    // of a lock, but the gas consumption trade-offs are not favorable.
    // Ultimately, to avoid a need for fixed gas limits, the EVM would need to provide
    // an error code that allows for reliably catching out-of-gas errors on remote calls.
    uint256 public constant RAGEQUIT_GAS = 500000;
    bytes32 public constant LOCK_TYPEHASH =
        keccak256("Lock(address delegate,address token,uint256 amount,uint256 nonce)");
    bytes32 public constant UNLOCK_TYPEHASH =
        keccak256("Unlock(address delegate,address token,uint256 amount,uint256 nonce)");

    string public constant VERSION = "VISOR-2.0.3";

    /* storage */

    uint256 private _nonce;
    mapping(bytes32 => LockData) private _locks;
    EnumerableSet.Bytes32Set private _lockSet;
    string public uri;

    struct Nft {
      uint256 tokenId; 
      address nftContract;
    }

    Nft[] public nfts;
    mapping(bytes32=>bool) public nftApprovals;
    mapping(bytes32=>uint256) public erc20Approvals;

    struct TimelockERC20 {
      address recipient;
      address token;
      uint256 amount;
      uint256 expires;
    }

    mapping(bytes32=>TimelockERC20) public timelockERC20s; 
    mapping(address=>bytes32[]) public timelockERC20Keys;
    mapping(address=>uint256) public timelockERC20Balances;

    struct TimelockERC721 {
      address recipient;
      address nftContract;
      uint256 tokenId;
      uint256 expires;
    }

    mapping(bytes32=>TimelockERC721) public timelockERC721s; 
    mapping(address=>bytes32[]) public timelockERC721Keys;

    event AddNftToken(address nftContract, uint256 tokenId);
    event RemoveNftToken(address nftContract, uint256 tokenId);
    event TimeLockERC20(address recipient, address token, uint256 amount, uint256 expires);
    event TimeUnlockERC20(address recipient, address token, uint256 amount, uint256 expires);
    event TimeLockERC721(address recipient, address nftContract, uint256 tokenId, uint256 expires);
    event TimeUnlockERC721(address recipient, address nftContract, uint256 tokenId, uint256 expires);

    /* initialization function */

    function initializeLock() external initializer {}

    function initialize() external override initializer {
      OwnableERC721._setNFT(msg.sender);
    }

    /* ether receive */

    receive() external payable {}

    /* internal  */

    function _addNft(address nftContract, uint256 tokenId) internal {

      nfts.push(
        Nft({
          tokenId: tokenId,
          nftContract: nftContract
        })
      );
      emit AddNftToken(nftContract, tokenId);
    }

    function _removeNft(address nftContract, uint256 tokenId) internal {
      uint256 len = nfts.length;
      for (uint256 i = 0; i < len; i++) {
        Nft memory nftInfo = nfts[i];
        if (nftContract == nftInfo.nftContract && tokenId == nftInfo.tokenId) {
          if(i != len - 1) {
            nfts[i] = nfts[len - 1];
          }
          nfts.pop();
          emit RemoveNftToken(nftContract, tokenId);
          break;
        }
      }
    }

    function _getOwner() internal view override(ERC1271) returns (address ownerAddress) {
        return OwnableERC721.owner();
    }

    /* pure functions */

    function calculateLockID(address delegate, address token)
        public
        pure
        override
        returns (bytes32 lockID)
    {
        return keccak256(abi.encodePacked(delegate, token));
    }

    /* getter functions */

    function getPermissionHash(
        bytes32 eip712TypeHash,
        address delegate,
        address token,
        uint256 amount,
        uint256 nonce
    ) public view override returns (bytes32 permissionHash) {
        return
            EIP712._hashTypedDataV4(
                keccak256(abi.encode(eip712TypeHash, delegate, token, amount, nonce))
            );
    }

    function getNonce() external view override returns (uint256 nonce) {
        return _nonce;
    }

    function owner()
        public
        view
        override(IUniversalVault, OwnableERC721)
        returns (address ownerAddress)
    {
        return OwnableERC721.owner();
    }

    function getLockSetCount() external view override returns (uint256 count) {
        return _lockSet.length();
    }

    function getLockAt(uint256 index) external view override returns (LockData memory lockData) {
        return _locks[_lockSet.at(index)];
    }

    function getBalanceDelegated(address token, address delegate)
        external
        view
        override
        returns (uint256 balance)
    {
        return _locks[calculateLockID(delegate, token)].balance;
    }

    function getBalanceLocked(address token) public view override returns (uint256 balance) {
        uint256 count = _lockSet.length();
        for (uint256 index; index < count; index++) {
            LockData storage _lockData = _locks[_lockSet.at(index)];
            if (_lockData.token == token && _lockData.balance > balance)
                balance = _lockData.balance;
        }
        return balance;
    }

    function checkBalances() external view override returns (bool validity) {
        // iterate over all token locks and validate sufficient balance
        uint256 count = _lockSet.length();
        for (uint256 index; index < count; index++) {
            // fetch storage lock reference
            LockData storage _lockData = _locks[_lockSet.at(index)];
            // if insufficient balance and no∏t shutdown, return false
            if (IERC20(_lockData.token).balanceOf(address(this)) < _lockData.balance) return false;
        }
        // if sufficient balance or shutdown, return true
        return true;
    }

    // @notice Get ERC721 from nfts[] by index
    /// @param i nfts index of nfts[] 
    function getNftById(uint256 i) external view returns (address nftContract, uint256 tokenId) {
        require(i < nfts.length, "ID overflow");
        Nft memory ni = nfts[i];
        nftContract = ni.nftContract;
        tokenId = ni.tokenId;
    }

    // @notice Get index of ERC721 in nfts[]
    /// @param nftContract Address of ERC721 
    /// @param tokenId tokenId for NFT in nftContract 
    function getNftIdByTokenIdAndAddr(address nftContract, uint256 tokenId) external view returns(uint256) {
        uint256 len = nfts.length;
        for (uint256 i = 0; i < len; i++) {
            if (nftContract == nfts[i].nftContract && tokenId == nfts[i].tokenId) {
                return i;
            }
        }
        require(false, "Token not found");
    }

    // @notice Get number of timelocks for given ERC20 token 
    function getTimeLockCount(address token) public view returns(uint256) {
      return timelockERC20Keys[token].length;
    }

    // @notice Get number of timelocks for NFTs of a given ERC721 contract 
    function getTimeLockERC721Count(address nftContract) public view returns(uint256) {
      return timelockERC721Keys[nftContract].length;
    }

    /* user functions */

    /// @notice Lock ERC20 tokens in the vault
    /// access control: called by delegate with signed permission from owner
    /// state machine: anytime
    /// state scope:
    /// - insert or update _locks
    /// - increase _nonce
    /// token transfer: none
    /// @param token Address of token being locked
    /// @param amount Amount of tokens being locked
    /// @param permission Permission signature payload
    function lock(
        address token,
        uint256 amount,
        bytes calldata permission
    )
        external
        override
        onlyValidSignature(
            getPermissionHash(LOCK_TYPEHASH, msg.sender, token, amount, _nonce),
            permission
        )
    {
        // get lock id
        bytes32 lockID = calculateLockID(msg.sender, token);

        // add lock to storage
        if (_lockSet.contains(lockID)) {
            // if lock already exists, increase amount
            _locks[lockID].balance = _locks[lockID].balance.add(amount);
        } else {
            // if does not exist, create new lock
            // add lock to set
            assert(_lockSet.add(lockID));
            // add lock data to storage
            _locks[lockID] = LockData(msg.sender, token, amount);
        }

        // validate sufficient balance
        require(
            IERC20(token).balanceOf(address(this)) >= _locks[lockID].balance,
            "UniversalVault: insufficient balance"
        );

        // increase nonce
        _nonce += 1;

        // emit event
        emit Locked(msg.sender, token, amount);
    }

    /// @notice Unlock ERC20 tokens in the vault
    /// access control: called by delegate with signed permission from owner
    /// state machine: after valid lock from delegate
    /// state scope:
    /// - remove or update _locks
    /// - increase _nonce
    /// token transfer: none
    /// @param token Address of token being unlocked
    /// @param amount Amount of tokens being unlocked
    /// @param permission Permission signature payload
    function unlock(
        address token,
        uint256 amount,
        bytes calldata permission
    )
        external
        override
        onlyValidSignature(
            getPermissionHash(UNLOCK_TYPEHASH, msg.sender, token, amount, _nonce),
            permission
        )
    {
        // get lock id
        bytes32 lockID = calculateLockID(msg.sender, token);

        // validate existing lock
        require(_lockSet.contains(lockID), "UniversalVault: missing lock");

        // update lock data
        if (_locks[lockID].balance > amount) {
            // substract amount from lock balance
            _locks[lockID].balance = _locks[lockID].balance.sub(amount);
        } else {
            // delete lock data
            delete _locks[lockID];
            assert(_lockSet.remove(lockID));
        }

        // increase nonce
        _nonce += 1;

        // emit event
        emit Unlocked(msg.sender, token, amount);
    }

    /// @notice Forcibly cancel delegate lock
    /// @dev This function will attempt to notify the delegate of the rage quit using
    ///      a fixed amount of gas.
    /// access control: only owner
    /// state machine: after valid lock from delegate
    /// state scope:
    /// - remove item from _locks
    /// token transfer: none
    /// @param delegate Address of delegate
    /// @param token Address of token being unlocked
    function rageQuit(address delegate, address token)
        external
        override
        onlyOwner
        returns (bool notified, string memory error)
    {
        // get lock id
        bytes32 lockID = calculateLockID(delegate, token);

        // validate existing lock
        require(_lockSet.contains(lockID), "UniversalVault: missing lock");

        // attempt to notify delegate
        if (delegate.isContract()) {
            // check for sufficient gas
            require(gasleft() >= RAGEQUIT_GAS, "UniversalVault: insufficient gas");

            // attempt rageQuit notification
            try IRageQuit(delegate).rageQuit{gas: RAGEQUIT_GAS}() {
                notified = true;
            } catch Error(string memory res) {
                notified = false;
                error = res;
            } catch (bytes memory) {
                notified = false;
            }
        }

        // update lock storage
        assert(_lockSet.remove(lockID));
        delete _locks[lockID];

        // emit event
        emit RageQuit(delegate, token, notified, error);
    }

    function setURI(string memory _uri) public onlyOwner {
      uri = _uri;
    }

    /// @notice Transfer ERC20 tokens out of vault
    /// access control: only owner
    /// state machine: when balance >= max(lock) + amount
    /// state scope: none
    /// token transfer: transfer any token
    /// @param token Address of token being transferred
    /// @param to Address of the to
    /// @param amount Amount of tokens to transfer
    function transferERC20(
        address token,
        address to,
        uint256 amount
    ) external override onlyOwner {
        // check for sufficient balance
        require(
            IERC20(token).balanceOf(address(this)) >= (getBalanceLocked(token).add(amount)).add(timelockERC20Balances[token]),
            "UniversalVault: insufficient balance"
        );
        // perform transfer
        TransferHelper.safeTransfer(token, to, amount);
    }

    // @notice Approve delegate account to transfer ERC20 tokens out of vault
    /// @param token Address of token being transferred
    /// @param delegate Address being approved
    /// @param amount Amount of tokens approved to transfer
    function approveTransferERC20(address token, address delegate, uint256 amount) external onlyOwner {
      erc20Approvals[keccak256(abi.encodePacked(delegate, token))] = amount;
    }

    /// @notice Transfer ERC20 tokens out of vault with an approved account
    /// access control: only approved accounts in erc20Approvals 
    /// state machine: when balance >= max(lock) + amount
    /// state scope: none
    /// token transfer: transfer any token
    /// @param token Address of token being transferred
    /// @param to Address of the to
    /// @param amount Amount of tokens to transfer
    function delegatedTransferERC20(
        address token,
        address to,
        uint256 amount
    ) external {
        if(msg.sender != _getOwner()) {

        require( 
            erc20Approvals[keccak256(abi.encodePacked(msg.sender, token))] >= amount,
            "Account not approved to transfer amount"); 
        } 

        // check for sufficient balance
        require(
            IERC20(token).balanceOf(address(this)) >= (getBalanceLocked(token).add(amount)).add(timelockERC20Balances[token]),
            "UniversalVault: insufficient balance"
        );
        erc20Approvals[keccak256(abi.encodePacked(msg.sender, token))] = erc20Approvals[keccak256(abi.encodePacked(msg.sender, token))].sub(amount);
        
        // perform transfer
        TransferHelper.safeTransfer(token, to, amount);
    }

    /// @notice Transfer ETH out of vault
    /// access control: only owner
    /// state machine: when balance >= amount
    /// state scope: none
    /// token transfer: transfer any token
    /// @param to Address of the to
    /// @param amount Amount of ETH to transfer
    function transferETH(address to, uint256 amount) external payable override onlyOwner {
      // perform transfer
      TransferHelper.safeTransferETH(to, amount);
    }

    // @notice Approve delegate account to transfer ERC721 token out of vault
    /// @param delegate Account address being approved to transfer nft  
    /// @param nftContract address of nft minter 
    /// @param tokenId token id of the nft instance 
    function approveTransferERC721(
      address delegate, 
      address nftContract, 
      uint256 tokenId
    ) external onlyOwner {
      nftApprovals[keccak256(abi.encodePacked(delegate, nftContract, tokenId))] = true;
    }

    /// @notice Transfer ERC721 out of vault
    /// access control: only owner or approved
    /// ERC721 transfer: transfer any ERC721 token
    /// @param to recipient address 
    /// @param nftContract address of nft minter 
    /// @param tokenId token id of the nft instance 
    function transferERC721(
        address to,
        address nftContract,
        uint256 tokenId
    ) external {
        if(msg.sender != _getOwner()) {
          require( nftApprovals[keccak256(abi.encodePacked(msg.sender, nftContract, tokenId))], "NFT not approved for transfer"); 
        } 

        for(uint256 i=0; i<timelockERC721Keys[nftContract].length; i++) {
          if(tokenId == timelockERC721s[timelockERC721Keys[nftContract][i]].tokenId) {
              require(
                timelockERC721s[timelockERC721Keys[nftContract][i]].expires <= block.timestamp, 
                "NFT locked and not expired"
              );
              require( timelockERC721s[timelockERC721Keys[nftContract][i]].recipient == msg.sender, "NFT locked and must be withdrawn by timelock recipient");
          }
        }

        _removeNft(nftContract, tokenId);
        IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
    }

    // @notice Adjust nfts[] on ERC721 token recieved 
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata) external override returns (bytes4) {
      _addNft(msg.sender, tokenId);
      return IERC721Receiver.onERC721Received.selector;
    }

    // @notice Lock ERC721 in vault until expires, redeemable by recipient
    /// @param recipient Address with right to withdraw after expires 
    /// @param nftContract address of nft minter 
    /// @param tokenId Token id of the nft instance 
    /// @param expires Timestamp when recipient is allowed to withdraw 
    function timeLockERC721(address recipient, address nftContract, uint256 tokenId, uint256 expires) public onlyOwner {

      require(
        expires > block.timestamp, 
        "Expires must be in future"
      );
 
      bytes32 key = keccak256(abi.encodePacked(recipient, nftContract, tokenId, expires)); 

      require(
        timelockERC721s[key].expires == 0,
        "TimelockERC721 already exists"
      );
     
      timelockERC721s[key] = TimelockERC721({
          recipient: recipient,
          nftContract: nftContract,
          tokenId: tokenId,
          expires: expires
      });

      timelockERC721Keys[nftContract].push(key);

      IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);
      emit TimeLockERC20(recipient, nftContract, tokenId, expires);
    }

    // @notice Withdraw ERC721 in vault post expires by recipient
    /// @param recipient Address with right to withdraw after expires 
    /// @param nftContract address of nft minter 
    /// @param tokenId Token id of the nft instance 
    /// @param expires Timestamp when recipient is allowed to withdraw
    function timeUnlockERC721(address recipient, address nftContract, uint256 tokenId, uint256 expires) public {

      bytes32 key = keccak256(abi.encodePacked(recipient, nftContract, tokenId, expires)); 
      require(
        timelockERC721s[key].expires <= block.timestamp,
        "Not expired yet"
      );

      require(msg.sender == timelockERC721s[key].recipient, "Not recipient");

      _removeNft(nftContract, tokenId);
      delete timelockERC721s[key];

      IERC721(nftContract).safeTransferFrom(address(this), recipient, tokenId);
      emit TimeUnlockERC721(recipient, nftContract, tokenId, expires);
    }

    // @notice Lock ERC720 amount in vault until expires, redeemable by recipient
    /// @param recipient Address with right to withdraw after expires 
    /// @param token Address of token to lock 
    /// @param amount Amount of token to lock 
    /// @param expires Timestamp when recipient is allowed to withdraw
    function timeLockERC20(address recipient, address token, uint256 amount, uint256 expires) public onlyOwner {

      require(
        IERC20(token).allowance(msg.sender, address(this)) >= amount, 
        "Amount not approved"
      );

      require(
        expires > block.timestamp, 
        "Expires must be in future"
      );

      bytes32 key = keccak256(abi.encodePacked(recipient, token, amount, expires)); 

      require(
        timelockERC20s[key].expires == 0,
        "TimelockERC20 already exists"
      );
    
      timelockERC20s[key] = TimelockERC20({
          recipient: recipient,
          token: token,
          amount: amount,
          expires: expires
      });
      timelockERC20Keys[token].push(key);
      timelockERC20Balances[token] = timelockERC20Balances[token].add(amount);
      IERC20(token).transferFrom(msg.sender, address(this), amount);
      emit TimeLockERC20(recipient, token, amount, expires);
    }

    // @notice Withdraw ERC20 from vault post expires by recipient
    /// @param recipient Address with right to withdraw after expires 
    /// @param token Address of token to lock 
    /// @param amount Amount of token to lock 
    /// @param expires Timestamp when recipient is allowed to withdraw
    function timeUnlockERC20(address recipient, address token, uint256 amount, uint256 expires) public {

      require(
        IERC20(token).balanceOf(address(this)) >= getBalanceLocked(token).add(amount),
        "Insufficient balance"
      );

      bytes32 key = keccak256(abi.encodePacked(recipient, token, amount, expires)); 
      require(
        timelockERC20s[key].expires <= block.timestamp,
        "Not expired yet"
      );

      require(msg.sender == timelockERC20s[key].recipient, "Not recipient");
      
      delete timelockERC20s[key];

      timelockERC20Balances[token] = timelockERC20Balances[token].sub(amount);
      TransferHelper.safeTransfer(token, recipient, amount);
      emit TimeUnlockERC20(recipient, token, amount, expires);
    }

}
