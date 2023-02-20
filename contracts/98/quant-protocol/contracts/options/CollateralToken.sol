// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../external/openzeppelin/ERC1155.sol";
import "../interfaces/ICollateralToken.sol";

/// @title Tokens representing a Quant user's short positions
/// @author Rolla
/// @notice Can be used by owners to claim their collateral
/// @dev This is a multi-token contract that implements the ERC1155 token standard:
/// https://eips.ethereum.org/EIPS/eip-1155
contract CollateralToken is ERC1155, ICollateralToken, EIP712 {
    /// @dev stores metadata for a CollateralToken with an specific id
    /// @param qTokenAddress address of the corresponding QToken
    /// @param qTokenAsCollateral QToken address of an option used as collateral in a spread
    struct CollateralTokenInfo {
        address qTokenAddress;
        address qTokenAsCollateral;
    }

    /// @inheritdoc ICollateralToken
    IQuantConfig public override quantConfig;

    /// @inheritdoc ICollateralToken
    mapping(uint256 => CollateralTokenInfo) public override idToInfo;

    /// @inheritdoc ICollateralToken
    uint256[] public override collateralTokenIds;

    // Signature nonce per address
    mapping(address => uint256) public nonces;

    // keccak256(
    //     "metaSetApprovalForAll(address owner,address operator,bool approved,uint256 nonce,uint256 deadline)"
    // );
    bytes32 private constant _META_APPROVAL_TYPEHASH =
        0xf8f9aaf28cf20cd45b21061d07505fa1da285124284441ea655b9eb837ed89b7;

    /// @notice Initializes a new ERC1155 multi-token contract for representing
    /// users' short positions
    /// @param _quantConfig the address of the Quant system configuration contract
    /// @param _name name for the domain typehash in EIP712 meta transactions
    /// @param _version version for the domain typehash in EIP712 meta transactions
    /// @param uri_ URI for ERC1155 tokens metadata
    constructor(
        address _quantConfig,
        string memory _name,
        string memory _version,
        string memory uri_
    ) ERC1155(uri_) EIP712(_name, _version) {
        require(
            _quantConfig != address(0),
            "CollateralToken: invalid QuantConfig address"
        );

        quantConfig = IQuantConfig(_quantConfig);
    }

    /// @inheritdoc ICollateralToken
    function createCollateralToken(
        address _qTokenAddress,
        address _qTokenAsCollateral
    ) external override returns (uint256 id) {
        id = getCollateralTokenId(_qTokenAddress, _qTokenAsCollateral);

        require(
            quantConfig.hasRole(
                quantConfig.quantRoles("COLLATERAL_CREATOR_ROLE"),
                msg.sender
            ),
            "CollateralToken: Only a collateral creator can create new CollateralTokens"
        );

        require(
            _qTokenAddress != _qTokenAsCollateral,
            "CollateralToken: Can only create a collateral token with different tokens"
        );

        require(
            idToInfo[id].qTokenAddress == address(0),
            "CollateralToken: this token has already been created"
        );

        idToInfo[id] = CollateralTokenInfo({
            qTokenAddress: _qTokenAddress,
            qTokenAsCollateral: _qTokenAsCollateral
        });

        collateralTokenIds.push(id);

        emit CollateralTokenCreated(
            _qTokenAddress,
            _qTokenAsCollateral,
            id,
            collateralTokenIds.length
        );
    }

    /// @inheritdoc ICollateralToken
    function mintCollateralToken(
        address recipient,
        uint256 collateralTokenId,
        uint256 amount
    ) external override {
        require(
            quantConfig.hasRole(
                quantConfig.quantRoles("COLLATERAL_MINTER_ROLE"),
                msg.sender
            ),
            "CollateralToken: Only a collateral minter can mint CollateralTokens"
        );

        emit CollateralTokenMinted(recipient, collateralTokenId, amount);

        _mint(recipient, collateralTokenId, amount, "");
    }

    /// @inheritdoc ICollateralToken
    function burnCollateralToken(
        address owner,
        uint256 collateralTokenId,
        uint256 amount
    ) external override {
        require(
            quantConfig.hasRole(
                quantConfig.quantRoles("COLLATERAL_BURNER_ROLE"),
                msg.sender
            ),
            "CollateralToken: Only a collateral burner can burn CollateralTokens"
        );
        _burn(owner, collateralTokenId, amount);

        emit CollateralTokenBurned(owner, collateralTokenId, amount);
    }

    /// @inheritdoc ICollateralToken
    function mintCollateralTokenBatch(
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external override {
        require(
            quantConfig.hasRole(
                quantConfig.quantRoles("COLLATERAL_MINTER_ROLE"),
                msg.sender
            ),
            "CollateralToken: Only a collateral minter can mint CollateralTokens"
        );

        uint256 length = ids.length;
        for (uint256 i = 0; i < length; ) {
            emit CollateralTokenMinted(recipient, ids[i], amounts[i]);
            unchecked {
                ++i;
            }
        }

        _mintBatch(recipient, ids, amounts, "");
    }

    /// @inheritdoc ICollateralToken
    function burnCollateralTokenBatch(
        address owner,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external override {
        require(
            quantConfig.hasRole(
                quantConfig.quantRoles("COLLATERAL_BURNER_ROLE"),
                msg.sender
            ),
            "CollateralToken: Only a collateral burner can burn CollateralTokens"
        );
        _burnBatch(owner, ids, amounts);

        uint256 length = ids.length;
        for (uint256 i = 0; i < length; ) {
            emit CollateralTokenBurned(owner, ids[i], amounts[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @inheritdoc ICollateralToken
    function metaSetApprovalForAll(
        address owner,
        address operator,
        bool approved,
        uint256 nonce,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        // solhint-disable-next-line not-rely-on-time
        require(
            block.timestamp <= deadline,
            "CollateralToken: expired deadline"
        );

        require(nonce == nonces[owner], "CollateralToken: invalid nonce");

        bytes32 structHash = keccak256(
            abi.encode(
                _META_APPROVAL_TYPEHASH,
                owner,
                operator,
                approved,
                nonce,
                deadline
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ecrecover(hash, v, r, s);
        require(signer == owner, "CollateralToken: invalid signature");

        nonces[owner]++;
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    /// @inheritdoc ICollateralToken
    function getCollateralTokensLength()
        external
        view
        override
        returns (uint256)
    {
        return collateralTokenIds.length;
    }

    /// @inheritdoc ICollateralToken
    function getCollateralTokenInfo(uint256 id)
        external
        view
        override
        returns (QTokensDetails memory qTokensDetails)
    {
        CollateralTokenInfo memory info = idToInfo[id];

        require(
            info.qTokenAddress != address(0),
            "CollateralToken: Invalid id"
        );

        IQToken.QTokenInfo memory shortDetails = IQToken(info.qTokenAddress)
            .getQTokenInfo();

        qTokensDetails.underlyingAsset = shortDetails.underlyingAsset;
        qTokensDetails.strikeAsset = shortDetails.strikeAsset;
        qTokensDetails.oracle = shortDetails.oracle;
        qTokensDetails.shortStrikePrice = shortDetails.strikePrice;
        qTokensDetails.expiryTime = shortDetails.expiryTime;
        qTokensDetails.isCall = shortDetails.isCall;

        if (info.qTokenAsCollateral != address(0)) {
            // the given id is for a CollateralToken representing a spread
            qTokensDetails.longStrikePrice = IQToken(info.qTokenAsCollateral)
                .strikePrice();
        }
    }

    /// @inheritdoc ICollateralToken
    function getCollateralTokenId(address _qToken, address _qTokenAsCollateral)
        public
        pure
        override
        returns (uint256 id)
    {
        id = uint256(keccak256(abi.encodePacked(_qToken, _qTokenAsCollateral)));
    }
}
