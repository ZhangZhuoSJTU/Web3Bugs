// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "base64-sol/base64.sol";
import "../interfaces/ISvgHelper.sol";
import "../interfaces/IWhiteListPeriodManager.sol";
import "../interfaces/ILiquidityProviders.sol";
import "../../security/Pausable.sol";
import "../structures/LpTokenMetadata.sol";

contract LPToken is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC2771ContextUpgradeable,
    Pausable
{
    address internal constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    address public liquidityProvidersAddress;
    IWhiteListPeriodManager public whiteListPeriodManager;
    mapping(uint256 => LpTokenMetadata) public tokenMetadata;
    mapping(address => ISvgHelper) public svgHelpers;

    event LiquidityProvidersUpdated(address indexed lpm);
    event WhiteListPeriodManagerUpdated(address indexed manager);
    event SvgHelperUpdated(address indexed tokenAddress, ISvgHelper indexed svgHelper);

    function initialize(
        string memory _name,
        string memory _symbol,
        address _trustedForwarder,
        address _pauser
    ) public initializer {
        __Ownable_init();
        __ERC721_init(_name, _symbol);
        __ERC721Enumerable_init();
        __Pausable_init(_pauser);
        __ERC721URIStorage_init();
        __ReentrancyGuard_init();
        __ERC2771Context_init(_trustedForwarder);
    }

    modifier onlyHyphenPools() {
        require(_msgSender() == liquidityProvidersAddress, "ERR_UNAUTHORIZED");
        _;
    }

    function setSvgHelper(address _tokenAddress, ISvgHelper _svgHelper) public onlyOwner {
        require(_svgHelper != ISvgHelper(address(0)), "ERR_INVALID_SVG_HELPER");
        require(_tokenAddress != address(0), "ERR_INVALID_TOKEN_ADDRESS");
        svgHelpers[_tokenAddress] = _svgHelper;
        emit SvgHelperUpdated(_tokenAddress, _svgHelper);
    }

    function setLiquidityProviders(address _liquidityProviders) external onlyOwner {
        require(_liquidityProviders != address(0), "ERR_INVALID_LIQUIDITY_PROVIDERS");
        liquidityProvidersAddress = _liquidityProviders;
        emit LiquidityProvidersUpdated(_liquidityProviders);
    }

    function setWhiteListPeriodManager(address _whiteListPeriodManager) external onlyOwner {
        require(_whiteListPeriodManager != address(0), "ERR_INVALID_WHITELIST_PERIOD_MANAGER");
        whiteListPeriodManager = IWhiteListPeriodManager(_whiteListPeriodManager);
        emit WhiteListPeriodManagerUpdated(_whiteListPeriodManager);
    }

    function getAllNftIdsByUser(address _owner) public view returns (uint256[] memory) {
        uint256[] memory nftIds = new uint256[](balanceOf(_owner));
        for (uint256 i = 0; i < nftIds.length; ++i) {
            nftIds[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return nftIds;
    }

    function mint(address _to) external onlyHyphenPools whenNotPaused nonReentrant returns (uint256) {
        uint256 tokenId = totalSupply() + 1;
        _safeMint(_to, tokenId);
        return tokenId;
    }

    function updateTokenMetadata(uint256 _tokenId, LpTokenMetadata memory _lpTokenMetadata)
        external
        onlyHyphenPools
        whenNotPaused
    {
        require(_exists(_tokenId), "ERR__TOKEN_DOES_NOT_EXIST");
        tokenMetadata[_tokenId] = _lpTokenMetadata;
    }

    function exists(uint256 _tokenId) public view returns (bool) {
        return _exists(_tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        address tokenAddress = tokenMetadata[tokenId].token;
        require(svgHelpers[tokenAddress] != ISvgHelper(address(0)), "ERR__SVG_HELPER_NOT_REGISTERED");

        ISvgHelper svgHelper = ISvgHelper(svgHelpers[tokenAddress]);

        string memory svgData = svgHelper.getTokenSvg(
            tokenId,
            tokenMetadata[tokenId].suppliedLiquidity,
            ILiquidityProviders(liquidityProvidersAddress).totalReserve(tokenAddress)
        );

        string memory description = svgHelper.getDescription(
            tokenMetadata[tokenId].suppliedLiquidity,
            ILiquidityProviders(liquidityProvidersAddress).totalReserve(tokenAddress)
        );

        string memory attributes = svgHelper.getAttributes(
            tokenMetadata[tokenId].suppliedLiquidity,
            ILiquidityProviders(liquidityProvidersAddress).totalReserve(tokenAddress)
        );

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "',
                        name(),
                        '", "description": "',
                        description,
                        '", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(svgData)),
                        '", "attributes": ',
                        attributes,
                        "}"
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (address)
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

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721EnumerableUpgradeable, ERC721Upgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);

        // Only call whitelist period manager for NFT Transfers, not mint and burns
        if (from != address(0) && to != address(0)) {
            whiteListPeriodManager.beforeLiquidityTransfer(
                from,
                to,
                tokenMetadata[tokenId].token,
                tokenMetadata[tokenId].suppliedLiquidity
            );
        }
    }

    function _burn(uint256 tokenId) internal virtual override(ERC721URIStorageUpgradeable, ERC721Upgradeable) {
        ERC721URIStorageUpgradeable._burn(tokenId);
    }
}
