// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./BatchAction.sol";
import "./nTokenRedeemAction.sol";
import "../FreeCollateralExternal.sol";
import "../../global/StorageLayoutV1.sol";
import "../../internal/AccountContextHandler.sol";
import "../../internal/portfolio/TransferAssets.sol";
import "../../internal/portfolio/PortfolioHandler.sol";
import "interfaces/IERC1155TokenReceiver.sol";
import "interfaces/notional/nERC1155Interface.sol";

contract ERC1155Action is nERC1155Interface, StorageLayoutV1 {
    using AccountContextHandler for AccountContext;

    // bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))
    bytes4 internal constant ERC1155_ACCEPTED = 0xf23a6e61;
    // bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))
    bytes4 internal constant ERC1155_BATCH_ACCEPTED = 0xbc197c81;

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(nERC1155Interface).interfaceId;
    }

    /// @notice Returns the balance of an ERC1155 id on an account. WARNING: the balances returned by
    /// this method are int256 not uint256 as specified in ERC1155. Modify smart contracts accordingly.
    /// @param account account to get the id for
    /// @param id the ERC1155 id
    /// @return Balance of the ERC1155 id as a signed integer
    function balanceOf(address account, uint256 id) public view override returns (int256) {
        AccountContext memory accountContext = AccountContextHandler.getAccountContext(account);
        int256 notional;

        if (accountContext.bitmapCurrencyId != 0) {
            notional = _balanceInBitmap(account, accountContext.bitmapCurrencyId, id);
        } else {
            notional = _balanceInArray(
                PortfolioHandler.getSortedPortfolio(account, accountContext.assetArrayLength),
                id
            );
        }

        return notional;
    }

    /// @notice Returns the balance of a batch of accounts and ids. WARNING: these balances are signed integers, not
    /// unsigned integers as the ERC1155 spec designates
    /// @param accounts array of accounts to get balances for
    /// @param ids array of ids to get balances for
    /// @return Returns an array of balances as signed integers
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external
        view
        override
        returns (int256[] memory)
    {
        require(accounts.length == ids.length);
        int256[] memory amounts = new int256[](accounts.length);

        for (uint256 i; i < accounts.length; i++) {
            // This is pretty inefficient but gets the job done
            amounts[i] = balanceOf(accounts[i], ids[i]);
        }

        return amounts;
    }

    /// @dev Returns the balance from a bitmap given the id
    function _balanceInBitmap(
        address account,
        uint256 bitmapCurrencyId,
        uint256 id
    ) internal view returns (int256) {
        (uint256 currencyId, uint256 maturity, uint256 assetType) = TransferAssets.decodeAssetId(
            id
        );
        if (currencyId != bitmapCurrencyId) return 0;
        if (assetType != Constants.FCASH_ASSET_TYPE) return 0;

        return BitmapAssetsHandler.getifCashNotional(account, currencyId, maturity);
    }

    /// @dev Searches an array for the matching asset
    function _balanceInArray(PortfolioAsset[] memory portfolio, uint256 id)
        internal
        pure
        returns (int256)
    {
        for (uint256 i; i < portfolio.length; i++) {
            if (
                TransferAssets.encodeAssetId(
                    portfolio[i].currencyId,
                    portfolio[i].maturity,
                    portfolio[i].assetType
                ) == id
            ) return portfolio[i].notional;
        }
    }

    /// @notice Transfer of a single fCash or liquidity token asset between accounts. Allows `from` account to transfer more fCash
    /// than they have as long as they pass a subsequent free collateral check. This enables OTC trading of fCash assets.
    /// @param from account to transfer from
    /// @param to account to transfer to
    /// @param id ERC1155 id of the asset
    /// @param amount amount to transfer
    /// @param data arbitrary data passed to ERC1155Receiver (if contract) and if properly specified can be used to initiate
    /// a trading action on Notional for the `from` address
    /// @dev emit:TransferSingle
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external payable override {
        require(amount <= uint256(type(int256).max)); // dev: int overflow
        _validateAccounts(from, to);

        // If code size > 0 call onERC1155received
        uint256 codeSize;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            codeSize := extcodesize(to)
        }
        if (codeSize > 0) {
            require(
                IERC1155TokenReceiver(to).onERC1155Received(msg.sender, from, id, amount, data) ==
                    ERC1155_ACCEPTED,
                "Not accepted"
            );
        }

        // When amount is set to zero this method can be used as a way to execute trades via a transfer operator
        AccountContext memory fromContext;
        if (amount > 0) {
            PortfolioAsset[] memory assets = new PortfolioAsset[](1);
            (assets[0].currencyId, assets[0].maturity, assets[0].assetType) = TransferAssets
                .decodeAssetId(id);
            assets[0].notional = int256(amount);
            _assertValidMaturity(assets[0].currencyId, assets[0].maturity, block.timestamp);

            // prettier-ignore
            (fromContext, /* toContext */) = _transfer(from, to, assets);

            emit TransferSingle(msg.sender, from, to, id, amount);
        } else {
            fromContext = AccountContextHandler.getAccountContext(from);
        }

        // toContext is always empty here because we cannot have bidirectional transfers in `safeTransferFrom`
        AccountContext memory toContext;
        _checkPostTransferEvent(from, to, fromContext, toContext, data, false);
    }

    /// @notice Transfer of a batch of fCash or liquidity token assets between accounts. Allows `from` account to transfer more fCash
    /// than they have as long as they pass a subsequent free collateral check. This enables OTC trading of fCash assets.
    /// @param from account to transfer from
    /// @param to account to transfer to
    /// @param ids ERC1155 ids of the assets
    /// @param amounts amounts to transfer
    /// @param data arbitrary data passed to ERC1155Receiver (if contract) and if properly specified can be used to initiate
    /// a trading action on Notional for the `from` address
    /// @dev emit:TransferBatch
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override {
        _validateAccounts(from, to);

        // If code size > 0 call onERC1155received
        uint256 codeSize;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            codeSize := extcodesize(to)
        }
        if (codeSize > 0) {
            require(
                IERC1155TokenReceiver(to).onERC1155BatchReceived(
                    msg.sender,
                    from,
                    ids,
                    amounts,
                    data
                ) == ERC1155_BATCH_ACCEPTED,
                "Not accepted"
            );
        }

        (PortfolioAsset[] memory assets, bool toTransferNegative) = _decodeToAssets(ids, amounts);
        // When doing a bidirectional transfer must ensure that the `to` account has given approval
        // to msg.sender as well.
        if (toTransferNegative) require(isApprovedForAll(to, msg.sender), "Unauthorized");

        (AccountContext memory fromContext, AccountContext memory toContext) = _transfer(
            from,
            to,
            assets
        );

        _checkPostTransferEvent(from, to, fromContext, toContext, data, toTransferNegative);

        emit TransferBatch(msg.sender, from, to, ids, amounts);
    }

    /// @dev Validates accounts on transfer
    function _validateAccounts(address from, address to) private view {
        require(from != to && to != address(0), "Invalid address");
        require(msg.sender == from || isApprovedForAll(from, msg.sender), "Unauthorized");
    }

    /// @notice Decodes ids and amounts to PortfolioAsset objects
    /// @param ids array of ERC1155 ids
    /// @param amounts amounts to transfer
    /// @return array of portfolio asset objects
    function decodeToAssets(uint256[] calldata ids, uint256[] calldata amounts)
        external
        view
        override
        returns (PortfolioAsset[] memory)
    {
        // prettier-ignore
        (PortfolioAsset[] memory assets, /* */) = _decodeToAssets(ids, amounts);
        return assets;
    }

    function _decodeToAssets(uint256[] calldata ids, uint256[] calldata amounts)
        internal
        view
        returns (PortfolioAsset[] memory, bool)
    {
        uint256 blockTime = block.timestamp;
        bool toTransferNegative = false;
        PortfolioAsset[] memory assets = new PortfolioAsset[](ids.length);

        for (uint256 i; i < ids.length; i++) {
            (assets[i].currencyId, assets[i].maturity, assets[i].assetType) = TransferAssets
                .decodeAssetId(ids[i]);

            _assertValidMaturity(assets[i].currencyId, assets[i].maturity, blockTime);
            // Although amounts is encoded as uint256 we allow it to be negative here. This will
            // allow for bidirectional transfers of fCash. Internally fCash assets are always stored
            // as int128 (for bitmap portfolio) or int88 (for array portfolio) so there is no potential
            // that a uint256 value that is greater than type(int256).max would actually valid.
            assets[i].notional = int256(amounts[i]);
            // If there is a negative transfer we mark it as such, this will force us to do a free collateral
            // check on the `to` address as well.
            if (assets[i].notional < 0) toTransferNegative = true;
        }

        return (assets, toTransferNegative);
    }

    /// @notice Encodes parameters into an ERC1155 id
    /// @param currencyId currency id of the asset
    /// @param maturity timestamp of the maturity
    /// @param assetType id of the asset type
    /// @return ERC1155 id
    function encodeToId(
        uint16 currencyId,
        uint40 maturity,
        uint8 assetType
    ) external pure override returns (uint256) {
        return TransferAssets.encodeAssetId(currencyId, maturity, assetType);
    }

    /// @dev Ensures that all maturities specified are valid for the currency id (i.e. they do not
    /// go past the max maturity date)
    function _assertValidMaturity(
        uint256 currencyId,
        uint256 maturity,
        uint256 blockTime
    ) private view {
        require(
            DateTime.isValidMaturity(CashGroup.getMaxMarketIndex(currencyId), maturity, blockTime),
            "Invalid maturity"
        );
    }

    /// @dev Internal asset transfer event between accounts
    function _transfer(
        address from,
        address to,
        PortfolioAsset[] memory assets
    ) internal returns (AccountContext memory, AccountContext memory) {
        AccountContext memory fromContext = AccountContextHandler.getAccountContext(from);
        AccountContext memory toContext = AccountContextHandler.getAccountContext(to);

        toContext = TransferAssets.placeAssetsInAccount(to, toContext, assets);
        TransferAssets.invertNotionalAmountsInPlace(assets);
        fromContext = TransferAssets.placeAssetsInAccount(from, fromContext, assets);

        toContext.setAccountContext(to);
        fromContext.setAccountContext(from);

        return (fromContext, toContext);
    }

    /// @dev Checks post transfer events which will either be initiating one of the batch trading events or a free collateral
    /// check if required.
    function _checkPostTransferEvent(
        address from,
        address to,
        AccountContext memory fromContext,
        AccountContext memory toContext,
        bytes calldata data,
        bool toTransferNegative
    ) internal {
        bytes4 sig;
        address transactedAccount;
        if (data.length >= 32) {
            // Method signature is not abi encoded so decode to bytes32 first and take the first 4 bytes. This works
            // because all the methods we want to call below require more than 32 bytes in the calldata
            bytes32 tmp = abi.decode(data, (bytes32));
            sig = bytes4(tmp);
        }

        // These are the only three methods allowed to occur in a post transfer event. These actions allow `from`
        // accounts to take any sort of trading action as a result of their transfer. All of these actions will
        // handle checking free collateral so no additional check is necessary here.
        if (
            sig == nTokenRedeemAction.nTokenRedeem.selector ||
            sig == BatchAction.batchBalanceAction.selector ||
            sig == BatchAction.batchBalanceAndTradeAction.selector
        ) {
            transactedAccount = abi.decode(data[4:36], (address));
            // Ensure that the "transactedAccount" parameter of the call is set to the from address or the
            // to address. If it is the "to" address then ensure that the msg.sender has approval to
            // execute operations
            require(
                transactedAccount == from ||
                    (transactedAccount == to && isApprovedForAll(to, msg.sender)),
                "Unauthorized call"
            );

            (bool status, bytes memory result) = address(this).call{value: msg.value}(data);
            // TODO: retrieve revert string
            require(status, "Call failed");
        }

        // The transacted account will have its free collateral checked above so there is
        // no need to recheck here.
        if (transactedAccount != from && fromContext.hasDebt != 0x00) {
            FreeCollateralExternal.checkFreeCollateralAndRevert(from);
        }

        // Check free collateral if the `to` account has taken on a negative fCash amount
        if (transactedAccount != to && toTransferNegative && toContext.hasDebt != 0x00) {
            FreeCollateralExternal.checkFreeCollateralAndRevert(to);
        }
    }

    /// @notice Allows an account to set approval for an operator
    /// @param operator address of the operator
    /// @param approved state of the approval
    /// @dev emit:ApprovalForAll
    function setApprovalForAll(address operator, bool approved) external override {
        accountAuthorizedTransferOperator[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /// @notice Checks approval state for an account, will first check if global transfer operator is enabled
    /// before falling through to an account specific transfer operator.
    /// @param account address of the account
    /// @param operator address of the operator
    /// @return true for approved
    function isApprovedForAll(address account, address operator)
        public
        view
        override
        returns (bool)
    {
        if (globalTransferOperator[operator]) return true;

        return accountAuthorizedTransferOperator[account][operator];
    }
}
