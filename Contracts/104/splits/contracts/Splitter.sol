// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {SplitStorage} from "./SplitStorage.sol";
import {IRoyaltyVault} from "@chestrnft/royalty-vault/interfaces/IRoyaltyVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Splitter
 * Building on the work from the Uniswap team at Uniswap and Mirror.xyz Team
 */
contract Splitter is SplitStorage {
    /**** Mutable variables ****/
    uint256 public constant PERCENTAGE_SCALE = 10e5;
    bytes4 public constant IID_IROYALTY = type(IRoyaltyVault).interfaceId;

    // The TransferETH event is emitted after each eth transfer in the split is attempted.
    event TransferETH(
        // The account to which the transfer was attempted.
        address account,
        // The amount for transfer that was attempted.
        uint256 amount,
        // Whether or not the transfer succeeded.
        bool success
    );

    // Emits when a window is incremented.
    event WindowIncremented(uint256 currentWindow, uint256 fundsAvailable);

    /**
     * @dev Claim the funds from the all windows.
     * @param percentageAllocation {uint256} percentage of allocation to be claimed
     * @param merkleProof {bytes32} The Merkle proof of the allocation
     */
    function claimForAllWindows(
        uint256 percentageAllocation,
        bytes32[] calldata merkleProof
    ) external {
        // Make sure that the user has this allocation granted.
        require(
            verifyProof(
                merkleProof,
                merkleRoot,
                getNode(msg.sender, percentageAllocation)
            ),
            "Invalid proof"
        );

        uint256 amount = 0;
        for (uint256 i = 0; i < currentWindow; i++) {
            if (!isClaimed(msg.sender, i)) {
                setClaimed(msg.sender, i);

                amount += scaleAmountByPercentage(
                    balanceForWindow[i],
                    percentageAllocation
                );
            }
        }

        transferSplitAsset(msg.sender, amount);
    }

    /**
     * @dev get Node hash of given data.
     * @param who {address} whitelisted user address
     * @param percentageAllocation {uint256} percentage of allocation
     * @return {bytes32} node hash
     */
    function getNode(
        address who,
        uint256 percentageAllocation
    ) private pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    who,
                    percentageAllocation
                )
            );
    }

    /**
     * @dev get scaled amount from given amount and percentage.
     * @param amount {uint256} amount
     * @param scaledPercent {uint256} scaled percentage
     * @return scaledAmount {uint256} scaled amount
     */
    function scaleAmountByPercentage(uint256 amount, uint256 scaledPercent)
        public
        pure
        returns (uint256 scaledAmount)
    {
        /*
            Example:
                If there is 100 ETH in the account, and someone has 
                an allocation of 2%, we call this with 100 as the amount, and 200
                as the scaled percent.

                To find out the amount we use, for example: (100 * 200) / (100 * 100)
                which returns 2 -- i.e. 2% of the 100 ETH balance.
         */
        scaledAmount = (amount * scaledPercent) / (10000);
    }

    /**
     * @dev claim for the given window.
     * @param window {uint256} Window to claim
     * @param scaledPercentageAllocation {uint256} percentage of allocation to be claimed
     * @param merkleProof {bytes32} The Merkle proof of the allocation
     */
    function claim(
        uint256 window,
        uint256 scaledPercentageAllocation,
        bytes32[] calldata merkleProof
    ) external {
        require(currentWindow > window, "cannot claim for a future window");
        require(
            !isClaimed(msg.sender, window),
            "NFT has already claimed the given window"
        );

        setClaimed(msg.sender, window);

        require(
            verifyProof(
                merkleProof,
                merkleRoot,
                getNode(msg.sender, scaledPercentageAllocation)
            ),
            "Invalid proof"
        );

        transferSplitAsset(
            msg.sender,
            // The absolute amount that's claimable.
            scaleAmountByPercentage(
                balanceForWindow[window],
                scaledPercentageAllocation
            )
        );
    }

    /**
     * @dev Function which handles increment window and puts amount to current window
     * @param royaltyAmount {uint256} Amount needs to be added in window.
     * @return {bool} Whether or not the window was incremented.
     */
    function incrementWindow(uint256 royaltyAmount) public returns (bool) {
        uint256 wethBalance;

        require(
            IRoyaltyVault(msg.sender).supportsInterface(IID_IROYALTY),
            "Royalty Vault not supported"
        );
        require(
            IRoyaltyVault(msg.sender).getSplitter() == address(this),
            "Unauthorised to increment window"
        );

        wethBalance = IERC20(splitAsset).balanceOf(address(this));
        require(wethBalance >= royaltyAmount, "Insufficient funds");

        require(royaltyAmount > 0, "No additional funds for window");
        balanceForWindow.push(royaltyAmount);
        currentWindow += 1;
        emit WindowIncremented(currentWindow, royaltyAmount);
        return true;
    }

    /**
     * @dev Function checks if the given window and tokenId has been claimed.
     * @param who {address} whitelisted user address
     * @param window {uint256} Window to check
     * @return {bool} Whether or not the window has been claimed.
     */
    function isClaimed(
        address who,
        uint256 window
    ) public view returns (bool) {
        return claimed[getClaimHash(who, window)];
    }

    /**** Private Functions ****/

    /**
     * @dev Function checks if the given window and tokenId has been claimed.
     * @param who {address} whitelisted user address
     * @param window {uint256} Window to check
     */
    function setClaimed(
        address who,
        uint256 window
    ) private {
        claimed[getClaimHash(who, window)] = true;
    }

    /**
     * @dev Function which returns the hash of the given window, tokenId and membershipContract.
     * @param who {address} whitelisted user address
     * @param window {uint256} Window to check
     * @return {bytes32} Hash of the given window, tokenId and membershipContract.
     */
    function getClaimHash(
        address who,
        uint256 window
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(who, window));
    }

    /**
     * @dev Function to convert output amount from percentages.
     * @param amount {uint256} Amount for which percentage is to be calculated.
     * @param percent {uint256} Percentage
     * @return {uint256} Output amount.
     */
    function amountFromPercent(uint256 amount, uint32 percent)
        private
        pure
        returns (uint256)
    {
        // Solidity 0.8.0 lets us do this without SafeMath.
        return (amount * percent) / 100;
    }

    /**
     * @dev Function to transfer split asset to the given address.
     * @param to {address} Address to transfer the split asset to.
     * @param value {uint256} Amount to transfer.
     */
    function transferSplitAsset(address to, uint256 value)
        private
        returns (bool didSucceed)
    {
        // Try to transfer ETH to the given recipient.
        didSucceed = IERC20(splitAsset).transfer(to, value);
        require(didSucceed, "Failed to transfer ETH");

        emit TransferETH(to, value, didSucceed);
    }

    /**
     * @dev transfer given amount of ETH in contract to the given address.
     * @param to {address} Address to transfer asset
     * @param value {uint256} Amount to transfer
     * @return {bool} Whether or not the transfer was successful.
     */
    function attemptETHTransfer(address to, uint256 value)
        private
        returns (bool)
    {
        // Here increase the gas limit a reasonable amount above the default, and try
        // to send ETH to the recipient.
        // NOTE: This might allow the recipient to attempt a limited reentrancy attack.
        (bool success, ) = to.call{value: value, gas: 30000}("");
        return success;
    }

    // From https://github.com/protofire/zeppelin-solidity/blob/master/contracts/MerkleProof.sol
    /**
     * @dev Function to verify the given proof.
     * @param proof {bytes32[]} Proof to verify
     * @param root {bytes32} Root of the Merkle tree
     * @param leaf {bytes32} Leaf to verify
     * @return {bool} Whether or not the proof is valid.
     */
    function verifyProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) private pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                // Hash(current computed hash + current element of the proof)
                computedHash = keccak256(
                    abi.encodePacked(computedHash, proofElement)
                );
            } else {
                // Hash(current element of the proof + current computed hash)
                computedHash = keccak256(
                    abi.encodePacked(proofElement, computedHash)
                );
            }
        }

        // Check if the computed hash (root) is equal to the provided root
        return computedHash == root;
    }
}
