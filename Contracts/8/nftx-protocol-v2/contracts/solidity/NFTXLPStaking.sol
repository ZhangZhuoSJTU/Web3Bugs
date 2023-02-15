// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./interface/INFTXVaultFactory.sol";
import "./interface/INFTXFeeDistributor.sol";
import "./token/IERC20Upgradeable.sol";
import "./util/SafeERC20Upgradeable.sol";
import "./util/OwnableUpgradeable.sol";
import "./proxy/ClonesUpgradeable.sol";
import "./proxy/Initializable.sol";
import "./StakingTokenProvider.sol";
import "./token/RewardDistributionTokenUpgradeable.sol";

// Author: 0xKiwi.

contract NFTXLPStaking is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    INFTXVaultFactory public nftxVaultFactory;
    INFTXFeeDistributor public feeDistributor;
    RewardDistributionTokenUpgradeable public rewardDistTokenImpl;
    StakingTokenProvider public stakingTokenProvider;

    event PoolCreated(uint256 vaultId, address pool);
    event PoolUpdated(uint256 vaultId, address pool);
    event FeesReceived(uint256 vaultId, uint256 amount);

    struct StakingPool {
        address stakingToken;
        address rewardToken;
    }
    mapping(uint256 => StakingPool) public vaultStakingInfo;

    function __NFTXLPStaking__init(address _stakingTokenProvider) external initializer {
        __Ownable_init();
        rewardDistTokenImpl = new RewardDistributionTokenUpgradeable();
        rewardDistTokenImpl.__RewardDistributionToken_init(IERC20Upgradeable(address(0)), "", "");
        stakingTokenProvider = StakingTokenProvider(_stakingTokenProvider);
    }

    modifier onlyAdmin() {
        require(msg.sender == owner() || msg.sender == address(feeDistributor), "LPStaking: Not authorized");
        _;
    }

    function setNFTXVaultFactory(address newFactory) external onlyOwner {
        require(newFactory != address(0));
        nftxVaultFactory = INFTXVaultFactory(newFactory);
    }

    function setFeeDistributor(address newDistributor) external onlyOwner {
        require(newDistributor != address(0));
        feeDistributor = INFTXFeeDistributor(newDistributor);
    }

    function setStakingTokenProvider(address newProvider) external onlyOwner {
        require(newProvider != address(0));
        stakingTokenProvider = StakingTokenProvider(newProvider);
    }

    // Consider changing LP staking to take vault id into consideration, and access data from there.
    function addPoolForVault(uint256 vaultId) external onlyAdmin {
        require(vaultStakingInfo[vaultId].stakingToken == address(0), "LPStaking: Pool already exists");
        address _rewardToken = nftxVaultFactory.vault(vaultId);
        address _stakingToken = stakingTokenProvider.stakingTokenForVaultToken(_rewardToken);
        StakingPool memory pool = StakingPool(_stakingToken, _rewardToken);
        vaultStakingInfo[vaultId] = pool;
        address newRewardDistToken = _deployDividendToken(pool);
        emit PoolCreated(vaultId, newRewardDistToken);
    }

    function updatePoolForVaults(uint256[] calldata vaultIds) external {
        for (uint256 i = 0; i < vaultIds.length; i++) {
            updatePoolForVault(vaultIds[i]);
        }
    }

    // TODO: REDUCE DUPLICATION HERE
    // In case the provider changes, this lets the pool be updated.
    function updatePoolForVault(uint256 vaultId) public {
        StakingPool memory pool = vaultStakingInfo[vaultId];
        require(pool.stakingToken != address(0), "LPStaking: Pool doesn't exist");
        address _stakingToken = stakingTokenProvider.stakingTokenForVaultToken(pool.rewardToken);
        if (_stakingToken == pool.stakingToken) {
            return;
        }
        StakingPool memory newPool = StakingPool(_stakingToken, pool.rewardToken);
        vaultStakingInfo[vaultId] = newPool;
        address newRewardDistToken = _deployDividendToken(newPool);
        emit PoolUpdated(vaultId, newRewardDistToken);
    }

    function receiveRewards(uint256 vaultId, uint256 amount) external onlyAdmin returns (bool) {
        StakingPool memory pool = vaultStakingInfo[vaultId];
        if (pool.stakingToken == address(0)) {
            // In case the pair is updated, but not yet 
            return false;
        }
        
        RewardDistributionTokenUpgradeable rewardDistToken = _rewardDistributionTokenAddr(pool);
        // Don't distribute rewards unless there are people to distribute to.
        if (rewardDistToken.totalSupply() == 0) {
            return false;
        }
        // We "pull" to the dividend tokens so the vault only needs to approve this contract.
        IERC20Upgradeable(pool.rewardToken).transferFrom(msg.sender, address(rewardDistToken), amount);
        rewardDistToken.distributeRewards(amount);
        emit FeesReceived(vaultId, amount);
        return true;
    }

    function deposit(uint256 vaultId, uint256 amount) external {
        // Check the pool in case its been updated.
        updatePoolForVault(vaultId);
        StakingPool memory pool = vaultStakingInfo[vaultId];
        require(pool.stakingToken != address(0), "LPStaking: Nonexistent pool");
        require(IERC20Upgradeable(pool.stakingToken).transferFrom(msg.sender, address(this), amount));
        _rewardDistributionTokenAddr(pool).mint(msg.sender, amount);
    }

    function exit(uint256 vaultId) external {
        StakingPool memory pool = vaultStakingInfo[vaultId];
        require(pool.stakingToken != address(0), "LPStaking: Nonexistent pool");
        _claimRewards(pool, msg.sender);
        _withdraw(pool, balanceOf(vaultId, msg.sender), msg.sender);
    }

    function emergencyExitAndClaim(address _stakingToken, address _rewardToken) external {
        StakingPool memory pool = StakingPool(_stakingToken, _rewardToken);
        _claimRewards(pool, msg.sender);
        RewardDistributionTokenUpgradeable dist = _rewardDistributionTokenAddr(pool);
        _withdraw(pool, dist.balanceOf(msg.sender), msg.sender);
    }

    function emergencyExit(address _stakingToken, address _rewardToken) external {
        StakingPool memory pool = StakingPool(_stakingToken, _rewardToken);
        RewardDistributionTokenUpgradeable dist = _rewardDistributionTokenAddr(pool);
        _withdraw(pool, dist.balanceOf(msg.sender), msg.sender);
    }

    function withdraw(uint256 vaultId, uint256 amount) external {
        StakingPool memory pool = vaultStakingInfo[vaultId];
        require(pool.stakingToken != address(0), "LPStaking: Nonexistent pool");
        _withdraw(pool, amount, msg.sender);
    }

    function claimRewards(uint256 vaultId) external {
        StakingPool memory pool = vaultStakingInfo[vaultId];
        require(pool.stakingToken != address(0), "LPStaking: Nonexistent pool");
        _claimRewards(pool, msg.sender);
    }

    function rewardDistributionToken(uint256 vaultId) external view returns (RewardDistributionTokenUpgradeable) {
        StakingPool memory pool = vaultStakingInfo[vaultId];
        if (pool.stakingToken == address(0)) {
            return RewardDistributionTokenUpgradeable(address(0));
        }
        return _rewardDistributionTokenAddr(pool);
    }

    function safeRewardDistributionToken(uint256 vaultId) external view returns (address) {
        StakingPool memory pool = vaultStakingInfo[vaultId];
        require(pool.stakingToken != address(0), "LPStaking: Nonexistent pool");
        return address(_rewardDistributionTokenAddr(pool));
    }

    function balanceOf(uint256 vaultId, address addr) public view returns (uint256) {
        StakingPool memory pool = vaultStakingInfo[vaultId];
        RewardDistributionTokenUpgradeable dist = _rewardDistributionTokenAddr(pool);
        return dist.balanceOf(addr);
    }

    function _deployDividendToken(StakingPool memory pool) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(pool.stakingToken, pool.rewardToken));
        address rewardDistToken = ClonesUpgradeable.cloneDeterministic(address(rewardDistTokenImpl), salt);
        string memory name = stakingTokenProvider.nameForStakingToken(pool.rewardToken);
        RewardDistributionTokenUpgradeable(rewardDistToken).__RewardDistributionToken_init(IERC20Upgradeable(pool.rewardToken), name, name);
        return rewardDistToken;
    }

    function _claimRewards(StakingPool memory pool, address account) internal {
        _rewardDistributionTokenAddr(pool).withdrawReward(account);
    }

    function _withdraw(StakingPool memory pool, uint256 amount, address account) internal {
        _rewardDistributionTokenAddr(pool).burnFrom(account, amount);
        IERC20Upgradeable(pool.stakingToken).transfer(account, amount);
    }

    // Note: this function does not guarantee the token is deployed, we leave that check to elsewhere to save gas.
    function _rewardDistributionTokenAddr(StakingPool memory pool) internal view returns (RewardDistributionTokenUpgradeable) {
        bytes32 salt = keccak256(abi.encodePacked(pool.stakingToken, pool.rewardToken));
        address tokenAddr = ClonesUpgradeable.predictDeterministicAddress(address(rewardDistTokenImpl), salt);
        return RewardDistributionTokenUpgradeable(tokenAddr);
    }
}