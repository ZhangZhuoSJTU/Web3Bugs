// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "./interfaces/IFulfillHelper.sol";
import "./interfaces/ITransactionManager.sol";
import "./lib/LibAsset.sol";
import "./lib/LibERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Outstanding qs:
// - what happens if you have unique user data, but duplicate tx ids?
//   no requires here would catch this, the tx would be properly prepared
//
// - we validate all the inputs but the amount, bidSignature, and encodedBid.
//   bidSignature and encodedBid could be used as slashing later, and their
//   validation is out of scope of this function. But, do we want to be able
//   to use this to send 0-value amounts? basically as some incentivized
//   relayer? would that break bidding?


/// @title TransactionManager
/// @author Connext <support@connext.network>
/// @notice This contract holds the logic to facilitate crosschain transactions.
///         Transactions go through three phases:
///
///         1. Route Auction: User broadcasts to our network signalling their 
///         desired route. Routers respond with sealed bids containing 
///         commitments to fulfilling the transaction within a certain time and 
///         price range.
///
///         2. Prepare: Once the auction is completed, the transaction can be 
///         prepared. The user submits a transaction to `TransactionManager` 
///         contract on sender-side chain containing router's signed bid. This 
///         transaction locks up the users funds on the sending chiain. Upon 
///         detecting an event containing their signed bid from the chain, 
///         router submits the same transaction to `TransactionManager` on the 
///         receiver-side chain, and locks up a corresponding amount of 
///         liquidity. The amount locked on the receiving chain is `sending 
///         amount - auction fee` so the router is incentivized to complete the 
///         transaction.
///
///         3. Fulfill: Upon detecting the `TransactionPrepared` event on the 
///         receiver-side chain, the user signs a message and sends it to a 
///         relayer, who will earn a fee for submission. The relayer (which may 
///         be the router) then submits the message to the `TransactionManager` 
///         to complete their transaction on receiver-side chain and claim the 
///         funds locked by the router. A relayer is used here to allow users 
///         to submit transactions with arbitrary calldata on the receiving 
///         chain without needing gas to do so. The router then submits the 
///         same signed message and completes transaction on sender-side, 
///         unlocking the original `amount`.
///
///         If a transaction is not fulfilled within a fixed timeout, it 
///         reverts and can be reclaimed by the party that called `prepare` on 
///         each chain (initiator). Additionally, transactions can be cancelled 
///         unilaterally by the person owed funds on that chain (router for 
///         sending chain, user for receiving chain) prior to expiry.

