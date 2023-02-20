// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interface/INFTXVault.sol";
import "./interface/INFTXVaultFactory.sol";
import "./interface/INFTXEligibility.sol";
import "./interface/INFTXEligibilityManager.sol";
import "./interface/INFTXLPStaking.sol";
import "./interface/INFTXFeeDistributor.sol";
import "./interface/IERC165Upgradeable.sol";
import "./token/ERC20FlashMintUpgradeable.sol";
import "./token/ERC721SafeHolderUpgradeable.sol";
import "./token/ERC1155SafeHolderUpgradeable.sol";
import "./token/IERC721Upgradeable.sol";
import "./token/IERC1155Upgradeable.sol";
import "./util/OwnableUpgradeable.sol";
import "./util/ReentrancyGuardUpgradeable.sol";
import "./util/EnumerableSetUpgradeable.sol";

// Authors: @0xKiwi_ and @alexgausman.

contract NFTXVaultUpgradeable is
    OwnableUpgradeable,
    ERC20FlashMintUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC721SafeHolderUpgradeable,
    ERC1155SafeHolderUpgradeable,
    INFTXVault
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    uint256 constant base = 10**18;

    uint256 public override vaultId;
    address public override manager;
    address public override assetAddress;
    INFTXVaultFactory public override vaultFactory;
    INFTXEligibility public override eligibilityStorage;

    uint256 randNonce;
    uint256 private UNUSED_FEE1;
    uint256 private UNUSED_FEE2;
    uint256 private UNUSED_FEE3;

    bool public override is1155;
    bool public override allowAllItems;
    bool public override enableMint;
    bool public override enableRandomRedeem;
    bool public override enableTargetRedeem;

    EnumerableSetUpgradeable.UintSet holdings;
    mapping(uint256 => uint256) quantity1155;

    bool public override enableRandomSwap;
    bool public override enableTargetSwap;

    function __NFTXVault_init(
        string memory _name,
        string memory _symbol,
        address _assetAddress,
        bool _is1155,
        bool _allowAllItems
    ) public override virtual initializer {
        __Ownable_init();
        __ERC20_init(_name, _symbol);
        require(_assetAddress != address(0), "Asset != address(0)");
        assetAddress = _assetAddress;
        vaultFactory = INFTXVaultFactory(msg.sender);
        vaultId = vaultFactory.numVaults();
        is1155 = _is1155;
        allowAllItems = _allowAllItems;
        emit VaultInit(vaultId, _assetAddress, _is1155, _allowAllItems);
        setVaultFeatures(true /*enableMint*/, true /*enableRandomRedeem*/, true /*enableTargetRedeem*/, true /*enableRandomSwap*/, true /*enableTargetSwap*/);
    }

    function finalizeVault() external override virtual {
        setManager(address(0));
    }

    // Added in v1.0.3.
    function setVaultMetadata(
        string memory name_, 
        string memory symbol_
    ) public override virtual {
        onlyPrivileged();
        _setMetadata(name_, symbol_);
    }

    function setVaultFeatures(
        bool _enableMint,
        bool _enableRandomRedeem,
        bool _enableTargetRedeem,
        bool _enableRandomSwap,
        bool _enableTargetSwap
    ) public override virtual {
        onlyPrivileged();
        enableMint = _enableMint;
        enableRandomRedeem = _enableRandomRedeem;
        enableTargetRedeem = _enableTargetRedeem;
        enableRandomSwap = _enableRandomSwap;
        enableTargetSwap = _enableTargetSwap;

        emit EnableMintUpdated(_enableMint);
        emit EnableRandomRedeemUpdated(_enableRandomRedeem);
        emit EnableTargetRedeemUpdated(_enableTargetRedeem);
        emit EnableRandomSwapUpdated(_enableRandomSwap);
        emit EnableTargetSwapUpdated(_enableTargetSwap);
    }

    function assignDefaultFeatures() external {
        require(msg.sender == 0xDEA9196Dcdd2173D6E369c2AcC0faCc83fD9346a, "Not dev");
        enableRandomSwap = enableRandomRedeem;
        enableTargetSwap = enableTargetRedeem;
        emit EnableRandomSwapUpdated(enableRandomSwap);
        emit EnableTargetSwapUpdated(enableTargetSwap);
    }

    function setFees(
        uint256 _mintFee,
        uint256 _randomRedeemFee,
        uint256 _targetRedeemFee,
        uint256 _randomSwapFee,
        uint256 _targetSwapFee
    ) public override virtual {
        onlyPrivileged();
        vaultFactory.setVaultFees(vaultId, _mintFee, _randomRedeemFee, _targetRedeemFee, _randomSwapFee, _targetSwapFee);
    }

    function disableVaultFees() public override virtual {
        onlyPrivileged();
        vaultFactory.disableVaultFees(vaultId);
    }

    // This function allows for an easy setup of any eligibility module contract from the EligibilityManager.
    // It takes in ABI encoded parameters for the desired module. This is to make sure they can all follow 
    // a similar interface.
    function deployEligibilityStorage(
        uint256 moduleIndex,
        bytes calldata initData
    ) external override virtual returns (address) {
        onlyPrivileged();
        require(
            address(eligibilityStorage) == address(0),
            "NFTXVault: eligibility already set"
        );
        INFTXEligibilityManager eligManager = INFTXEligibilityManager(
            vaultFactory.eligibilityManager()
        );
        address _eligibility = eligManager.deployEligibility(
            moduleIndex,
            initData
        );
        eligibilityStorage = INFTXEligibility(_eligibility);
        // Toggle this to let the contract know to check eligibility now.
        allowAllItems = false;
        emit EligibilityDeployed(moduleIndex, _eligibility);
        return _eligibility;
    }

    // // This function allows for the manager to set their own arbitrary eligibility contract.
    // // Once eligiblity is set, it cannot be unset or changed.
    // Disabled for launch.
    // function setEligibilityStorage(address _newEligibility) public virtual {
    //     onlyPrivileged();
    //     require(
    //         address(eligibilityStorage) == address(0),
    //         "NFTXVault: eligibility already set"
    //     );
    //     eligibilityStorage = INFTXEligibility(_newEligibility);
    //     // Toggle this to let the contract know to check eligibility now.
    //     allowAllItems = false;
    //     emit CustomEligibilityDeployed(address(_newEligibility));
    // }

    // The manager has control over options like fees and features
    function setManager(address _manager) public override virtual {
        onlyPrivileged();
        manager = _manager;
        emit ManagerSet(_manager);
    }

    function mint(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts /* ignored for ERC721 vaults */
    ) external override virtual returns (uint256) {
        return mintTo(tokenIds, amounts, msg.sender);
    }

    function mintTo(
        uint256[] memory tokenIds,
        uint256[] memory amounts, /* ignored for ERC721 vaults */
        address to
    ) public override virtual nonReentrant returns (uint256) {
        onlyOwnerIfPaused(1);
        require(enableMint, "Minting not enabled");
        // Take the NFTs.
        uint256 count = receiveNFTs(tokenIds, amounts);

        // Mint to the user.
        _mint(to, base * count);
        uint256 totalFee = mintFee() * count;
        _chargeAndDistributeFees(to, totalFee);

        emit Minted(tokenIds, amounts, to);
        return count;
    }

    function redeem(uint256 amount, uint256[] calldata specificIds)
        external
        override
        virtual
        returns (uint256[] memory)
    {
        return redeemTo(amount, specificIds, msg.sender);
    }

    function redeemTo(uint256 amount, uint256[] memory specificIds, address to)
        public
        override
        virtual
        nonReentrant
        returns (uint256[] memory)
    {
        onlyOwnerIfPaused(2);
        require(
            amount == specificIds.length || enableRandomRedeem,
            "NFTXVault: Random redeem not enabled"
        );
        require(
            specificIds.length == 0 || enableTargetRedeem,
            "NFTXVault: Target redeem not enabled"
        );
        
        // We burn all from sender and mint to fee receiver to reduce costs.
        _burn(msg.sender, base * amount);

        // Pay the tokens + toll.
        uint256 totalFee = (targetRedeemFee() * specificIds.length) + (
            randomRedeemFee() * (amount - specificIds.length)
        );
        _chargeAndDistributeFees(msg.sender, totalFee);

        // Withdraw from vault.
        uint256[] memory redeemedIds = withdrawNFTsTo(amount, specificIds, to);
        emit Redeemed(redeemedIds, specificIds, to);
        return redeemedIds;
    }
    
    function swap(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts, /* ignored for ERC721 vaults */
        uint256[] calldata specificIds
    ) external override virtual returns (uint256[] memory) {
        return swapTo(tokenIds, amounts, specificIds, msg.sender);
    }

    function swapTo(
        uint256[] memory tokenIds,
        uint256[] memory amounts, /* ignored for ERC721 vaults */
        uint256[] memory specificIds,
        address to
    ) public override virtual nonReentrant returns (uint256[] memory) {
        onlyOwnerIfPaused(3);
        uint256 count;
        if (is1155) {
            for (uint256 i = 0; i < tokenIds.length; i++) {
                uint256 amount = amounts[i];
                require(amount > 0, "NFTXVault: transferring < 1");
                count += amount;
            }
        } else {
            count = tokenIds.length;
        }

        require(
            count == specificIds.length || enableRandomSwap,
            "NFTXVault: Random swap disabled"
        );
        require(
            specificIds.length == 0 || enableTargetSwap,
            "NFTXVault: Target swap disabled"
        );

        uint256 totalFee = (targetSwapFee() * specificIds.length) + (
            randomSwapFee() * (count - specificIds.length)
        );
        _chargeAndDistributeFees(msg.sender, totalFee);
        
        // Give the NFTs first, so the user wont get the same thing back, just to be nice. 
        uint256[] memory ids = withdrawNFTsTo(count, specificIds, to);

        receiveNFTs(tokenIds, amounts);

        emit Swapped(tokenIds, amounts, specificIds, ids, to);
        return ids;
    }

    function flashLoan(
        IERC3156FlashBorrowerUpgradeable receiver,
        address token,
        uint256 amount,
        bytes memory data
    ) public override virtual returns (bool) {
        onlyOwnerIfPaused(4);
        return super.flashLoan(receiver, token, amount, data);
    }

    function mintFee() public view override virtual returns (uint256) {
        (uint256 _mintFee, , , ,) = vaultFactory.vaultFees(vaultId);
        return _mintFee;
    }

    function randomRedeemFee() public view override virtual returns (uint256) {
        (, uint256 _randomRedeemFee, , ,) = vaultFactory.vaultFees(vaultId);
        return _randomRedeemFee;
    }

    function targetRedeemFee() public view override virtual returns (uint256) {
        (, , uint256 _targetRedeemFee, ,) = vaultFactory.vaultFees(vaultId);
        return _targetRedeemFee;
    }

    function randomSwapFee() public view override virtual returns (uint256) {
        (, , , uint256 _randomSwapFee, ) = vaultFactory.vaultFees(vaultId);
        return _randomSwapFee;
    }

    function targetSwapFee() public view override virtual returns (uint256) {
        (, , , ,uint256 _targetSwapFee) = vaultFactory.vaultFees(vaultId);
        return _targetSwapFee;
    }

    function vaultFees() public view override virtual returns (uint256, uint256, uint256, uint256, uint256) {
        return vaultFactory.vaultFees(vaultId);
    }

    function allValidNFTs(uint256[] memory tokenIds)
        public
        view
        override
        virtual
        returns (bool)
    {
        if (allowAllItems) {
            return true;
        }

        INFTXEligibility _eligibilityStorage = eligibilityStorage;
        if (address(_eligibilityStorage) == address(0)) {
            return false;
        }
        return _eligibilityStorage.checkAllEligible(tokenIds);
    }

    function nftIdAt(uint256 holdingsIndex) external view override virtual returns (uint256) {
        return holdings.at(holdingsIndex);
    }

    // Added in v1.0.3.
    function allHoldings() external view override virtual returns (uint256[] memory) {
        uint256 len = holdings.length();
        uint256[] memory idArray = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            idArray[i] = holdings.at(i);
        }
        return idArray;
    }

    // Added in v1.0.3.
    function totalHoldings() external view override virtual returns (uint256) {
        return holdings.length();
    }

    // Added in v1.0.3.
    function version() external pure returns (string memory) {
        return "v1.0.5";
    } 

    // We set a hook to the eligibility module (if it exists) after redeems in case anything needs to be modified.
    function afterRedeemHook(uint256[] memory tokenIds) internal virtual {
        INFTXEligibility _eligibilityStorage = eligibilityStorage;
        if (address(_eligibilityStorage) == address(0)) {
            return;
        }
        _eligibilityStorage.afterRedeemHook(tokenIds);
    }

    function receiveNFTs(uint256[] memory tokenIds, uint256[] memory amounts)
        internal
        virtual
        returns (uint256)
    {
        require(allValidNFTs(tokenIds), "NFTXVault: not eligible");
        if (is1155) {
            // This is technically a check, so placing it before the effect.
            IERC1155Upgradeable(assetAddress).safeBatchTransferFrom(
                msg.sender,
                address(this),
                tokenIds,
                amounts,
                ""
            );

            uint256 count;
            for (uint256 i = 0; i < tokenIds.length; i++) {
                uint256 tokenId = tokenIds[i];
                uint256 amount = amounts[i];
                require(amount > 0, "NFTXVault: transferring < 1");
                if (quantity1155[tokenId] == 0) {
                    holdings.add(tokenId);
                }
                quantity1155[tokenId] += amount;
                count += amount;
            }
            return count;
        } else {
            address _assetAddress = assetAddress;
            for (uint256 i = 0; i < tokenIds.length; i++) {
                uint256 tokenId = tokenIds[i];
                // We may already own the NFT here so we check in order:
                // Does the vault own it?
                //   - If so, check if its in holdings list
                //      - If so, we reject. This means the NFT has already been claimed for.
                //      - If not, it means we have not yet accounted for this NFT, so we continue.
                //   -If not, we "pull" it from the msg.sender and add to holdings.
                transferFromERC721(_assetAddress, tokenId);
                holdings.add(tokenId);
            }
            return tokenIds.length;
        }
    }

    function withdrawNFTsTo(
        uint256 amount,
        uint256[] memory specificIds,
        address to
    ) internal virtual returns (uint256[] memory) {
        bool _is1155 = is1155;
        address _assetAddress = assetAddress;
        uint256[] memory redeemedIds = new uint256[](amount);
        for (uint256 i = 0; i < amount; i++) {
            // This will always be fine considering the validations made above. 
            uint256 tokenId = i < specificIds.length ? 
                specificIds[i] : getRandomTokenIdFromVault();
            redeemedIds[i] = tokenId;

            if (_is1155) {
                quantity1155[tokenId] -= 1;
                if (quantity1155[tokenId] == 0) {
                    holdings.remove(tokenId);
                }

                IERC1155Upgradeable(_assetAddress).safeTransferFrom(
                    address(this),
                    to,
                    tokenId,
                    1,
                    ""
                );
            } else {
                holdings.remove(tokenId);
                transferERC721(_assetAddress, to, tokenId);
            }
        }
        afterRedeemHook(redeemedIds);
        return redeemedIds;
    }

    function _chargeAndDistributeFees(address user, uint256 amount) internal virtual {
        // Do not charge fees if the zap contract is calling
        // Added in v1.0.3. Changed to mapping in v1.0.5.
        if (vaultFactory.excludedFromFees(msg.sender)) {
            return;
        }
        
        // Mint fees directly to the distributor and distribute.
        if (amount > 0) {
            address feeDistributor = vaultFactory.feeDistributor();
            // Changed to a _transfer() in v1.0.3.
            _transfer(user, feeDistributor, amount);
            INFTXFeeDistributor(feeDistributor).distribute(vaultId);
        }
    }

    function transferERC721(address assetAddr, address to, uint256 tokenId) internal virtual {
        address kitties = 0x06012c8cf97BEaD5deAe237070F9587f8E7A266d;
        address punks = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB;
        bytes memory data;
        if (assetAddr == kitties) {
            // Changed in v1.0.4.
            data = abi.encodeWithSignature("transfer(address,uint256)", to, tokenId);
        } else if (assetAddr == punks) {
            // CryptoPunks.
            data = abi.encodeWithSignature("transferPunk(address,uint256)", to, tokenId);
        } else {
            // Default.
            data = abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", address(this), to, tokenId);
        }
        (bool success,) = address(assetAddr).call(data);
        require(success);
    }

    function transferFromERC721(address assetAddr, uint256 tokenId) internal virtual {
        address kitties = 0x06012c8cf97BEaD5deAe237070F9587f8E7A266d;
        address punks = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB;
        bytes memory data;
        if (assetAddr == kitties) {
            // Cryptokitties.
            data = abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), tokenId);
        } else if (assetAddr == punks) {
            // CryptoPunks.
            // Fix here for frontrun attack. Added in v1.0.2.
            bytes memory punkIndexToAddress = abi.encodeWithSignature("punkIndexToAddress(uint256)", tokenId);
            (bool checkSuccess, bytes memory result) = address(assetAddr).staticcall(punkIndexToAddress);
            (address owner) = abi.decode(result, (address));
            require(checkSuccess && owner == msg.sender, "Not the owner");
            data = abi.encodeWithSignature("buyPunk(uint256)", tokenId);
        } else {
            // Default.
            // Allow other contracts to "push" into the vault, safely.
            // If we already have the token requested, make sure we don't have it in the list to prevent duplicate minting.
            if (IERC721Upgradeable(assetAddress).ownerOf(tokenId) == address(this)) {
                require(!holdings.contains(tokenId), "Trying to use an owned NFT");
                return;
            } else {
                data = abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", msg.sender, address(this), tokenId);
            }
        }
        (bool success, bytes memory resultData) = address(assetAddr).call(data);
        require(success, string(resultData));
    }

    function getRandomTokenIdFromVault() internal virtual returns (uint256) {
        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1), 
                    randNonce,
                    block.coinbase,
                    block.difficulty,
                    block.timestamp
                )
            )
        ) % holdings.length();
        randNonce += 1;
        return holdings.at(randomIndex);
    }

    function onlyPrivileged() internal view {
        if (manager == address(0)) {
            require(msg.sender == owner(), "Not owner");
        } else {
            require(msg.sender == manager, "Not manager");
        }
    }

    function onlyOwnerIfPaused(uint256 lockId) internal view {
        require(!vaultFactory.isLocked(lockId) || msg.sender == owner(), "Paused");
    }
}
