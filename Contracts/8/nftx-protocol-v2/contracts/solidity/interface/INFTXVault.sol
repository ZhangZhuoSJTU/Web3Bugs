// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

interface INFTXVault {
    function manager() external returns (address);
    function assetAddress() external returns (address);
    function vaultFactory() external returns (address);
    function eligibilityStorage() external returns (address);

    function is1155() external returns (bool);
    function allowAllItems() external returns (bool);
    function enableMint() external returns (bool);
    function enableRedeem() external returns (bool);
    function enableDirectRedeem() external returns (bool);
    function enableSwap() external returns (bool);

    function vaultId() external  returns (uint256);
    function mintFee() external returns (uint256);
    function redeemFee() external returns (uint256);
    function directRedeemFee() external returns (uint256);
    function swapFee() external returns (uint256);

    function description() external returns (string memory);
    event FundPreferencesUpdated(uint256 indexed vaultId);

    event Mint(
        uint256 indexed vaultId,
        uint256[] nftIds,
        uint256[] amounts,
        address sender
    );
    event Redeem(uint256 indexed vaultId, uint256[] nftIds, address sender);
    event ManagerSet(uint256 indexed vaultId, address manager);

    function __NFTXVault_init(
        string calldata _name,
        string calldata _symbol,
        address _assetAddress,
        bool _is1155,
        bool _allowAllItems
    ) external;

    function finalizeFund() external;

    function setVaultFeatures(
        bool _enableMint,
        bool _enableRedeem,
        bool _enableDirectRedeem,
        bool _enableSwap
    ) external;

    function setFees(
        uint256 _mintFee,
        uint256 _redeemFee,
        uint256 _directRedeemFee,
        uint256 _swapFee
    ) external;

    function deployEligibilityStorage(uint256 eligibilityIndex, bytes calldata initData) external returns (address);

    function setEligibilityStorage(address _newEligibility) external;

    function setManager(address _manager) external;

    function mint(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts /* ignored for ERC721 funds */
    ) external returns (uint256);

    function mintTo(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts, /* ignored for ERC721 funds */
        address to
    ) external returns (uint256);

    function redeem(uint256 amount, uint256[] calldata specificIDs)
        external returns (uint256[] memory);

    function redeemTo(uint256 amount, uint256[] calldata specificIDs, address to)
        external returns (uint256[] memory);

    function allValidNFTs(uint256[] calldata tokenIds) external view returns (bool);
}
