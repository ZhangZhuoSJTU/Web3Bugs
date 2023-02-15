// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

import "./interface/INFTXVaultFactory.sol";
import "./interface/INFTXEligibility.sol";
import "./interface/INFTXEligibilityManager.sol";
import "./interface/INFTXLPStaking.sol";
import "./interface/INFTXFeeDistributor.sol";
import "./interface/IPrevNftxContract.sol";
import "./interface/IRewardDistributionToken.sol";
import "./token/ERC20BurnableUpgradeable.sol";
import "./token/ERC20FlashMintUpgradeable.sol";
import "./token/ERC721HolderUpgradeable.sol";
import "./token/ERC1155HolderUpgradeable.sol";
import "./token/IERC721Upgradeable.sol";
import "./token/IERC1155Upgradeable.sol";
import "./util/PausableUpgradeable.sol";
import "./util/SafeMathUpgradeable.sol";
import "./util/ReentrancyGuardUpgradeable.sol";
import "./util/EnumerableSetUpgradeable.sol";

import "hardhat/console.sol";

contract NFTXVaultUpgradeable is
    PausableUpgradeable,
    ERC20BurnableUpgradeable,
    ERC20FlashMintUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC721HolderUpgradeable,
    ERC1155HolderUpgradeable
{
    using SafeMathUpgradeable for uint256;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    uint256 constant base = 10**18;

    uint256 public vaultId;
    address public manager;
    address public assetAddress;
    INFTXVaultFactory public vaultFactory;
    INFTXEligibility public eligibilityStorage;

    uint256 randNonce;
    uint256 public mintFee;
    uint256 public redeemFee;
    uint256 public directRedeemFee;
    uint256 public swapFee;

    // Purposely putting these on a new slot to make sure they're together.
    bool public is1155;
    bool public allowAllItems;
    bool public enableMint;
    bool public enableRedeem;
    bool public enableDirectRedeem;
    bool public enableSwap;
    bool[20] _bool_gap;

    string public description;

    EnumerableSetUpgradeable.UintSet holdings;
    mapping(uint256 => uint256) quantity1155;

    event VaultInit(
        uint256 indexed vaultId,
        address assetAddress,
        bool is1155,
        bool allowAllItems
    );

    event ManagerSet(address manager);
    event EligibilityDeployed(address eligibilityAddr);

    event EnableMintUpdated(bool enabled);
    event EnableRedeemUpdated(bool enabled);
    event EnableDirectRedeemUpdated(bool enabled);
    event EnableSwapUpdated(bool enabled);

    event MintFeeUpdated(uint256 mintFee);
    event RedeemFeeUpdated(uint256 redeemFee);
    event DirectRedeemFeeUpdated(uint256 directRedeemFee);
    event SwapFeeUpdated(uint256 swapFee);

    event Minted(uint256[] nftIds, uint256[] amounts, address sender);
    event Redeemed(uint256[] nftIds, address sender);
    event Swapped(
        uint256[] nftIds,
        uint256[] amounts,
        uint256[] specificIds,
        address sender
    );

    constructor() public {
        __Pausable_init();
        __ERC20_init("", "");
        __ERC20Burnable_init_unchained();
        __ERC20FlashMint_init();
    }

    function __NFTXVault_init(
        string memory _name,
        string memory _symbol,
        address _assetAddress,
        bool _is1155,
        bool _allowAllItems
    ) public initializer {
        __Pausable_init();
        __ERC20_init(_name, _symbol);
        __ERC20Burnable_init_unchained();
        __ERC20FlashMint_init();
        assetAddress = _assetAddress;
        vaultFactory = INFTXVaultFactory(msg.sender);
        vaultId = vaultFactory.numVaults();
        is1155 = _is1155;
        allowAllItems = _allowAllItems;
        emit VaultInit(vaultId, _assetAddress, _is1155, _allowAllItems);
    }

    function finalizeFund() external virtual {
        setManager(address(0));
    }

    function setVaultFeatures(
        bool _enableMint,
        bool _enableRedeem,
        bool _enableDirectRedeem,
        bool _enableSwap
    ) external virtual {
        onlyPrivileged();
        enableMint = _enableMint;
        enableRedeem = _enableRedeem;
        enableDirectRedeem = _enableDirectRedeem;
        enableSwap = _enableSwap;

        emit EnableMintUpdated(enableMint);
        emit EnableRedeemUpdated(enableRedeem);
        emit EnableDirectRedeemUpdated(enableDirectRedeem);
        emit EnableSwapUpdated(enableSwap);
    }

    // Should we do defaults?
    function setFees(
        uint256 _mintFee,
        uint256 _redeemFee,
        uint256 _directRedeemFee,
        uint256 _swapFee
    ) external virtual {
        onlyPrivileged();
        mintFee = _mintFee;
        redeemFee = _redeemFee;
        directRedeemFee = _directRedeemFee;
        swapFee = _swapFee;

        emit MintFeeUpdated(_mintFee);
        emit RedeemFeeUpdated(_redeemFee);
        emit DirectRedeemFeeUpdated(_directRedeemFee);
        emit SwapFeeUpdated(_swapFee);
    }

    // This function alls for an easy setup of any eligibility module contract from the EligibilityManager.
    // It takes in ABI encoded parameters for the desired module. This is to make sure they can all follow 
    // a similar interface.
    function deployEligibilityStorage(
        uint256 moduleIndex,
        bytes calldata initData
    ) external virtual returns (address) {
        onlyPrivileged();
        INFTXEligibilityManager eligManager = INFTXEligibilityManager(
            vaultFactory.eligibilityManager()
        );
        address _eligibility = eligManager.deployEligibility(
            moduleIndex,
            initData
        );
        setEligibilityStorage(_eligibility);
        return _eligibility;
    }

    // This function allows for the manager to set their own arbitrary eligibility contract.
    // Once eligiblity is set, it cannot be unset or changed.
    function setEligibilityStorage(address _newEligibility) public virtual {
        onlyPrivileged();
        require(
            address(eligibilityStorage) == address(0),
            "NFTXVault: eligibility already set"
        );
        eligibilityStorage = INFTXEligibility(_newEligibility);
        // Toggle this to let the contract know to check eligibility now.
        allowAllItems = false;
        emit EligibilityDeployed(address(_newEligibility));
    }

    // The manager has control over options like fees and features
    function setManager(address _manager) public virtual {
        onlyPrivileged();
        manager = _manager;
        emit ManagerSet(_manager);
    }

    function mint(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts /* ignored for ERC721 vaults */
    ) external virtual returns (uint256) {
        return mintTo(tokenIds, amounts, msg.sender);
    }

    function mintTo(
        uint256[] memory tokenIds,
        uint256[] memory amounts, /* ignored for ERC721 vaults */
        address to
    ) public virtual nonReentrant returns (uint256) {
        onlyOwnerIfPaused(1);
        require(enableMint, "Minting not enabled");
        require(allValidNFTs(tokenIds), "NFTXVault: not eligible");
        uint256 count = receiveNFTs(tokenIds, amounts);

        uint256 fee = mintFee.mul(count);
        _mint(to, base.mul(count).sub(fee));
        _distributeFees(fee);

        emit Minted(tokenIds, amounts, to);
        return count;
    }

    function redeem(uint256 amount, uint256[] calldata specificIds)
        external
        virtual
        returns (uint256[] memory)
    {
        return redeemTo(amount, specificIds, msg.sender);
    }

    function redeemTo(uint256 amount, uint256[] memory specificIds, address to)
        public
        virtual
        nonReentrant
        returns (uint256[] memory)
    {
        onlyOwnerIfPaused(2);
        require(enableRedeem, "Redeeming not enabled");
        require(
            specificIds.length == 0 || enableDirectRedeem,
            "Direct redeem not enabled"
        );
        uint256 fee = directRedeemFee.mul(specificIds.length).add(
            redeemFee.mul(amount.sub(specificIds.length))
        );
        // We burn all from sender and mint to fee receiver to reduce costs.
        _burnFrom(msg.sender, base.mul(amount).add(fee));
        _distributeFees(fee);

        uint256[] memory redeemedIds = withdrawNFTsTo(amount, specificIds, to);
        afterRedeemHook(redeemedIds);

        emit Redeemed(redeemedIds, to);
        return redeemedIds;
    }

    function swap(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts, /* ignored for ERC721 vaults */
        uint256[] calldata specificIds
    ) external virtual nonReentrant returns (uint256[] memory) {
        return swapTo(tokenIds, amounts, specificIds, msg.sender);
    }

    function swapTo(
        uint256[] memory tokenIds,
        uint256[] memory amounts, /* ignored for ERC721 vaults */
        uint256[] memory specificIds,
        address to
    ) public virtual returns (uint256[] memory) {
        onlyOwnerIfPaused(3);
        require(enableSwap, "Swapping not enabled");
        require(
            specificIds.length == 0 || enableDirectRedeem,
            "Direct redeem not enabled"
        );
        uint256 count = receiveNFTs(tokenIds, amounts);
        uint256 fee = directRedeemFee.mul(specificIds.length).add(
            swapFee.mul(count.sub(specificIds.length))
        );
        // We burn all from sender and mint to fee receiver to reduce costs.
        _burnFrom(msg.sender, fee);
        _distributeFees(fee);
        uint256[] memory ids = withdrawNFTsTo(count, specificIds, to);
        emit Swapped(tokenIds, amounts, specificIds, to);
        return ids;
    }

    function flashLoan(
        IERC3156FlashBorrowerUpgradeable receiver,
        address token,
        uint256 amount,
        bytes memory data
    ) public virtual override returns (bool) {
        onlyOwnerIfPaused(4);
        super.flashLoan(receiver, token, amount, data);
    }

    function allValidNFTs(uint256[] memory tokenIds)
        public
        view
        returns (bool)
    {
        // add allow all check here
        if (allowAllItems) {
            return true;
        }

        INFTXEligibility _eligibilityStorage = eligibilityStorage;
        if (address(_eligibilityStorage) == address(0)) {
            return false;
        }
        return _eligibilityStorage.checkAllEligible(tokenIds);
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
                if (quantity1155[tokenId] == 0) {
                    holdings.add(tokenId);
                }
                quantity1155[tokenId] = quantity1155[tokenId].add(amount);
                count = count.add(amount);
            }
            return count;
        } else {
            IERC721Upgradeable erc721 = IERC721Upgradeable(assetAddress);
            for (uint256 i = 0; i < tokenIds.length; i++) {
                uint256 tokenId = tokenIds[i];
                erc721.safeTransferFrom(msg.sender, address(this), tokenId);
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
            uint256 tokenId = i < specificIds.length
                ? specificIds[i]
                : getRandomTokenIdFromFund();
            redeemedIds[i] = tokenId;

            if (_is1155) {
                IERC1155Upgradeable(_assetAddress).safeTransferFrom(
                    address(this),
                    to,
                    tokenId,
                    1,
                    ""
                );

                quantity1155[tokenId] = quantity1155[tokenId].sub(1);
                if (quantity1155[tokenId] == 0) {
                    holdings.remove(tokenId);
                }
            } else {
                IERC721Upgradeable(_assetAddress).safeTransferFrom(
                    address(this),
                    to,
                    tokenId
                );
                holdings.remove(tokenId);
            }
        }
        return redeemedIds;
    }

    function _distributeFees(uint256 amount) internal virtual {
        // Mint fees directly to the distributor and distribute.
        if (amount > 0) {
            address feeReceiver = vaultFactory.feeReceiver();
            _mint(feeReceiver, amount);
            INFTXFeeDistributor(feeReceiver).distribute(vaultId);
        }
    }

    function getRandomTokenIdFromFund() internal virtual returns (uint256) {
        uint256 randomIndex = getPseudoRand(holdings.length());
        return holdings.at(randomIndex);
    }

    function getPseudoRand(uint256 modulus) internal virtual returns (uint256) {
        randNonce += 1;
        return
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - 1), randNonce)
                )
            ) %
            modulus;
    }

    function onlyPrivileged() internal view {
        if (manager == address(0)) {
            require(msg.sender == owner(), "Not owner");
        } else {
            require(msg.sender == manager, "Not manager");
        }
    }

    // TODO: recount this.
    uint256[25] ___gap;
}
