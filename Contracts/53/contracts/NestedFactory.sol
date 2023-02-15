// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/ExchangeHelpers.sol";
import "./libraries/OperatorHelpers.sol";
import "./interfaces/external/IWETH.sol";
import "./interfaces/INestedFactory.sol";
import "./FeeSplitter.sol";
import "./MixinOperatorResolver.sol";
import "./NestedReserve.sol";
import "./NestedAsset.sol";
import "./NestedRecords.sol";

/// @title Creates, updates and destroys NestedAssets.
/// @notice Responsible for the business logic of the protocol and interaction with operators
contract NestedFactory is INestedFactory, ReentrancyGuard, Ownable, MixinOperatorResolver, Multicall {
    using SafeERC20 for IERC20;
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev Supported operators by the factory contract
    bytes32[] private operators;

    /// @dev Current feeSplitter contract/address
    FeeSplitter public feeSplitter;

    /// @dev Current reserve contract/address
    NestedReserve public reserve;

    NestedAsset public immutable nestedAsset;
    IWETH public immutable weth;
    NestedRecords public immutable nestedRecords;

    constructor(
        NestedAsset _nestedAsset,
        NestedRecords _nestedRecords,
        FeeSplitter _feeSplitter,
        IWETH _weth,
        address _operatorResolver
    ) MixinOperatorResolver(_operatorResolver) {
        nestedAsset = _nestedAsset;
        nestedRecords = _nestedRecords;
        feeSplitter = _feeSplitter;
        weth = _weth;
    }

    /// @dev Reverts the transaction if the caller is not the token owner
    /// @param _nftId The NFT Id
    modifier onlyTokenOwner(uint256 _nftId) {
        require(nestedAsset.ownerOf(_nftId) == _msgSender(), "NestedFactory: Not the token owner");
        _;
    }

    /// @dev Reverts the transaction if the nft is locked (hold by design).
    /// The block.timestamp must be greater than NFT record lock timestamp
    /// @param _nftId The NFT Id
    modifier isUnlocked(uint256 _nftId) {
        require(block.timestamp > nestedRecords.getLockTimestamp(_nftId), "NestedFactory: The NFT is currently locked");
        _;
    }

    /// @dev Receive function
    receive() external payable {}

    /// @notice Get the required operator addresses
    function resolverAddressesRequired() public view override returns (bytes32[] memory addresses) {
        return operators;
    }

    /// @inheritdoc INestedFactory
    function addOperator(bytes32 operator) external override onlyOwner {
        operators.push(operator);
    }

    /// @inheritdoc INestedFactory
    function removeOperator(bytes32 operator) external override onlyOwner {
        uint256 i = 0;
        while (operators[i] != operator) {
            i++;
        }
        require(i > 0, "NestedFactory::removeOperator: Cant remove non-existent operator");
        delete operators[i];
    }

    /// @inheritdoc INestedFactory
    function setReserve(NestedReserve _reserve) external override onlyOwner {
        require(address(reserve) == address(0), "NestedFactory::setReserve: Reserve is immutable");
        reserve = _reserve;
        emit ReserveUpdated(address(_reserve));
    }

    /// @inheritdoc INestedFactory
    function setFeeSplitter(FeeSplitter _feeSplitter) external override onlyOwner {
        require(address(_feeSplitter) != address(0), "NestedFactory::setFeeSplitter: Invalid feeSplitter address");
        feeSplitter = _feeSplitter;
        emit FeeSplitterUpdated(address(_feeSplitter));
    }

    /// @inheritdoc INestedFactory
    function create(
        uint256 _originalTokenId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable override nonReentrant {
        require(_orders.length > 0, "NestedFactory::create: Missing orders");

        uint256 nftId = nestedAsset.mint(_msgSender(), _originalTokenId);
        (uint256 fees, IERC20 tokenSold) = _submitInOrders(nftId, _sellToken, _sellTokenAmount, _orders, true, false);

        _transferFeeWithRoyalty(fees, tokenSold, nftId);
        emit NftCreated(nftId, _originalTokenId);
    }

    /// @inheritdoc INestedFactory
    function addTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external payable override nonReentrant onlyTokenOwner(_nftId) {
        require(_orders.length > 0, "NestedFactory::addTokens: Missing orders");

        (uint256 fees, IERC20 tokenSold) = _submitInOrders(_nftId, _sellToken, _sellTokenAmount, _orders, true, false);
        _transferFeeWithRoyalty(fees, tokenSold, _nftId);
        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function swapTokenForTokens(
        uint256 _nftId,
        IERC20 _sellToken,
        uint256 _sellTokenAmount,
        Order[] calldata _orders
    ) external override nonReentrant onlyTokenOwner(_nftId) isUnlocked(_nftId) {
        require(_orders.length > 0, "NestedFactory::swapTokenForTokens: Missing orders");
        require(
            nestedRecords.getAssetReserve(_nftId) == address(reserve),
            "NestedFactory::swapTokenForTokens: Assets in different reserve"
        );

        (uint256 fees, IERC20 tokenSold) = _submitInOrders(_nftId, _sellToken, _sellTokenAmount, _orders, true, true);
        _transferFeeWithRoyalty(fees, tokenSold, _nftId);

        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function sellTokensToNft(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        Order[] calldata _orders
    ) external override nonReentrant onlyTokenOwner(_nftId) isUnlocked(_nftId) {
        require(_orders.length > 0, "NestedFactory::sellTokensToNft: Missing orders");
        require(_sellTokensAmount.length == _orders.length, "NestedFactory::sellTokensToNft: Input lengths must match");
        require(
            nestedRecords.getAssetReserve(_nftId) == address(reserve),
            "NestedFactory::sellTokensToNft: Assets in different reserve"
        );

        (uint256 feesAmount, ) = _submitOutOrders(_nftId, _buyToken, _sellTokensAmount, _orders, true, true);
        _transferFeeWithRoyalty(feesAmount, _buyToken, _nftId);

        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function sellTokensToWallet(
        uint256 _nftId,
        IERC20 _buyToken,
        uint256[] memory _sellTokensAmount,
        Order[] calldata _orders
    ) external override nonReentrant onlyTokenOwner(_nftId) isUnlocked(_nftId) {
        require(_orders.length > 0, "NestedFactory::sellTokensToWallet: Missing orders");
        require(
            _sellTokensAmount.length == _orders.length,
            "NestedFactory::sellTokensToWallet: Input lengths must match"
        );
        require(
            nestedRecords.getAssetReserve(_nftId) == address(reserve),
            "NestedFactory::sellTokensToWallet: Assets in different reserve"
        );

        (uint256 feesAmount, uint256 amountBought) = _submitOutOrders(
            _nftId,
            _buyToken,
            _sellTokensAmount,
            _orders,
            false,
            true
        );
        _transferFeeWithRoyalty(feesAmount, _buyToken, _nftId);
        _safeTransferAndUnwrap(_buyToken, amountBought - feesAmount, _msgSender());

        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function destroy(
        uint256 _nftId,
        IERC20 _buyToken,
        Order[] calldata _orders
    ) external override nonReentrant onlyTokenOwner(_nftId) isUnlocked(_nftId) {
        address[] memory tokens = nestedRecords.getAssetTokens(_nftId);
        require(_orders.length > 0, "NestedFactory::destroy: Missing orders");
        require(tokens.length == _orders.length, "NestedFactory::destroy: Missing sell args");
        require(
            nestedRecords.getAssetReserve(_nftId) == address(reserve),
            "NestedFactory::destroy: Assets in different reserve"
        );

        uint256 buyTokenInitialBalance = _buyToken.balanceOf(address(this));

        for (uint256 i = 0; i < tokens.length; i++) {
            NestedRecords.Holding memory holding = nestedRecords.getAssetHolding(_nftId, tokens[i]);
            reserve.withdraw(IERC20(holding.token), holding.amount);

            _safeSubmitOrder(tokens[i], address(_buyToken), holding.amount, _nftId, _orders[i]);
            nestedRecords.freeHolding(_nftId, tokens[i]);
        }

        // Amount calculation to send fees and tokens
        uint256 amountBought = _buyToken.balanceOf(address(this)) - buyTokenInitialBalance;
        uint256 amountFees = _calculateFees(_msgSender(), amountBought);
        amountBought = amountBought - amountFees;

        _transferFeeWithRoyalty(amountFees, _buyToken, _nftId);
        _safeTransferAndUnwrap(_buyToken, amountBought, _msgSender());

        // Burn NFT
        nestedRecords.removeNFT(_nftId);
        nestedAsset.burn(_msgSender(), _nftId);
        emit NftBurned(_nftId);
    }

    /// @inheritdoc INestedFactory
    function withdraw(uint256 _nftId, uint256 _tokenIndex)
        external
        override
        nonReentrant
        onlyTokenOwner(_nftId)
        isUnlocked(_nftId)
    {
        uint256 assetTokensLength = nestedRecords.getAssetTokensLength(_nftId);
        require(assetTokensLength > _tokenIndex, "NestedFactory::withdraw: Invalid token index");
        // Use destroy instead if NFT has a single holding
        require(assetTokensLength > 1, "NestedFactory::withdraw: Can't withdraw the last asset");

        NestedRecords.Holding memory holding = nestedRecords.getAssetHolding(
            _nftId,
            nestedRecords.getAssetTokens(_nftId)[_tokenIndex]
        );
        reserve.withdraw(IERC20(holding.token), holding.amount);
        _safeTransferWithFees(IERC20(holding.token), holding.amount, _msgSender(), _nftId);

        nestedRecords.deleteAsset(_nftId, _tokenIndex);

        emit NftUpdated(_nftId);
    }

    /// @inheritdoc INestedFactory
    function increaseLockTimestamp(uint256 _nftId, uint256 _timestamp) external override onlyTokenOwner(_nftId) {
        nestedRecords.updateLockTimestamp(_nftId, _timestamp);
    }

    /// @inheritdoc INestedFactory
    function unlockTokens(IERC20 _token) external override onlyOwner {
        _token.transfer(owner(), _token.balanceOf(address(this)));
    }

    /// @dev For every orders, call the operator with the calldata
    /// to submit buy orders (where the input is one asset).
    /// @param _nftId The id of the NFT impacted by the orders
    /// @param _inputToken Token used to make the orders
    /// @param _inputTokenAmount Amount of input tokens to use
    /// @param _orders Orders calldata
    /// @param _reserved True if the output is store in the reserve/records, false if not.
    /// @param _fromReserve True if the input tokens are from the reserve
    /// @return feesAmount The total amount of fees
    /// @return tokenSold The ERC20 token sold (in case of ETH to WETH)
    function _submitInOrders(
        uint256 _nftId,
        IERC20 _inputToken,
        uint256 _inputTokenAmount,
        Order[] calldata _orders,
        bool _reserved,
        bool _fromReserve
    ) private returns (uint256 feesAmount, IERC20 tokenSold) {
        _inputToken = _transferInputTokens(_nftId, _inputToken, _inputTokenAmount, _fromReserve);
        uint256 amountSpent;
        for (uint256 i = 0; i < _orders.length; i++) {
            amountSpent += _submitOrder(address(_inputToken), _orders[i].token, _nftId, _orders[i], _reserved);
        }
        feesAmount = _calculateFees(_msgSender(), amountSpent);
        assert(amountSpent <= _inputTokenAmount - feesAmount); // overspent

        // If input is from the reserve, update the records
        if (_fromReserve) {
            _decreaseHoldingAmount(_nftId, address(_inputToken), _inputTokenAmount);
        }

        _handleUnderSpending(_inputTokenAmount - feesAmount, amountSpent, _inputToken);

        tokenSold = _inputToken;
    }

    /// @dev For every orders, call the operator with the calldata
    /// to submit sell orders (where the output is one asset).
    /// @param _nftId The id of the NFT impacted by the orders
    /// @param _outputToken Token received for every orders
    /// @param _inputTokenAmounts Amounts of tokens to use (respectively with Orders)
    /// @param _orders Orders calldata
    /// @param _reserved True if the output is store in the reserve/records, false if not.
    /// @param _fromReserve True if the input tokens are from the reserve
    /// @return feesAmount The total amount of fees
    /// @return amountBought The total amount bought
    function _submitOutOrders(
        uint256 _nftId,
        IERC20 _outputToken,
        uint256[] memory _inputTokenAmounts,
        Order[] calldata _orders,
        bool _reserved,
        bool _fromReserve
    ) private returns (uint256 feesAmount, uint256 amountBought) {
        uint256 _outputTokenInitialBalance = _outputToken.balanceOf(address(this));

        for (uint256 i = 0; i < _orders.length; i++) {
            IERC20 _inputToken = _transferInputTokens(
                _nftId,
                IERC20(_orders[i].token),
                _inputTokenAmounts[i],
                _fromReserve
            );

            // Submit order and update holding of spent token
            uint256 amountSpent = _submitOrder(address(_inputToken), address(_outputToken), _nftId, _orders[i], false);
            assert(amountSpent <= _inputTokenAmounts[i]);

            if (_fromReserve) {
                _decreaseHoldingAmount(_nftId, address(_inputToken), _inputTokenAmounts[i]);
            }

            // Under spent input amount send to fee splitter
            if (_inputTokenAmounts[i] - amountSpent > 0) {
                _transferFeeWithRoyalty(_inputTokenAmounts[i] - amountSpent, _inputToken, _nftId);
            }
        }

        amountBought = _outputToken.balanceOf(address(this)) - _outputTokenInitialBalance;
        feesAmount = _calculateFees(_msgSender(), amountBought);

        if (_reserved) {
            _transferToReserveAndStore(address(_outputToken), amountBought - feesAmount, _nftId);
        }
    }

    /// @dev Call the operator to submit the order (commit/revert) and add the output
    /// assets to the reserve (if needed).
    /// @param _inputToken Token used to make the orders
    /// @param _outputToken Expected output token
    /// @param _nftId The nftId
    /// @param _order The order calldata
    /// @param _reserved True if the output is store in the reserve/records, false if not.
    function _submitOrder(
        address _inputToken,
        address _outputToken,
        uint256 _nftId,
        Order calldata _order,
        bool _reserved
    ) private returns (uint256 amountSpent) {
        address operator = requireAndGetAddress(_order.operator);
        (bool success, bytes memory data) = OperatorHelpers.callOperator(operator, _order.commit, _order.callData);
        require(success, "NestedFactory::_submitOrder: Operator call failed");

        (uint256[] memory amounts, address[] memory tokens) = OperatorHelpers.decodeDataAndRequire(
            data,
            _inputToken,
            _outputToken
        );

        if (_reserved) {
            _transferToReserveAndStore(_outputToken, amounts[0], _nftId);
        }
        amountSpent = amounts[1];
    }

    /// @dev Call the operator to submit the order (commit/revert) but dont stop if
    /// the call to the operator fail. It will send the input token back to the msg.sender.
    /// Note : The _reserved Boolean has been removed (compare to _submitOrder) since it was
    ///        useless for the only use case (destroy).
    /// @param _inputToken Token used to make the orders
    /// @param _outputToken Expected output token
    /// @param _amountToSpend The input amount available (to spend)
    /// @param _nftId The nftId
    /// @param _order The order calldata
    function _safeSubmitOrder(
        address _inputToken,
        address _outputToken,
        uint256 _amountToSpend,
        uint256 _nftId,
        Order calldata _order
    ) private {
        address operator = requireAndGetAddress(_order.operator);
        (bool success, bytes memory data) = OperatorHelpers.callOperator(operator, _order.commit, _order.callData);
        if (success) {
            (uint256[] memory amounts, address[] memory tokens) = OperatorHelpers.decodeDataAndRequire(
                data,
                _inputToken,
                _outputToken
            );
            _handleUnderSpending(_amountToSpend, amounts[1], IERC20(_inputToken));
        } else {
            _safeTransferWithFees(IERC20(_inputToken), _amountToSpend, _msgSender(), _nftId);
        }
    }

    /// @dev Transfer tokens to the reserve, and compute the amount received to store
    /// in the records. We need to know the amount received in case of deflationary tokens.
    /// @param _token The token address
    /// @param _amount The amount to send to the reserve
    /// @param _nftId The Token ID to store the assets
    function _transferToReserveAndStore(
        address _token,
        uint256 _amount,
        uint256 _nftId
    ) private {
        uint256 balanceReserveBefore = IERC20(_token).balanceOf(address(reserve));

        // Send output to reserve
        IERC20(_token).safeTransfer(address(reserve), _amount);

        uint256 balanceReserveAfter = IERC20(_token).balanceOf(address(reserve));

        nestedRecords.store(_nftId, _token, balanceReserveAfter - balanceReserveBefore, address(reserve));
    }

    /// @dev Choose between ERC20 (safeTransfer) and ETH (deposit), to transfer from the Reserve
    ///      or the user wallet, to the factory.
    /// @param _nftId The NFT id
    /// @param _inputToken The token to receive
    /// @param _inputTokenAmount Amount to transfer
    /// @param _fromReserve True to transfer from the reserve
    /// @return tokenUsed Token transfered (in case of ETH)
    function _transferInputTokens(
        uint256 _nftId,
        IERC20 _inputToken,
        uint256 _inputTokenAmount,
        bool _fromReserve
    ) private returns (IERC20 tokenUsed) {
        if (_fromReserve) {
            NestedRecords.Holding memory holding = nestedRecords.getAssetHolding(_nftId, address(_inputToken));
            require(holding.amount >= _inputTokenAmount, "NestedFactory:_transferInputTokens: Insufficient amount");

            // Get input from reserve
            reserve.withdraw(IERC20(holding.token), _inputTokenAmount);
        } else if (address(_inputToken) == ETH) {
            require(msg.value == _inputTokenAmount, "NestedFactory::_transferInputTokens: Insufficient amount in");
            weth.deposit{ value: msg.value }();
            _inputToken = IERC20(address(weth));
        } else {
            _inputToken.safeTransferFrom(_msgSender(), address(this), _inputTokenAmount);
        }
        tokenUsed = _inputToken;
    }

    /// @dev Send the under spent amount to the FeeSplitter without the royalties.
    ///      The "under spent" amount is the positive difference between the amount supposed
    ///      to be spent and the amount really spent.
    /// @param _amountToSpent The amount supposed to be spent
    /// @param _amountSpent The amount really spent
    /// @param _token The amount-related token
    function _handleUnderSpending(
        uint256 _amountToSpent,
        uint256 _amountSpent,
        IERC20 _token
    ) private {
        if (_amountToSpent - _amountSpent > 0) {
            ExchangeHelpers.setMaxAllowance(_token, address(feeSplitter));
            feeSplitter.sendFees(_token, _amountToSpent - _amountSpent);
        }
    }

    /// @dev Send a fee to the FeeSplitter, royalties will be paid to the owner of the original asset
    /// @param _amount Amount to send
    /// @param _token Token to send
    /// @param _nftId User portfolio ID used to find a potential royalties recipient
    function _transferFeeWithRoyalty(
        uint256 _amount,
        IERC20 _token,
        uint256 _nftId
    ) private {
        address originalOwner = nestedAsset.originalOwner(_nftId);
        ExchangeHelpers.setMaxAllowance(_token, address(feeSplitter));
        if (originalOwner != address(0)) {
            feeSplitter.sendFeesWithRoyalties(originalOwner, _token, _amount);
        } else {
            feeSplitter.sendFees(_token, _amount);
        }
    }

    /// @dev Decrease the amount of a NFT holding
    /// @param _nftId The NFT id
    /// @param _inputToken The token holding
    /// @param _amount The amount to subtract from the actual holding amount
    function _decreaseHoldingAmount(
        uint256 _nftId,
        address _inputToken,
        uint256 _amount
    ) private {
        NestedRecords.Holding memory holding = nestedRecords.getAssetHolding(_nftId, _inputToken);
        nestedRecords.updateHoldingAmount(_nftId, _inputToken, holding.amount - _amount);
    }

    /// @dev Transfer a token amount from the factory to the recipient.
    ///      The token is unwrapped if WETH.
    /// @param _token The token to transfer
    /// @param _amount The amount to transfer
    /// @param _dest The address receiving the funds
    function _safeTransferAndUnwrap(
        IERC20 _token,
        uint256 _amount,
        address _dest
    ) private {
        // if buy token is WETH, unwrap it instead of transferring it to the sender
        if (address(_token) == address(weth)) {
            IWETH(weth).withdraw(_amount);
            (bool success, ) = _dest.call{ value: _amount }("");
            require(success, "ETH_TRANSFER_ERROR");
        } else {
            _token.safeTransfer(_dest, _amount);
        }
    }

    /// @dev Transfer from factory and collect fees
    /// @param _token The token to transfer
    /// @param _amount The amount (with fees) to transfer
    /// @param _dest The address receiving the funds
    function _safeTransferWithFees(
        IERC20 _token,
        uint256 _amount,
        address _dest,
        uint256 _nftId
    ) private {
        uint256 feeAmount = _calculateFees(_dest, _amount);
        _transferFeeWithRoyalty(feeAmount, _token, _nftId);
        _token.safeTransfer(_dest, _amount - feeAmount);
    }

    /// @dev Calculate the fees for a specific user and amount (1%)
    /// @param _user The user address
    /// @param _amount The amount
    /// @return The fees amount
    function _calculateFees(address _user, uint256 _amount) private view returns (uint256) {
        return _amount / 100;
    }
}
