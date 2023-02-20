pragma solidity 0.6.12;

import "../interfaces/IERC20.sol";
import "../Utils/SafeMathPlus.sol";
import "../Utils/SafeTransfer.sol";
import "../OpenZeppelin/math/SafeMath.sol";
import "../OpenZeppelin/utils/EnumerableSet.sol";


contract TokenVault is SafeTransfer {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Struct representing each batch of tokens locked in the vault.
    struct Item {
        uint256 amount;
        uint256 unlockTime;
        address owner;
        uint256 userIndex;
    }

    /// @notice Struct that keeps track of assets belonging to a particular user.
    struct UserInfo {
        mapping(address => uint256[]) lockToItems;
        EnumerableSet.AddressSet lockedItemsWithUser;
    }

    /// @notice Mapping from user address to UserInfo struct.
    mapping (address => UserInfo) users;

    /// @notice Id number of the vault deposit.
    uint256 public depositId;

    /// @notice An array of all the deposit Ids.
    uint256[] public allDepositIds;

    /// @notice Mapping from item Id to the Item struct.
    mapping (uint256 => Item) public lockedItem;

    /// @notice Emitted when tokens are locked inside the vault.
    event onLock(address tokenAddress, address user, uint256 amount);

    /// @notice Emitted when tokens are unlocked from the vault.
    event onUnlock(address tokenAddress,uint256 amount);

    /**
     * @notice Function for locking tokens in the vault.
     * @param _tokenAddress Address of the token locked.
     * @param _amount Number of tokens locked.
     * @param _unlockTime Timestamp number marking when tokens get unlocked.
     * @param _withdrawer Address where tokens can be withdrawn after unlocking.
     */
    function lockTokens(
        address _tokenAddress,
        uint256 _amount,
        uint256 _unlockTime,
        address payable _withdrawer
    )
        public returns (uint256 _id)
    {
        require(_amount > 0, 'token amount is Zero');
        require(_unlockTime < 10000000000, 'Enter an unix timestamp in seconds, not miliseconds');
        _safeTransferFrom(_tokenAddress, msg.sender, _amount);

        _id = ++depositId;

        lockedItem[_id].amount = _amount;
        lockedItem[_id].unlockTime = _unlockTime;
        lockedItem[_id].owner = _withdrawer;

        allDepositIds.push(_id);

        UserInfo storage userItem = users[_withdrawer];
        userItem.lockedItemsWithUser.add(_tokenAddress);
        userItem.lockToItems[_tokenAddress].push(_id);
        uint256 userIndex = userItem.lockToItems[_tokenAddress].length - 1;
        lockedItem[_id].userIndex = userIndex;

        emit onLock(_tokenAddress, msg.sender,lockedItem[_id].amount);
    }

    /**
     * @notice Function for withdrawing tokens from the vault.
     * @param _tokenAddress Address of the token to withdraw.
     * @param _index Index number of the list with Ids.
     * @param _id Id number.
     * @param _amount Number of tokens to withdraw.
     */
    function withdrawTokens(
        address _tokenAddress,
        uint256 _index,
        uint256 _id,
        uint256 _amount
    )
        external
    {
        require(_amount > 0, 'token amount is Zero');
        uint256 id = users[msg.sender].lockToItems[_tokenAddress][_index];
        Item storage userItem = lockedItem[id];
        require(id == _id && userItem.owner == msg.sender, 'LOCK MISMATCH');
        require(userItem.unlockTime < block.timestamp, 'Not unlocked yet');
        userItem.amount = userItem.amount.sub(_amount);

        if(userItem.amount == 0) {
            uint256[] storage userItems = users[msg.sender].lockToItems[_tokenAddress];
            userItems[_index] = userItems[userItems.length -1];
            userItems.pop();
        }

        _safeTransfer(_tokenAddress, msg.sender, _amount);

        emit onUnlock(_tokenAddress, _amount);
    }

    /**
     * @notice Function to retrieve data from the Item under user index number.
     * @param _index Index number of the list with Item ids.
     * @param _tokenAddress Address of the token corresponding to this Item.
     * @param _user User address.
     * @return Items token amount number, Items unlock timestamp, Items owner address, Items Id number
     */
    function getItemAtUserIndex(
        uint256 _index,
        address _tokenAddress,
        address _user
    )
        external view returns (uint256, uint256, address, uint256)
    {
        uint256 id = users[_user].lockToItems[_tokenAddress][_index];
        Item storage item = lockedItem[id];
        return (item.amount, item.unlockTime, item.owner, id);
    }

    /**
     * @notice Function to retrieve token address at desired index for the specified user.
     * @param _user User address.
     * @param _index Index number.
     * @return Token address.
     */
    function getUserLockedItemAtIndex(address _user, uint256 _index) external view returns (address) {
        UserInfo storage user = users[_user];
        return user.lockedItemsWithUser.at(_index);
    }

    /**
     * @notice Function to retrieve all the data from Item struct under given Id.
     * @param _id Id number.
     * @return All the data for this Id (token amount number, unlock time number, owner address and user index number)
     */
    function getLockedItemAtId(uint256 _id) external view returns (uint256, uint256, address, uint256) {
        Item storage item = lockedItem[_id];
        return (item.amount, item.unlockTime, item.owner, item.userIndex);
    }
}
