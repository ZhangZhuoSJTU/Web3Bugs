// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./libraries/CommonLibrary.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IProtocolGovernance.sol";
import "./interfaces/ILpIssuer.sol";
import "./DefaultAccessControl.sol";
import "./LpIssuerGovernance.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Contract that mints and burns LP tokens in exchange for ERC20 liquidity.
contract LpIssuer is IERC721Receiver, ILpIssuer, ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 private _subvaultNft;
    IVaultGovernance internal _vaultGovernance;
    address[] internal _vaultTokens;
    mapping(address => bool) internal _vaultTokensIndex;
    uint256 private _nft;
    uint256[] private _lpPriceHighWaterMarks;
    uint256[] private _existentials;

    uint256 public lastFeeCharge;

    /// @notice Creates a new contract.
    /// @dev All subvault nfts must be owned by this vault before.
    /// @param vaultGovernance_ Reference to VaultGovernance for this vault
    /// @param vaultTokens_ ERC20 tokens under Vault management
    /// @param name_ Name of the ERC-721 token
    /// @param symbol_ Symbol of the ERC-721 token
    constructor(
        IVaultGovernance vaultGovernance_,
        address[] memory vaultTokens_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        require(CommonLibrary.isSortedAndUnique(vaultTokens_), ExceptionsLibrary.SORTED_AND_UNIQUE);
        _vaultGovernance = vaultGovernance_;
        _vaultTokens = vaultTokens_;
        for (uint256 i = 0; i < vaultTokens_.length; i++) {
            address token = vaultTokens_[i];
            _vaultTokensIndex[token] = true;
            _lpPriceHighWaterMarks.push(0);
            _existentials.push(10**(ERC20(token).decimals() / 2));
        }
        lastFeeCharge = block.timestamp;
    }

    function vaultGovernance() external view returns (IVaultGovernance) {
        return _vaultGovernance;
    }

    function vaultTokens() external view returns (address[] memory) {
        return _vaultTokens;
    }

    function existentials() external view returns (uint256[] memory) {
        return _existentials;
    }

    /// @inheritdoc ILpIssuer
    function subvaultNft() external view returns (uint256) {
        return _subvaultNft;
    }

    function nft() external view returns (uint256) {
        return _nft;
    }

    function initialize(uint256 nft_) external {
        require(msg.sender == address(_vaultGovernance), ExceptionsLibrary.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE);
        require(nft_> 0, ExceptionsLibrary.NFT_ZERO);
        require(_nft == 0, ExceptionsLibrary.INITIALIZATION);
        _nft = nft_;
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        registry.setApprovalForAll(address(registry), true);
    }

    /// @inheritdoc ILpIssuer
    function deposit(uint256[] calldata tokenAmounts, bytes memory options) external nonReentrant {
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        uint256 thisNft = _nft;
        require(thisNft > 0, ExceptionsLibrary.INITIALIZATION);
        require(_subvaultNft > 0, ExceptionsLibrary.INITIALIZE_SUB_VAULT);
        require(registry.ownerOf(thisNft) == address(this), ExceptionsLibrary.INITIALIZE_OWNER);
        IVault subvault = _subvault();
        uint256[] memory existentials_ = _existentials;
        uint256[] memory tvl = subvault.tvl(); //pre-money
        uint256 supply = totalSupply();
        uint256 balanceFactor = CommonLibrary.PRICE_DENOMINATOR;
        if (supply > 0) {
            // This is lpTokens if total supply == CommonLibrary.PRICE_DENOMINATOR
            balanceFactor = _getLpAmount(tvl, tokenAmounts, existentials_, CommonLibrary.PRICE_DENOMINATOR);
        }

        // If with that big supply we don't reveive any lps then it doesn't make sense to continue
        require(balanceFactor > 0, "BF");
        uint256[] memory balancedAmounts = new uint256[](tokenAmounts.length);

        // Making sure the proportion between tokenAmounts and tvl are the same
        for (uint256 i = 0; i < _vaultTokens.length; i++) {
            balancedAmounts[i] = _getBalancedAmount(tvl[i], tokenAmounts[i], existentials_[i], balanceFactor, supply);
            _allowTokenIfNecessary(_vaultTokens[i], address(subvault));
            IERC20(_vaultTokens[i]).safeTransferFrom(msg.sender, address(this), balancedAmounts[i]);
        }

        uint256[] memory actualTokenAmounts = subvault.transferAndPush(
            address(this),
            _vaultTokens,
            balancedAmounts,
            options
        );
        uint256 amountToMint = _getLpAmount(tvl, actualTokenAmounts, existentials_, supply);

        require(amountToMint > 0, "ZLP");

        require(
            amountToMint + balanceOf(msg.sender) <=
                ILpIssuerGovernance(address(_vaultGovernance)).strategyParams(thisNft).tokenLimitPerAddress,
            ExceptionsLibrary.LIMIT_PER_ADDRESS
        );

        _chargeFees(thisNft, tvl, supply, actualTokenAmounts, amountToMint, false);
        _mint(msg.sender, amountToMint);

        for (uint256 i = 0; i < _vaultTokens.length; i++) {
            if (balancedAmounts[i] > actualTokenAmounts[i]) {
                IERC20(_vaultTokens[i]).safeTransfer(msg.sender, balancedAmounts[i] - actualTokenAmounts[i]);
            }
        }

        emit Deposit(msg.sender, _vaultTokens, actualTokenAmounts, amountToMint);
    }

    /// @inheritdoc ILpIssuer
    function withdraw(
        address to,
        uint256 lpTokenAmount,
        bytes memory options
    ) external nonReentrant {
        uint256 supply = totalSupply();
        require(supply > 0, ExceptionsLibrary.TOTAL_SUPPLY_IS_ZERO);
        uint256[] memory tokenAmounts = new uint256[](_vaultTokens.length);
        uint256[] memory tvl = _subvault().tvl();
        for (uint256 i = 0; i < _vaultTokens.length; i++) {
            tokenAmounts[i] = (lpTokenAmount * tvl[i]) / supply;
        }
        uint256[] memory actualTokenAmounts = _subvault().pull(address(this), _vaultTokens, tokenAmounts, options);
        for (uint256 i = 0; i < _vaultTokens.length; i++) {
            if (actualTokenAmounts[i] == 0) {
                continue;
            }
            IERC20(_vaultTokens[i]).safeTransfer(to, actualTokenAmounts[i]);
        }
        _chargeFees(_nft, tvl, supply, actualTokenAmounts, lpTokenAmount, true);
        _burn(msg.sender, lpTokenAmount);
        emit Withdraw(msg.sender, _vaultTokens, actualTokenAmounts, lpTokenAmount);
    }

    /// @inheritdoc ILpIssuer
    function addSubvault(uint256 nft_) external {
        require(msg.sender == address(_vaultGovernance), ExceptionsLibrary.SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE);
        require(_subvaultNft == 0, ExceptionsLibrary.SUB_VAULT_INITIALIZED);
        require(nft_ > 0, ExceptionsLibrary.NFT_ZERO);
        _subvaultNft = nft_;
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

    function _allowTokenIfNecessary(address token, address to) internal {
        if (IERC20(token).allowance(address(to), address(this)) < type(uint256).max / 2) {
            IERC20(token).approve(address(to), type(uint256).max);
        }
    }

    function _subvault() internal view returns (IVault) {
        return IVault(_vaultGovernance.internalParams().registry.vaultForNft(_subvaultNft));
    }

    /// @dev We don't charge on any deposit / withdraw to save gas.
    /// While this introduce some error, the charge always goes for lower lp token supply (pre-deposit / post-withdraw)
    /// So the error results in slightly lower management fees than in exact case
    function _chargeFees(
        uint256 thisNft,
        uint256[] memory tvls,
        uint256 supply,
        uint256[] memory deltaTvls,
        uint256 deltaSupply,
        bool isWithdraw
    ) internal {
        ILpIssuerGovernance vg = ILpIssuerGovernance(address(_vaultGovernance));
        uint256 elapsed = block.timestamp - lastFeeCharge;
        if (elapsed < vg.delayedProtocolParams().managementFeeChargeDelay) {
            return;
        }
        lastFeeCharge = block.timestamp;
        uint256 baseSupply = supply;
        if (isWithdraw) {
            baseSupply = 0;
            if (supply > deltaSupply) {
                baseSupply = supply - deltaSupply;
            }
        }

        if (baseSupply == 0) {
            for (uint256 i = 0; i < tvls.length; i++) {
                _lpPriceHighWaterMarks[i] = (deltaTvls[i] * CommonLibrary.PRICE_DENOMINATOR) / deltaSupply;
            }
            return;
        }

        uint256[] memory baseTvls = new uint256[](tvls.length);
        for (uint256 i = 0; i < baseTvls.length; i++) {
            if (isWithdraw) {
                baseTvls[i] = tvls[i] - deltaTvls[i];
            } else {
                baseTvls[i] = tvls[i];
            }
        }

        ILpIssuerGovernance.DelayedStrategyParams memory strategyParams = vg.delayedStrategyParams(thisNft);
        if (strategyParams.managementFee > 0) {
            uint256 toMint = (strategyParams.managementFee * baseSupply * elapsed) /
                (CommonLibrary.DENOMINATOR * CommonLibrary.YEAR);
            _mint(strategyParams.strategyTreasury, toMint);
            emit ManagementFeesCharged(strategyParams.strategyTreasury, strategyParams.managementFee, toMint);
        }
        uint256 protocolFee = vg.delayedProtocolPerVaultParams(thisNft).protocolFee;
        if (protocolFee > 0) {
            address treasury = vg.internalParams().protocolGovernance.protocolTreasury();
            uint256 toMint = (protocolFee * baseSupply * elapsed) / (CommonLibrary.DENOMINATOR * CommonLibrary.YEAR);
            _mint(treasury, toMint);
            emit ProtocolFeesCharged(treasury, protocolFee, toMint);
        }
        uint256 performanceFee = strategyParams.performanceFee;
        uint256[] memory hwms = _lpPriceHighWaterMarks;
        if (performanceFee > 0) {
            uint256 minLpPriceFactor = type(uint256).max;
            for (uint256 i = 0; i < baseTvls.length; i++) {
                uint256 hwm = hwms[i];
                uint256 lpPrice = (baseTvls[i] * CommonLibrary.PRICE_DENOMINATOR) / baseSupply;
                if (lpPrice > hwm) {
                    uint256 delta = (lpPrice * CommonLibrary.DENOMINATOR) / hwm;
                    if (delta < minLpPriceFactor) {
                        minLpPriceFactor = delta;
                    }
                } else {
                    // not eligible for performance fees
                    return;
                }
            }
            for (uint256 i = 0; i < tvls.length; i++) {
                _lpPriceHighWaterMarks[i] += (hwms[i] * minLpPriceFactor) / CommonLibrary.DENOMINATOR;
            }
            address treasury = strategyParams.strategyPerformanceTreasury;
            uint256 toMint = (baseSupply * minLpPriceFactor) / CommonLibrary.DENOMINATOR;
            _mint(treasury, toMint);
            emit PerformanceFeesCharged(treasury, performanceFee, toMint);
        }
    }

    function _getLpAmount(
        uint256[] memory tvl,
        uint256[] memory amounts,
        uint256[] memory existentials_,
        uint256 supply
    ) internal pure returns (uint256 lpAmount) {
        lpAmount = 0;
        if (supply == 0) {
            // On init lpToken = max(tokenAmounts)
            for (uint256 i = 0; i < tvl.length; i++) {
                if (amounts[i] > lpAmount) {
                    lpAmount = amounts[i];
                }
            }
            return lpAmount;
        }
        for (uint256 i = 0; i < tvl.length; i++) {
            if (amounts[i] <= existentials_[i]) {
                // skip existential deposits for lp share calculation
                continue;
            }
            uint256 tokenLpAmount = (amounts[i] * supply) / tvl[i];
            // take min of meaningful tokenLp amounts
            if ((tokenLpAmount < lpAmount) || (lpAmount == 0)) {
                lpAmount = tokenLpAmount;
            }
        }
    }

    function _getBalancedAmount(
        uint256 tvl,
        uint256 amount,
        uint256 existential,
        uint256 balanceFactor,
        uint256 supply
    ) internal pure returns (uint256) {
        if (supply == 0) {
            // skip normalization on init
            return amount;
        }
        if (amount < existential) {
            // avoid putting small amounts as it can introduce unnecessary harsh errors
            // one should provide amount > existential deposit each time tvl is not 0
            require(tvl == 0, "PN");
            return 0;
        }
        // normalize amount
        uint256 res = (tvl * balanceFactor) / CommonLibrary.PRICE_DENOMINATOR;
        if (res > amount) {
            res = amount;
        }
        return res;
    }

    /// @notice Emitted when management fees are charged
    /// @param treasury Treasury receiver of the fee
    /// @param feeRate Fee percent applied denominated in 10 ** 9
    /// @param amount Amount of lp token minted
    event ManagementFeesCharged(address indexed treasury, uint256 feeRate, uint256 amount);

    /// @notice Emitted when protocol fees are charged
    /// @param treasury Treasury receiver of the fee
    /// @param feeRate Fee percent applied denominated in 10 ** 9
    /// @param amount Amount of lp token minted
    event ProtocolFeesCharged(address indexed treasury, uint256 feeRate, uint256 amount);

    /// @notice Emitted when performance fees are charged
    /// @param treasury Treasury receiver of the fee
    /// @param feeRate Fee percent applied denominated in 10 ** 9
    /// @param amount Amount of lp token minted
    event PerformanceFeesCharged(address indexed treasury, uint256 feeRate, uint256 amount);

    /// @notice Emitted when liquidity is deposited
    /// @param from The source address for the liquidity
    /// @param tokens ERC20 tokens deposited
    /// @param actualTokenAmounts Token amounts deposited
    /// @param lpTokenMinted LP tokens received by the liquidity provider
    event Deposit(address indexed from, address[] tokens, uint256[] actualTokenAmounts, uint256 lpTokenMinted);

    /// @notice Emitted when liquidity is withdrawn
    /// @param from The source address for the liquidity
    /// @param tokens ERC20 tokens withdrawn
    /// @param actualTokenAmounts Token amounts withdrawn
    /// @param lpTokenBurned LP tokens burned from the liquidity provider
    event Withdraw(address indexed from, address[] tokens, uint256[] actualTokenAmounts, uint256 lpTokenBurned);
}