contract TransactionManager is ReentrancyGuard, ITransactionManager {
  /// @dev Mapping of router to balance specific to asset
  mapping(address => mapping(address => uint256)) public routerBalances;

  /// @dev Mapping of user address to blocks where active transfers
  ///      were created.
  mapping(address => uint256[]) public activeTransactionBlocks;

  /// @dev Mapping of hash of `InvariantTransactionData` to the hash
  //       of the `VariantTransactionData`
  mapping(bytes32 => bytes32) public variantTransactionData;

  /// @dev The chain id of the contract, is passed in to avoid any evm issues
  uint256 public immutable chainId;

  /// @dev Minimum timeout (will be the lowest on the receiving chain)
  uint256 public constant MIN_TIMEOUT = 24 hours;

  constructor(uint256 _chainId) {
    chainId = _chainId;
  }

  /// @notice This is used by any router to increase their available
  ///         liquidity for a given asset.
  /// @param amount The amount of liquidity to add for the router
  /// @param assetId The address (or `address(0)` if native asset) of the
  ///                asset you're adding liquidity for
  /// @param router The router you are adding liquidity on behalf of
  function addLiquidity(uint256 amount, address assetId, address router) external payable override nonReentrant {
    // Sanity check: nonzero amounts
    require(amount > 0, "addLiquidity: AMOUNT_IS_ZERO");

    // Validate correct amounts are transferred
    if (LibAsset.isEther(assetId)) {
      require(msg.value == amount, "addLiquidity: VALUE_MISMATCH");
    } else {
      require(msg.value == 0, "addLiquidity: ETH_WITH_ERC_TRANSFER");
      require(LibERC20.transferFrom(assetId, router, address(this), amount), "addLiquidity: ERC20_TRANSFER_FAILED");
    }

    // Update the router balances
    routerBalances[router][assetId] += amount;

    // Emit event
    emit LiquidityAdded(router, assetId, amount, msg.sender);
  }

  /// @notice This is used by any router to decrease their available
  ///         liquidity for a given asset.
  /// @param amount The amount of liquidity to remove for the router
  /// @param assetId The address (or `address(0)` if native asset) of the
  ///                asset you're removing liquidity for
  /// @param recipient The address that will receive the liquidity being removed
  function removeLiquidity(
    uint256 amount,
    address assetId,
    address payable recipient
  ) external override nonReentrant {
    // Sanity check: nonzero amounts
    require(amount > 0, "removeLiquidity: AMOUNT_IS_ZERO");

    // Sanity check: amount can be deducted for the router
    require(routerBalances[msg.sender][assetId] >= amount, "removeLiquidity: INSUFFICIENT_FUNDS");

    // Update router balances
    routerBalances[msg.sender][assetId] -= amount;

    // Transfer from contract to specified recipient
    require(LibAsset.transferAsset(assetId, recipient, amount), "removeLiquidity: TRANSFER_FAILED");

    // Emit event
    emit LiquidityRemoved(msg.sender, assetId, amount, recipient);
  }

  /// @notice This function creates a crosschain transaction. When called on
  ///         the sending chain, the user is expected to lock up funds. When
  ///         called on the receiving chain, the router deducts the transfer
  ///         amount from the available liquidity. The majority of the
  ///         information about a given transfer does not change between chains,
  ///         with three notable exceptions: `amount`, `expiry`, and 
  ///         `preparedBlock`. The `amount` and `expiry` are decremented
  ///         between sending and receiving chains to provide an incentive for 
  ///         the router to complete the transaction and time for the router to
  ///         fulfill the transaction on the sending chain after the unlocking
  ///         signature is revealed, respectively.
  /// @param invariantData The data for a crosschain transaction that will
  ///                      not change between sending and receiving chains.
  ///                      The hash of this data is used as the key to store 
  ///                      the inforamtion that does change between chains 
  ///                      (amount, expiry,preparedBlock) for verification
  /// @param amount The amount of the transaction on this chain
  /// @param expiry The block.timestamp when the transaction will no longer be
  ///               fulfillable and is freely cancellable on this chain
  /// @param encryptedCallData The calldata to be executed when the tx is
  ///                          fulfilled. Used in the function to allow the user
  ///                          to reconstruct the tx from events. Hash is stored
  ///                          onchain to prevent shenanigans.
  /// @param encodedBid The encoded bid that was accepted by the user for this
  ///                   crosschain transfer. It is supplied as a param to the
  ///                   function but is only used in event emission
  /// @param bidSignature The signature of the bidder on the encoded bid for
  ///                     this transaction. Only used within the function for
  ///                     event emission. The validity of the bid and
  ///                     bidSignature are enforced offchain
  function prepare(
    InvariantTransactionData calldata invariantData,
    uint256 amount,
    uint256 expiry,
    bytes calldata encryptedCallData,
    bytes calldata encodedBid,
    bytes calldata bidSignature
  ) external payable override nonReentrant returns (TransactionData memory) {
    // Sanity check: user is sensible
    require(invariantData.user != address(0), "prepare: USER_EMPTY");

    // Sanity check: router is sensible
    require(invariantData.router != address(0), "prepare: ROUTER_EMPTY");

    // Sanity check: valid fallback
    require(invariantData.receivingAddress != address(0), "prepare: RECEIVING_ADDRESS_EMPTY");

    // Make sure the chains are different
    require(invariantData.sendingChainId != invariantData.receivingChainId, "prepare: SAME_CHAINIDS");

    // Make sure the chains are relevant
    require(invariantData.sendingChainId == chainId || invariantData.receivingChainId == chainId, "prepare: INVALID_CHAINIDS");

    // Make sure the expiry is greater than min
    require((expiry - block.timestamp) >= MIN_TIMEOUT, "prepare: TIMEOUT_TOO_LOW");

    // Make sure the hash is not a duplicate
    bytes32 digest = keccak256(abi.encode(invariantData));
    require(variantTransactionData[digest] == bytes32(0), "prepare: DIGEST_EXISTS");

    // NOTE: the `encodedBid` and `bidSignature` are simply passed through
    //       to the contract emitted event to ensure the availability of
    //       this information. Their validity is asserted offchain, and
    //       is out of scope of this contract. They are used as inputs so
    //       in the event of a router or user crash, they may recover the
    //       correct bid information without requiring an offchain store.

    // Store the transaction variants
    variantTransactionData[digest] = keccak256(abi.encode(VariantTransactionData({
      amount: amount,
      expiry: expiry,
      preparedBlockNumber: block.number
    })));

    // Store active blocks
    activeTransactionBlocks[invariantData.user].push(block.number);

    // First determine if this is sender side or receiver side
    if (invariantData.sendingChainId == chainId) {
      // Sanity check: amount is sensible
      // Only check on sending chain to enforce router fees. Transactions could
      // be 0-valued on receiving chain if it is just a value-less call to some
      // `IFulfillHelper`
      require(amount > 0, "prepare: AMOUNT_IS_ZERO");

      // This is sender side prepare. The user is beginning the process of 
      // submitting an onchain tx after accepting some bid. They should
      // lock their funds in the contract for the router to claim after
      // they have revealed their signature on the receiving chain via
      // submitting a corresponding `fulfill` tx

      // Validate correct amounts on msg and transfer from user to
      // contract
      if (LibAsset.isEther(invariantData.sendingAssetId)) {
        require(msg.value == amount, "prepare: VALUE_MISMATCH");
      } else {
        require(msg.value == 0, "prepare: ETH_WITH_ERC_TRANSFER");
        require(
          LibERC20.transferFrom(invariantData.sendingAssetId, msg.sender, address(this), amount),
          "prepare: ERC20_TRANSFER_FAILED"
        );
      }
    } else {
      // This is receiver side prepare. The router has proposed a bid on the
      // transfer which the user has accepted. They can now lock up their
      // own liquidity on th receiving chain, which the user can unlock by
      // calling `fulfill`. When creating the `amount` and `expiry` on the
      // receiving chain, the router should have decremented both. The
      // expiry should be decremented to ensure the router has time to
      // complete the sender-side transaction after the user completes the
      // receiver-side transactoin. The amount should be decremented to act as
      // a fee to incentivize the router to complete the transaction properly.

      // Check that the caller is the router
      require(msg.sender == invariantData.router, "prepare: ROUTER_MISMATCH");

      // Check that the router isnt accidentally locking funds in the contract
      require(msg.value == 0, "prepare: ETH_WITH_ROUTER_PREPARE");

      // Check that router has liquidity
      require(
        routerBalances[invariantData.router][invariantData.receivingAssetId] >= amount,
        "prepare: INSUFFICIENT_LIQUIDITY"
      );

      // Decrement the router liquidity
      routerBalances[invariantData.router][invariantData.receivingAssetId] -= amount;
    }

    // Emit event
    TransactionData memory txData = TransactionData({
      user: invariantData.user,
      router: invariantData.router,
      sendingAssetId: invariantData.sendingAssetId,
      receivingAssetId: invariantData.receivingAssetId,
      sendingChainFallback: invariantData.sendingChainFallback,
      callTo: invariantData.callTo,
      receivingAddress: invariantData.receivingAddress,
      callDataHash: invariantData.callDataHash,
      transactionId: invariantData.transactionId,
      sendingChainId: invariantData.sendingChainId,
      receivingChainId: invariantData.receivingChainId,
      amount: amount,
      expiry: expiry,
      preparedBlockNumber: block.number
    });
    emit TransactionPrepared(txData.user, txData.router, txData.transactionId, txData, msg.sender, encryptedCallData, encodedBid, bidSignature);
    return txData;
  }



  /// @notice This function completes a crosschain transaction. When called on
  ///         the receiving chain, the user reveals their signature on the
  ///         invariant parts of the transaction data and is sent the 
  ///         appropriate amount. The router then uses this signature to
  ///         unlock the corresponding funds on the receiving chain, which are
  ///         then added back to their available liquidity. The user includes a
  ///         relayer fee since it is not assumed they will have gas on the
  ///         receiving chain. This function *must* be called before the
  ///         transaction expiry has elapsed.
  /// @param txData All of the data (invariant and variant) for a crosschain
  ///               transaction. The variant data provided is checked against
  ///               what was stored when the `prepare` function was called.
  /// @param relayerFee The fee that should go to the relayer when they are
  ///                   calling the function on the receiving chain for the user
  /// @param signature The users signature on the invariant data + fee that
  ///                  can be used by the router to unlock the transaction on 
  ///                  the sending chain
  function fulfill(
    TransactionData calldata txData,
    uint256 relayerFee,
    bytes calldata signature, // signature on fee + digest
    bytes calldata callData
  ) external override nonReentrant returns (TransactionData memory) {
    // Get the hash of the invariant tx data. This hash is the same
    // between sending and receiving chains. The variant data is stored
    // in the contract when `prepare` is called within the mapping.
    bytes32 digest = hashInvariantTransactionData(txData);

    // Make sure that the variant data matches what was stored
    require(variantTransactionData[digest] == hashVariantTransactionData(txData), "fulfill: INVALID_VARIANT_DATA");

    // Make sure the expiry has not elapsed
    require(txData.expiry > block.timestamp, "fulfill: EXPIRED");

    // Make sure the transaction wasn't already completed
    require(txData.preparedBlockNumber > 0, "fulfill: ALREADY_COMPLETED");

    // Validate the user has signed
    require(recoverFulfillSignature(txData, relayerFee, signature) == txData.user, "fulfill: INVALID_SIGNATURE");

    // Sanity check: fee <= amount. Allow `=` in case of only wanting to execute
    // 0-value crosschain tx, so only providing the fee amount
    require(relayerFee <= txData.amount, "fulfill: INVALID_RELAYER_FEE");

    // Check provided callData matches stored hash
    require(keccak256(callData) == txData.callDataHash, "fulfill: INVALID_CALL_DATA");

    // To prevent `fulfill` / `cancel` from being called multiple times, the
    // preparedBlockNumber is set to 0 before being hashed. The value of the
    // mapping is explicitly *not* zeroed out so users who come online without
    // a store can tell the difference between a transaction that has not been
    // prepared, and a transaction that was already completed on the receiver
    // chain.
    variantTransactionData[digest] = keccak256(abi.encode(VariantTransactionData({
      amount: txData.amount,
      expiry: txData.expiry,
      preparedBlockNumber: 0
    })));

    // Remove the transaction prepared block from the active blocks
    removeUserActiveBlocks(txData.user, txData.preparedBlockNumber);

    if (txData.sendingChainId == chainId) {
      // The router is completing the transaction, they should get the
      // amount that the user deposited credited to their liquidity
      // reserves.

      // Make sure that the user is not accidentally fulfilling the transaction
      // on the sending chain
      require(msg.sender == txData.router, "fulfill: ROUTER_MISMATCH");

      // Complete tx to router for original sending amount
      routerBalances[txData.router][txData.sendingAssetId] += txData.amount;
    } else {
      // The user is completing the transaction, they should get the
      // amount that the router deposited less fees for relayer.

      // Get the amount to send
      uint256 toSend = txData.amount - relayerFee;

      // Send the relayer the fee
      if (relayerFee > 0) {
        require(
          LibAsset.transferAsset(txData.receivingAssetId, payable(msg.sender), relayerFee),
          "fulfill: FEE_TRANSFER_FAILED"
        );
      }

      // Handle receiver chain external calls if needed
      if (txData.callTo == address(0)) {
        // No external calls, send directly to receiving address
        require(
          LibAsset.transferAsset(txData.receivingAssetId, payable(txData.receivingAddress), toSend),
          "fulfill: TRANSFER_FAILED"
        );
      } else {
        // Handle external calls with a fallback to the receiving
        // address in case the call fails so the funds dont remain
        // locked.

        // First, approve the funds to the helper if needed
        if (!LibAsset.isEther(txData.receivingAssetId) && toSend > 0) {
          require(LibERC20.approve(txData.receivingAssetId, txData.callTo, toSend), "fulfill: APPROVAL_FAILED");
        }

        // Next, call `addFunds` on the helper. Helpers should internally
        // track funds to make sure no one user is able to take all funds
        // for tx
        if (toSend > 0) {
          try
            IFulfillHelper(txData.callTo).addFunds{ value: LibAsset.isEther(txData.receivingAssetId) ? toSend : 0}(
              txData.user,
              txData.transactionId,
              txData.receivingAssetId,
              toSend
            )
          {} catch {
            // Regardless of error within the callData execution, send funds
            // to the predetermined fallback address
            require(
              LibAsset.transferAsset(txData.receivingAssetId, payable(txData.receivingAddress), toSend),
              "fulfill: TRANSFER_FAILED"
            );
          }
        }

        // Call `execute` on the helper
        try
          IFulfillHelper(txData.callTo).execute(
            txData.user,
            txData.transactionId,
            txData.receivingAssetId,
            toSend,
            callData
          )
        {} catch {
          // Regardless of error within the callData execution, send funds
          // to the predetermined fallback address
          require(
            LibAsset.transferAsset(txData.receivingAssetId, payable(txData.receivingAddress), toSend),
            "fulfill: TRANSFER_FAILED"
          );
        }
      }
    }

    // Emit event
    emit TransactionFulfilled(txData.user, txData.router, txData.transactionId, txData, relayerFee, signature, callData, msg.sender);

    return txData;
  }

  /// @notice Any crosschain transaction can be cancelled after it has been
  ///         created to prevent indefinite lock up of funds. After the
  ///         transaction has expired, anyone can cancel it. Before the
  ///         expiry, only the recipient of the funds on the given chain is
  ///         able to cancel. On the sending chain, this means only the router
  ///         is able to cancel before the expiry, while only the user can
  ///         prematurely cancel on the receiving chain.
  /// @param txData All of the data (invariant and variant) for a crosschain
  ///               transaction. The variant data provided is checked against
  ///               what was stored when the `prepare` function was called.
  /// @param relayerFee The fee that should go to the relayer when they are
  ///                   calling the function for the user
  /// @param signature The user's signature that allows a transaction to be
  ///                  cancelled on the receiving chain.
  function cancel(TransactionData calldata txData, uint256 relayerFee, bytes calldata signature)
    external
    override
    nonReentrant
    returns (TransactionData memory)
  {
    // Make sure params match against stored data
    // Also checks that there is an active transfer here
    // Also checks that sender or receiver chainID is this chainId (bc we checked it previously)

    // Get the hash of the invariant tx data. This hash is the same
    // between sending and receiving chains. The variant data is stored
    // in the contract when `prepare` is called within the mapping.
    bytes32 digest = hashInvariantTransactionData(txData);

    // Verify the variant data is correct
    require(variantTransactionData[digest] == hashVariantTransactionData(txData), "cancel: INVALID_VARIANT_DATA");

    // Make sure the transaction wasn't already completed
    require(txData.preparedBlockNumber > 0, "cancel: ALREADY_COMPLETED");

    // Sanity check: fee <= amount. Allow `=` in case of only wanting to execute
    // 0-value crosschain tx, so only providing the fee amount
    require(relayerFee <= txData.amount, "cancel: INVALID_RELAYER_FEE");

    // To prevent `fulfill` / `cancel` from being called multiple times, the
    // preparedBlockNumber is set to 0 before being hashed. The value of the
    // mapping is explicitly *not* zeroed out so users who come online without
    // a store can tell the difference between a transaction that has not been
    // prepared, and a transaction that was already completed on the receiver
    // chain.
    variantTransactionData[digest] = keccak256(abi.encode(VariantTransactionData({
      amount: txData.amount,
      expiry: txData.expiry,
      preparedBlockNumber: 0
    })));

    // Remove active blocks
    removeUserActiveBlocks(txData.user, txData.preparedBlockNumber);

    // Return the appropriate locked funds
    if (txData.sendingChainId == chainId) {
      // Sender side, funds must be returned to the user
      if (txData.expiry >= block.timestamp) {
        // Timeout has not expired and tx may only be cancelled by router
        // NOTE: no need to validate the signature here, since you are requiring
        // the router must be the sender when the cancellation is during the
        // fulfill-able window
        require(msg.sender == txData.router, "cancel: ROUTER_MUST_CANCEL");

        // Return totality of locked funds to provided fallbacl
        require(
          LibAsset.transferAsset(txData.sendingAssetId, payable(txData.sendingChainFallback), txData.amount),
          "cancel: TRANSFER_FAILED"
        );
      } else {
        // When the user could be unlocking funds through a relayer, validate
        // their signature and payout the relayer.
        if (relayerFee > 0) {
          require(recoverCancelSignature(txData, relayerFee, signature) == txData.user, "cancel: INVALID_SIGNATURE");

          require(
            LibAsset.transferAsset(txData.receivingAssetId, payable(msg.sender), relayerFee),
            "cancel: FEE_TRANSFER_FAILED"
          );
        }

        // Get the amount to refund the user
        uint256 toRefund = txData.amount - relayerFee;

        // Return locked funds to sending chain fallback
        if (toRefund > 0) {
          require(
            LibAsset.transferAsset(txData.sendingAssetId, payable(txData.sendingChainFallback), toRefund),
            "cancel: TRANSFER_FAILED"
          );
        }
      }

    } else {
      // Receiver side, router liquidity is returned
      if (txData.expiry >= block.timestamp) {
        // Timeout has not expired and tx may only be cancelled by user
        // Validate signature
        require(recoverCancelSignature(txData, relayerFee, signature) == txData.user, "cancel: INVALID_SIGNATURE");

        // NOTE: there is no incentive here for relayers to submit this on
        // behalf of the user (i.e. fee not respected) because the user has not
        // locked funds on this contract.
      }

      // Return liquidity to router
      routerBalances[txData.router][txData.receivingAssetId] += txData.amount;
    }

    // Emit event
    emit TransactionCancelled(txData.user, txData.router, txData.transactionId, txData, relayerFee, msg.sender);

    // Return
    return txData;
  }

  // helper method to get full array of active blocks
  function getActiveTransactionBlocks(address user) external override view returns (uint256[] memory) {
    return activeTransactionBlocks[user];
  }

  //////////////////////////
  /// Private functions ///
  //////////////////////////

  /// @notice Removes a given block from the tracked activeTransactionBlocks
  ///         array for the user. Called when transactions are completed.
  /// @param user User who has completed a transaction
  /// @param preparedBlock The TransactionData.preparedBlockNumber to remove
  function removeUserActiveBlocks(address user, uint256 preparedBlock) internal {
    // Remove active blocks
    uint256 newLength = activeTransactionBlocks[user].length - 1;
    uint256[] memory updated = new uint256[](newLength);
    bool removed = false;
    uint256 updatedIdx = 0;
    for (uint256 i; i < newLength + 1; i++) {
      // Handle case where there could be more than one tx added in a block
      // And only one should be removed
      if (!removed && activeTransactionBlocks[user][i] == preparedBlock) {
        removed = true;
        continue;
      }
      updated[updatedIdx] = activeTransactionBlocks[user][i];
      updatedIdx++;
    }
    activeTransactionBlocks[user] = updated;
  }

  /// @notice Recovers the signer from the signature provided to the `fulfill`
  ///         function. Returns the address recovered
  /// @param txData TransactionData of the transaction being fulfilled
  /// @param relayerFee The fee paid to the relayer for submitting the fulfill
  ///                   tx on behalf of the user.
  /// @param signature The signature you are recovering the signer from
  function recoverFulfillSignature(
    TransactionData calldata txData,
    uint256 relayerFee,
    bytes calldata signature
  ) internal pure returns (address) {
    // Create the signed payload
    SignedFulfillData memory payload = SignedFulfillData({transactionId: txData.transactionId, relayerFee: relayerFee});

    // Recover
    return ECDSA.recover(ECDSA.toEthSignedMessageHash(keccak256(abi.encode(payload))), signature);
  }

  /// @notice Recovers the signer from the signature provided to the `cancel`
  ///         function. Returns the address recovered
  /// @param txData TransactionData of the transaction being fulfilled
  /// @param relayerFee The fee paid to the relayer for submitting the cancel
  ///                   tx on behalf of the user.
  /// @param signature The signature you are recovering the signer from
  function recoverCancelSignature(TransactionData calldata txData, uint256 relayerFee, bytes calldata signature)
    internal
    pure
    returns (address)
  {
    // Create the signed payload
    SignedCancelData memory payload = SignedCancelData({transactionId: txData.transactionId, cancel: "cancel", relayerFee: relayerFee});

    // Recover
    return ECDSA.recover(ECDSA.toEthSignedMessageHash(keccak256(abi.encode(payload))), signature);
  }

  /// @notice Returns the hash of only the invariant portions of a given
  ///         crosschain transaction
  /// @param txData TransactionData to hash
  function hashInvariantTransactionData(TransactionData calldata txData) internal pure returns (bytes32) {
    InvariantTransactionData memory invariant = InvariantTransactionData({
      user: txData.user,
      router: txData.router,
      sendingAssetId: txData.sendingAssetId,
      receivingAssetId: txData.receivingAssetId,
      sendingChainFallback: txData.sendingChainFallback,
      callTo: txData.callTo,
      receivingAddress: txData.receivingAddress,
      sendingChainId: txData.sendingChainId,
      receivingChainId: txData.receivingChainId,
      callDataHash: txData.callDataHash,
      transactionId: txData.transactionId
    });
    return keccak256(abi.encode(invariant));
  }

  /// @notice Returns the hash of only the variant portions of a given
  ///         crosschain transaction
  /// @param txData TransactionData to hash
  function hashVariantTransactionData(TransactionData calldata txData) internal pure returns (bytes32) {
    return keccak256(abi.encode(VariantTransactionData({
      amount: txData.amount,
      expiry: txData.expiry,
      preparedBlockNumber: txData.preparedBlockNumber
    })));
  }
}
