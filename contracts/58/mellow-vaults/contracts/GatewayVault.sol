// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IGatewayVault.sol";
import "./interfaces/IGatewayVaultGovernance.sol";
import "./Vault.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Vault that combines several integration layer Vaults into one Vault.
contract GatewayVault is IERC721Receiver, IGatewayVault, Vault {
    using SafeERC20 for IERC20;
    uint256[] internal _subvaultNfts;
    mapping(uint256 => uint256) internal _subvaultNftsIndex;

    /// @notice Creates a new contract.
    /// @dev All subvault nfts must be owned by this vault before.
    /// @param vaultGovernance_ Reference to VaultGovernance for this vault
    /// @param vaultTokens_ ERC20 tokens under Vault management
    constructor(IVaultGovernance vaultGovernance_, address[] memory vaultTokens_)
        Vault(vaultGovernance_, vaultTokens_)
    {}

    /// @inheritdoc IGatewayVault
    function subvaultNfts() external view returns (uint256[] memory) {
        return _subvaultNfts;
    }

    /// @inheritdoc Vault
    function tvl() public view override(IVault, Vault) returns (uint256[] memory tokenAmounts) {
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        tokenAmounts = new uint256[](_vaultTokens.length);
        for (uint256 i = 0; i < _subvaultNfts.length; i++) {
            IVault vault = IVault(registry.vaultForNft(_subvaultNfts[i]));
            uint256[] memory vTokenAmounts = vault.tvl();
            for (uint256 j = 0; j < _vaultTokens.length; j++) {
                tokenAmounts[j] += vTokenAmounts[j];
            }
        }
    }

    /// @inheritdoc IGatewayVault
    function subvaultTvl(uint256 vaultNum) public view override returns (uint256[] memory) {
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        IVault vault = IVault(registry.vaultForNft(_subvaultNfts[vaultNum]));
        return vault.tvl();
    }

    /// @inheritdoc IGatewayVault
    function subvaultsTvl() public view override returns (uint256[][] memory tokenAmounts) {
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        uint256 vaultTokensLength = _vaultTokens.length;
        tokenAmounts = new uint256[][](_subvaultNfts.length);
        for (uint256 i = 0; i < _subvaultNfts.length; i++) {
            IVault vault = IVault(registry.vaultForNft(_subvaultNfts[i]));
            uint256[] memory vTokenAmounts = vault.tvl();
            tokenAmounts[i] = new uint256[](vaultTokensLength);
            for (uint256 j = 0; j < vaultTokensLength; j++) {
                tokenAmounts[i][j] = vTokenAmounts[j];
            }
        }
    }

    /// @inheritdoc IGatewayVault
    function hasSubvault(address vault) external view override returns (bool) {
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        uint256 nft_ = registry.nftForVault(vault);
        return (_subvaultNftsIndex[nft_] > 0 || _subvaultNfts[0] == nft_);
    }

    /// @inheritdoc IGatewayVault
    function addSubvaults(uint256[] memory nfts) external {
        require(msg.sender == address(_vaultGovernance), ExceptionsLibrary.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE);
        require(_subvaultNfts.length == 0, ExceptionsLibrary.SUB_VAULT_INITIALIZED);
        require(nfts.length > 0, ExceptionsLibrary.SUB_VAULT_LENGTH);
        address[] memory selfTokens = _vaultTokens;
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        for (uint256 i = 0; i < nfts.length; i++) {
            uint256 nft_ = nfts[i];
            require(nft_ > 0, ExceptionsLibrary.NFT_ZERO);
            IVault vault = IVault(registry.vaultForNft(nft_));
            address[] memory vTokens = vault.vaultTokens();
            require(selfTokens.length == vTokens.length, ExceptionsLibrary.INCONSISTENT_LENGTH);
            for (uint256 j = 0; j < selfTokens.length; j++) {
                require(selfTokens[j] == vTokens[j], ExceptionsLibrary.NOT_VAULT_TOKEN);
            }
            _subvaultNfts.push(nft_);
            _subvaultNftsIndex[nft_] = i;
        }
    }

    function setApprovalsForStrategy(address strategy, uint256[] memory nfts) external {
        require(msg.sender == address(_vaultGovernance), ExceptionsLibrary.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE);
        require(strategy != address(0), ExceptionsLibrary.ZERO_STRATEGY_ADDRESS);
        IVaultRegistry vaultRegistry = IVaultGovernance(_vaultGovernance).internalParams().registry;
        for (uint i = 0; i < nfts.length; ++i)
            vaultRegistry.approve(strategy, nfts[i]);
    }

    function onERC721Received(
        address,
        address,
        uint256 tokenId,
        bytes calldata
    ) external nonReentrant returns (bytes4) {
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        require(msg.sender == address(registry), ExceptionsLibrary.NFT_VAULT_REGISTRY);
        registry.lockNft(tokenId);
        return this.onERC721Received.selector;
    }

    function _push(uint256[] memory tokenAmounts, bytes memory options)
        internal
        override
        returns (uint256[] memory actualTokenAmounts)
    {
        require(_subvaultNfts.length > 0, ExceptionsLibrary.INITIALIZATION);
        bool optimized;
        bytes[] memory vaultsOptions;
        (optimized, vaultsOptions) = _parseOptions(options);

        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        uint256[][] memory tvls = subvaultsTvl();
        uint256[] memory totalTvl = new uint256[](_vaultTokens.length);
        uint256[][] memory amountsByVault = CommonLibrary.splitAmounts(tokenAmounts, tvls);
        IGatewayVaultGovernance.DelayedStrategyParams memory strategyParams = IGatewayVaultGovernance(
            address(_vaultGovernance)
        ).delayedStrategyParams(_nft);
        if (optimized && strategyParams.redirects.length > 0) {
            for (uint256 i = 0; i < _subvaultNfts.length; i++) {
                if (strategyParams.redirects[i] == 0) {
                    continue;
                }
                for (uint256 j = 0; j < _vaultTokens.length; j++) {
                    uint256 vaultIndex = _subvaultNftsIndex[strategyParams.redirects[i]];
                    amountsByVault[vaultIndex][j] += amountsByVault[i][j];
                    amountsByVault[i][j] = 0;
                }
            }
        }
        actualTokenAmounts = new uint256[](_vaultTokens.length);
        for (uint256 i = 0; i < _subvaultNfts.length; i++) {
            if (optimized && (strategyParams.redirects[i] != 0)) {
                continue;
            }
            IVault vault = IVault(registry.vaultForNft(_subvaultNfts[i]));
            for (uint256 j = 0; j < _vaultTokens.length; j++) {
                if (amountsByVault[i][j] > 0) {
                    _allowTokenIfNecessary(_vaultTokens[j], address(vault));
                }
            }
            uint256[] memory actualVaultTokenAmounts = vault.transferAndPush(
                address(this),
                _vaultTokens,
                amountsByVault[i],
                vaultsOptions[i]
            );
            for (uint256 j = 0; j < _vaultTokens.length; j++) {
                actualTokenAmounts[j] += actualVaultTokenAmounts[j];
                totalTvl[j] += tvls[i][j];
            }
        }
        uint256[] memory _limits = IGatewayVaultGovernance(address(_vaultGovernance)).strategyParams(_nft).limits;
        for (uint256 i = 0; i < _vaultTokens.length; i++) {
            require(totalTvl[i] + actualTokenAmounts[i] < _limits[i], ExceptionsLibrary.LIMIT_OVERFLOW);
        }
    }

    function _pull(
        address to,
        uint256[] memory tokenAmounts,
        bytes memory options
    ) internal override returns (uint256[] memory actualTokenAmounts) {
        (bool optimized, bytes[] memory vaultsOptions) = _parseOptions(options);

        require(_subvaultNfts.length > 0, ExceptionsLibrary.INITIALIZATION);
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        uint256[][] memory tvls = subvaultsTvl();
        uint256[][] memory amountsByVault = CommonLibrary.splitAmounts(tokenAmounts, tvls);
        uint256[] memory _redirects = IGatewayVaultGovernance(address(_vaultGovernance))
            .delayedStrategyParams(_nft)
            .redirects;

        if (optimized && (_redirects.length > 0)) {
            for (uint256 i = 0; i < _subvaultNfts.length; i++) {
                if (_redirects[i] == 0) {
                    continue;
                }
                for (uint256 j = 0; j < _vaultTokens.length; j++) {
                    uint256 vaultIndex = _subvaultNftsIndex[_redirects[i]];
                    amountsByVault[vaultIndex][j] += amountsByVault[i][j];
                    amountsByVault[i][j] = 0;
                }
            }
        }
        actualTokenAmounts = new uint256[](_vaultTokens.length);
        for (uint256 i = 0; i < _subvaultNfts.length; i++) {
            IVault vault = IVault(registry.vaultForNft(_subvaultNfts[i]));
            uint256[] memory actualVaultTokenAmounts = vault.pull(
                to,
                _vaultTokens,
                amountsByVault[i],
                vaultsOptions[i]
            );
            for (uint256 j = 0; j < _vaultTokens.length; j++) {
                actualTokenAmounts[j] += actualVaultTokenAmounts[j];
            }
        }
    }

    function _allowTokenIfNecessary(address token, address to) internal {
        if (IERC20(token).allowance(address(this), address(to)) < type(uint256).max / 2) {
            IERC20(token).approve(address(to), type(uint256).max);
        }
    }

    function _parseOptions(bytes memory options) internal view returns (bool, bytes[] memory) {
        if (options.length == 0) {
            return (false, new bytes[](_subvaultNfts.length));
        }
        return abi.decode(options, (bool, bytes[]));
    }

    event CollectProtocolFees(address protocolTreasury, address[] tokens, uint256[] amounts);
    event CollectStrategyFees(address strategyTreasury, address[] tokens, uint256[] amounts);
}
