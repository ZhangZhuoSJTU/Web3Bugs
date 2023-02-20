//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {ERC721Payable} from "./ERC721Payable.sol";
import {ERC721Claimable} from "./ERC721Claimable.sol";
import {IRoyaltyVault} from "@chestrnft/royalty-vault/interfaces/IRoyaltyVault.sol";

contract CoreCollection is
    Ownable,
    ERC721Claimable,
    ERC721Enumerable,
    ERC721Payable
{
    bool public initialized;
    string private _name;
    string private _symbol;
    string private _baseUri;
    uint256 public maxSupply;
    uint256 public startingIndex;
    uint256 public startingIndexBlock;
    string public HASHED_PROOF = "";

    event ClaimInitialized(bytes32 root);
    event NewCollectionMeta(string name, string symbol);
    event NewClaim(address claimedBy, address to, uint256 tokenId);
    event StartingIndexSet(uint256 index);
    event RoyaltyVaultInitialized(address royaltyVault);
    event NewHashedProof(string proof);
    event NewWithdrawal(address to, uint256 amount);

    constructor() ERC721("", "") {}

    // ----------------- MODIFIER -----------------

    modifier onlyInitialized() {
        require(initialized, "CoreCollection: Not initialized");
        _;
    }

    modifier onlyUnInitialized() {
        require(!initialized, "CoreCollection: Already initialized");
        _;
    }

    modifier onlyValidSupply(uint256 _maxSupply) {
        require(
            _maxSupply > 0,
            "CoreCollection: Max supply should be greater than 0"
        );
        _;
    }

    modifier tokenExists(uint256 _tokenId) {
        require(_exists(_tokenId), "CoreCollection: Invalid token id");
        _;
    }

    // ----------------- EXTERNAL -----------------

    /**
     * @notice Initializes the collection
     * @dev This method is being called from the CoreFactory contract
     * @param _collectionName Name of the collection
     * @param _collectionSymbol Symbol of the collection
     * @param _collectionURI Base URI for the collection
     * @param _maxSupply The maximum number of tokens that can be minted
     * @param _mintFee The price of a token in this collection
     * @param _payableToken The address of the ERC20 this collection uses to settle transactions
     * @param _isForSale Whether or not tokens from this collection can be purchased. If false, tokens can only be claimed
     * @param _splitFactory base URI for the collection
     */
    function initialize(
        string memory _collectionName,
        string memory _collectionSymbol,
        string memory _collectionURI,
        uint256 _maxSupply,
        uint256 _mintFee,
        address _payableToken,
        bool _isForSale,
        address _splitFactory
    ) external onlyOwner onlyValidSupply(_maxSupply) {
        _name = _collectionName;
        _symbol = _collectionSymbol;
        _baseUri = _collectionURI;
        maxSupply = _maxSupply;
        mintFee = _mintFee;
        payableToken = IERC20(_payableToken);
        isForSale = _isForSale;
        splitFactory = _splitFactory;
        initialized = true;
    }

    /**
     * @notice Allows the collection owner to airdrop tokens
     * @dev The Merkle tree defines for each address how much token can be claimed
     * @dev This method can only be called once
     * @param _root A Merkle root
     */
    function initializeClaims(bytes32 _root)
        external
        onlyOwner
        onlyNotClaimableSet
        onlyValidRoot(_root)
    {
        _setMerkelRoot(_root);
        emit ClaimInitialized(_root);
    }

    /**
     * @notice Allows the collection owner to change the collection's name and symbol
     * @dev This function is only callable by the collection's owner
     * @param _collectionName A collection name
     * @param _collectionSymbol A collection symbol
     */
    function setCollectionMeta(
        string memory _collectionName,
        string memory _collectionSymbol
    ) external onlyOwner {
        _name = _collectionName;
        _symbol = _collectionSymbol;
        emit NewCollectionMeta(_collectionName, _collectionSymbol);
    }

    /**
     * @notice This function is called to mint tokens from this ERC721 collection
     * @dev The collection must be initialized first
     * @param to Token recipient
     * @param isClaim Whether the user want claim a token that has been airdropped to him or want to purchase the token
     * @param claimableAmount The amount of tokens the user has been airdropped
     * @param amount The amount of tokens the user wants to mint
     * @param merkleProof A merkle proof. Needed to verify if the user can claim a token
     */
    function mintToken(
        address to,
        bool isClaim,
        uint256 claimableAmount,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external onlyInitialized {
        require(amount > 0, "CoreCollection: Amount should be greater than 0");
        require(
            totalSupply() + amount <= maxSupply,
            "CoreCollection: Over Max Supply"
        );

        if (isClaim) {
            require(claimableSet(), "CoreCollection: No claimable");
            require(
                canClaim(msg.sender, claimableAmount, amount, merkleProof),
                "CoreCollection: Can't claim"
            );
            _claim(msg.sender, amount);
        } else {
            require(isForSale, "CoreCollection: Not for sale");
            if (mintFee > 0) {
                _handlePayment(mintFee * amount);
            }
        }

        batchMint(to, amount, isClaim);
    }

    /**
     * @notice Allows the contract owner to withdraw the funds generated by the token sales
     * @dev If a royalty vault isn't set, tokens are kept within this contract and can be withdrawn by the token owner
     */
    function withdraw() external onlyOwner {
        uint256 amount = payableToken.balanceOf(address(this));
        payableToken.transferFrom(address(this), msg.sender, amount);
        emit NewWithdrawal(msg.sender, amount);
    }

    /**
     * @notice Set royalty vault address for collection
     * @dev All revenue (Primary sales + royalties from secondardy sales) 
     * from the collection are transferred to the vault when the vault is initialized
     * @param _royaltyVault The address of the royalty vault
     */
    function setRoyaltyVault(address _royaltyVault)
        external
        onlyVaultUninitialized
    {
        require(
            msg.sender == splitFactory || msg.sender == owner(),
            "CoreCollection: Only Split Factory or owner can initialize vault."
        );
        royaltyVault = _royaltyVault;
        emit RoyaltyVaultInitialized(_royaltyVault);
    }

    /**
     * @notice Set a provenance hash
     * @dev This hash is used to verify the minting ordering of a collection (à la BAYC)
     * This hash is generated off-chain
     * @param _proof The SHA256 generated hash
     */
    function setHashedProof(string calldata _proof) external onlyOwner {
        require(
            bytes(HASHED_PROOF).length == 0,
            "CoreCollection: Hashed Proof is set"
        );

        HASHED_PROOF = _proof;
        emit NewHashedProof(_proof);
    }

    // ----------------- PUBLIC -----------------

    /**
     * @notice Set the mint starting index
     * @dev The starting index can only be generated once
     */
    function setStartingIndex() public {
        require(
            startingIndex == 0,
            "CoreCollection: Starting index is already set"
        );

        startingIndex =
            (uint256(
                keccak256(abi.encodePacked("CoreCollection", block.number))
            ) % maxSupply) +
            1;
        startingIndexBlock = uint256(block.number);
        emit StartingIndexSet(startingIndex);
    }

    // ---------------- VIEW ----------------

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function baseURI() public view returns (string memory) {
        return _baseUri;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseUri;
    }

    // ---------------- PRIVATE ----------------

    /**
     * @notice Mint token
     * @dev A starting index is calculated at the time of first mint
     * returns a tokenId
     * @param _to Token recipient
     */
    function mint(address _to) private returns (uint256 tokenId) {
        if (startingIndex == 0) {
            setStartingIndex();
        }
        tokenId = ((startingIndex + totalSupply()) % maxSupply) + 1;
        _mint(_to, tokenId);
    }

    /**
     * @notice Mint tokens in batch
     * @param _to Token recipient
     * @param _amount Number of tokens to include in batch
     * @param _isClaim Whether the batch mint is an airdrop or not
     */
    function batchMint(
        address _to,
        uint256 _amount,
        bool _isClaim
    ) private {
        for (uint256 i = 0; i < _amount; i++) {
            uint256 tokenId = mint(_to);
            if (_isClaim) {
                emit NewClaim(msg.sender, _to, tokenId);
            }
        }
    }

    // ---------------- INTERNAL ----------------

    /**
     * @notice This hook transfers tokens sitting in the royalty vault to the split contract
     * @dev The split contract is a contract that allows a team to share revenue together
     * @param _from Transfer sender
     * @param _to Transfer recipient
     * @param _tokenId TokenId of token being transferred
     */
    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) internal virtual override {
        super._beforeTokenTransfer(_from, _to, _tokenId);

        if (
            royaltyVault != address(0) &&
            IRoyaltyVault(royaltyVault).getVaultBalance() > 0
        ) {
            IRoyaltyVault(royaltyVault).sendToSplitter();
        }
    }
}
