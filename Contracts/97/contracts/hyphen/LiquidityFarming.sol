// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/interfaces/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./metatx/ERC2771ContextUpgradeable.sol";

import "../security/Pausable.sol";
import "./interfaces/ILPToken.sol";
import "./interfaces/ILiquidityProviders.sol";

contract HyphenLiquidityFarming is
    Initializable,
    ERC2771ContextUpgradeable,
    OwnableUpgradeable,
    Pausable,
    ReentrancyGuardUpgradeable,
    IERC721ReceiverUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    ILPToken public lpToken;
    ILiquidityProviders public liquidityProviders;

    struct NFTInfo {
        address payable staker;
        uint256 rewardDebt;
        uint256 unpaidRewards;
        bool isStaked;
    }

    struct PoolInfo {
        uint256 accTokenPerShare;
        uint256 lastRewardTime;
    }

    struct RewardsPerSecondEntry {
        uint256 rewardsPerSecond;
        uint256 timestamp;
    }

    /// @notice Mapping to track the rewarder pool.
    mapping(address => PoolInfo) public poolInfo;

    /// @notice Info of each NFT that is staked.
    mapping(uint256 => NFTInfo) public nftInfo;

    /// @notice Reward rate per base token
    //mapping(address => uint256) public rewardPerSecond;

    /// @notice Reward Token
    mapping(address => address) public rewardTokens;

    /// @notice Staker => NFTs staked
    mapping(address => uint256[]) public nftIdsStaked;

    /// @notice Token => Total Shares Staked
    mapping(address => uint256) public totalSharesStaked;

    /// @notice Token => Reward Rate Updation history
    mapping(address => RewardsPerSecondEntry[]) public rewardRateLog;

    uint256 private constant ACC_TOKEN_PRECISION = 1e12;
    address internal constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event LogDeposit(address indexed user, address indexed baseToken, uint256 nftId);
    event LogWithdraw(address indexed user, address baseToken, uint256 nftId, address indexed to);
    event LogOnReward(address indexed user, address indexed baseToken, uint256 amount, address indexed to);
    event LogUpdatePool(address indexed baseToken, uint256 lastRewardTime, uint256 lpSupply, uint256 accToken1PerShare);
    event LogRewardPerSecond(address indexed baseToken, uint256 rewardPerSecond);
    event LogRewardPoolInitialized(address _baseToken, address _rewardToken, uint256 _rewardPerSecond);
    event LogNativeReceived(address indexed sender, uint256 value);

    function initialize(
        address _trustedForwarder,
        address _pauser,
        ILiquidityProviders _liquidityProviders,
        ILPToken _lpToken
    ) public initializer {
        __ERC2771Context_init(_trustedForwarder);
        __Ownable_init();
        __Pausable_init(_pauser);
        __ReentrancyGuard_init();
        liquidityProviders = _liquidityProviders;
        lpToken = _lpToken;
    }

    /// @notice Initialize the rewarder pool.
    /// @param _baseToken Base token to be used for the rewarder pool.
    /// @param _rewardToken Reward token to be used for the rewarder pool.
    /// @param _rewardPerSecond Reward rate per base token.
    function initalizeRewardPool(
        address _baseToken,
        address _rewardToken,
        uint256 _rewardPerSecond
    ) external onlyOwner {
        require(rewardTokens[_baseToken] == address(0), "ERR__POOL_ALREADY_INITIALIZED");
        require(_baseToken != address(0), "ERR__BASE_TOKEN_IS_ZERO");
        require(_rewardToken != address(0), "ERR_REWARD_TOKEN_IS_ZERO");
        rewardTokens[_baseToken] = _rewardToken;
        rewardRateLog[_baseToken].push(RewardsPerSecondEntry(_rewardPerSecond, block.timestamp));
        emit LogRewardPoolInitialized(_baseToken, _rewardToken, _rewardPerSecond);
    }

    function _sendErc20AndGetSentAmount(
        IERC20Upgradeable _token,
        uint256 _amount,
        address _to
    ) private returns (uint256) {
        uint256 recepientBalance = _token.balanceOf(_to);
        _token.safeTransfer(_to, _amount);
        return _token.balanceOf(_to) - recepientBalance;
    }

    /// @notice Update the reward state of a nft, and if possible send reward funds to _to.
    /// @param _nftId NFT ID that is being locked
    /// @param _to Address to which rewards will be credited.
    function _sendRewardsForNft(uint256 _nftId, address payable _to) internal {
        NFTInfo storage nft = nftInfo[_nftId];
        require(nft.isStaked, "ERR__NFT_NOT_STAKED");

        (address baseToken, , uint256 amount) = lpToken.tokenMetadata(_nftId);
        amount /= liquidityProviders.BASE_DIVISOR();

        PoolInfo memory pool = updatePool(baseToken);
        uint256 pending;
        uint256 amountSent;
        if (amount > 0) {
            pending = ((amount * pool.accTokenPerShare) / ACC_TOKEN_PRECISION) - nft.rewardDebt + nft.unpaidRewards;
            if (rewardTokens[baseToken] == NATIVE) {
                uint256 balance = address(this).balance;
                if (pending > balance) {
                    unchecked {
                        nft.unpaidRewards = pending - balance;
                    }
                    (bool success, ) = _to.call{value: balance}("");
                    require(success, "ERR__NATIVE_TRANSFER_FAILED");
                    amountSent = balance;
                } else {
                    nft.unpaidRewards = 0;
                    (bool success, ) = _to.call{value: pending}("");
                    require(success, "ERR__NATIVE_TRANSFER_FAILED");
                    amountSent = pending;
                }
            } else {
                IERC20Upgradeable rewardToken = IERC20Upgradeable(rewardTokens[baseToken]);
                uint256 balance = rewardToken.balanceOf(address(this));
                if (pending > balance) {
                    unchecked {
                        nft.unpaidRewards = pending - balance;
                    }
                    amountSent = _sendErc20AndGetSentAmount(rewardToken, balance, _to);
                } else {
                    nft.unpaidRewards = 0;
                    amountSent = _sendErc20AndGetSentAmount(rewardToken, pending, _to);
                }
            }
        }
        nft.rewardDebt = (amount * pool.accTokenPerShare) / ACC_TOKEN_PRECISION;
        emit LogOnReward(_msgSender(), baseToken, amountSent, _to);
    }

    /// @notice Sets the sushi per second to be distributed. Can only be called by the owner.
    /// @param _rewardPerSecond The amount of Sushi to be distributed per second.
    function setRewardPerSecond(address _baseToken, uint256 _rewardPerSecond) public onlyOwner {
        rewardRateLog[_baseToken].push(RewardsPerSecondEntry(_rewardPerSecond, block.timestamp));
        emit LogRewardPerSecond(_baseToken, _rewardPerSecond);
    }

    /// @notice Allows owner to reclaim/withdraw any tokens (including reward tokens) held by this contract
    /// @param _token Token to reclaim, use 0x00 for Ethereum
    /// @param _amount Amount of tokens to reclaim
    /// @param _to Receiver of the tokens, first of his name, rightful heir to the lost tokens,
    /// reightful owner of the extra tokens, and ether, protector of mistaken transfers, mother of token reclaimers,
    /// the Khaleesi of the Great Token Sea, the Unburnt, the Breaker of blockchains.
    function reclaimTokens(
        address _token,
        uint256 _amount,
        address payable _to
    ) external nonReentrant onlyOwner {
        require(_to != address(0), "ERR__TO_IS_ZERO");
        if (_token == NATIVE) {
            (bool success, ) = payable(_to).call{value: _amount}("");
            require(success, "ERR__NATIVE_TRANSFER_FAILED");
        } else {
            IERC20Upgradeable(_token).safeTransfer(_to, _amount);
        }
    }

    /// @notice Deposit LP tokens
    /// @param _nftId LP token nftId to deposit.
    function deposit(uint256 _nftId, address payable _to) external whenNotPaused nonReentrant {
        address msgSender = _msgSender();

        require(
            lpToken.isApprovedForAll(msgSender, address(this)) || lpToken.getApproved(_nftId) == address(this),
            "ERR__NOT_APPROVED"
        );

        (address baseToken, , uint256 amount) = lpToken.tokenMetadata(_nftId);
        amount /= liquidityProviders.BASE_DIVISOR();

        require(rewardTokens[baseToken] != address(0), "ERR__POOL_NOT_INITIALIZED");
        require(rewardRateLog[baseToken].length != 0, "ERR__POOL_NOT_INITIALIZED");

        NFTInfo storage nft = nftInfo[_nftId];
        require(!nft.isStaked, "ERR__NFT_ALREADY_STAKED");

        lpToken.safeTransferFrom(msgSender, address(this), _nftId);

        PoolInfo memory pool = updatePool(baseToken);
        nft.isStaked = true;
        nft.staker = _to;
        nft.rewardDebt = (amount * pool.accTokenPerShare) / ACC_TOKEN_PRECISION;

        nftIdsStaked[_to].push(_nftId);
        totalSharesStaked[baseToken] += amount;

        emit LogDeposit(msgSender, baseToken, _nftId);
    }

    /// @notice Withdraw LP tokens
    /// @param _nftId LP token nftId to withdraw.
    /// @param _to The receiver of `amount` withdraw benefit.
    function withdraw(uint256 _nftId, address payable _to) external whenNotPaused nonReentrant {
        address msgSender = _msgSender();
        uint256 nftsStakedLength = nftIdsStaked[msgSender].length;
        uint256 index;
        for (index = 0; index < nftsStakedLength; ++index) {
            if (nftIdsStaked[msgSender][index] == _nftId) {
                break;
            }
        }

        require(index != nftsStakedLength, "ERR__NFT_NOT_STAKED");
        nftIdsStaked[msgSender][index] = nftIdsStaked[msgSender][nftIdsStaked[msgSender].length - 1];
        nftIdsStaked[msgSender].pop();

        _sendRewardsForNft(_nftId, _to);
        delete nftInfo[_nftId];

        (address baseToken, , uint256 amount) = lpToken.tokenMetadata(_nftId);
        amount /= liquidityProviders.BASE_DIVISOR();
        totalSharesStaked[baseToken] -= amount;

        lpToken.safeTransferFrom(address(this), msgSender, _nftId);

        emit LogWithdraw(msgSender, baseToken, _nftId, _to);
    }

    /// @notice Extract all rewards without withdrawing LP tokens
    /// @param _nftId LP token nftId for which rewards are to be withdrawn
    /// @param _to The receiver of withdraw benefit.
    function extractRewards(uint256 _nftId, address payable _to) external whenNotPaused nonReentrant {
        require(nftInfo[_nftId].staker == _msgSender(), "ERR__NOT_OWNER");
        _sendRewardsForNft(_nftId, _to);
    }

    /// @notice Calculates an up to date value of accTokenPerShare
    /// @notice An updated value of accTokenPerShare is comitted to storage every time a new NFT is deposited, withdrawn or rewards are extracted
    function getUpdatedAccTokenPerShare(address _baseToken) public view returns (uint256) {
        uint256 accumulator = 0;
        uint256 lastUpdatedTime = poolInfo[_baseToken].lastRewardTime;
        uint256 counter = block.timestamp;
        uint256 i = rewardRateLog[_baseToken].length - 1;
        while (true) {
            if (lastUpdatedTime >= counter) {
                break;
            }
            unchecked {
                accumulator +=
                    rewardRateLog[_baseToken][i].rewardsPerSecond *
                    (counter - max(lastUpdatedTime, rewardRateLog[_baseToken][i].timestamp));
            }
            counter = rewardRateLog[_baseToken][i].timestamp;
            if (i == 0) {
                break;
            }
            --i;
        }

        // We know that during all the periods that were included in the current iterations,
        // the value of totalSharesStaked[_baseToken] would not have changed, as we only consider the
        // updates to the pool that happened after the lastUpdatedTime.
        accumulator = (accumulator * ACC_TOKEN_PRECISION) / totalSharesStaked[_baseToken];
        return accumulator + poolInfo[_baseToken].accTokenPerShare;
    }

    /// @notice View function to see pending Token
    /// @param _nftId NFT for which pending tokens are to be viewed
    /// @return pending reward for a given user.
    function pendingToken(uint256 _nftId) external view returns (uint256) {
        NFTInfo storage nft = nftInfo[_nftId];
        if (!nft.isStaked) {
            return 0;
        }

        (address baseToken, , uint256 amount) = lpToken.tokenMetadata(_nftId);
        amount /= liquidityProviders.BASE_DIVISOR();

        PoolInfo memory pool = poolInfo[baseToken];
        uint256 accToken1PerShare = pool.accTokenPerShare;
        if (block.timestamp > pool.lastRewardTime && totalSharesStaked[baseToken] != 0) {
            accToken1PerShare = getUpdatedAccTokenPerShare(baseToken);
        }
        return ((amount * accToken1PerShare) / ACC_TOKEN_PRECISION) - nft.rewardDebt + nft.unpaidRewards;
    }

    /// @notice Update reward variables of the given pool.
    /// @return pool Returns the pool that was updated.
    function updatePool(address _baseToken) public whenNotPaused returns (PoolInfo memory pool) {
        pool = poolInfo[_baseToken];
        if (block.timestamp > pool.lastRewardTime) {
            if (totalSharesStaked[_baseToken] > 0) {
                pool.accTokenPerShare = getUpdatedAccTokenPerShare(_baseToken);
            }
            pool.lastRewardTime = block.timestamp;
            poolInfo[_baseToken] = pool;
            emit LogUpdatePool(_baseToken, pool.lastRewardTime, totalSharesStaked[_baseToken], pool.accTokenPerShare);
        }
    }

    /// @notice View function to see the tokens staked by a given user.
    /// @param _user Address of user.
    function getNftIdsStaked(address _user) public view returns (uint256[] memory nftIds) {
        nftIds = nftIdsStaked[_user];
    }

    function getRewardRatePerSecond(address _baseToken) public view returns (uint256) {
        return rewardRateLog[_baseToken][rewardRateLog[_baseToken].length - 1].rewardsPerSecond;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override(IERC721ReceiverUpgradeable) returns (bytes4) {
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (address sender)
    {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (bytes calldata)
    {
        return ERC2771ContextUpgradeable._msgData();
    }

    receive() external payable {
        emit LogNativeReceived(_msgSender(), msg.value);
    }

    function max(uint256 _a, uint256 _b) private pure returns (uint256) {
        return _a >= _b ? _a : _b;
    }
}
