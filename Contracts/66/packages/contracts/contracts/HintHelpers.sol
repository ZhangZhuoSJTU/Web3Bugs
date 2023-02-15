// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IWhitelist.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

/** 
 * Hint helpers is a contract for giving approximate insert positions for a trove after 
 * an operation, such as partial redemption re-insert, adjust trove, etc. 
 */

contract HintHelpers is LiquityBase, Ownable, CheckContract {
    bytes32 constant public NAME = "HintHelpers";

    ISortedTroves internal sortedTroves;
    ITroveManager internal troveManager;

    // --- Events ---

    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);
    event WhitelistAddressChanged(address _troveManagerAddress);

    // --- Dependency setters ---

    function setAddresses(
        address _sortedTrovesAddress,
        address _troveManagerAddress,
        address _whitelistAddress
    )
        external
        onlyOwner
    {
        checkContract(_sortedTrovesAddress);
        checkContract(_troveManagerAddress);
        checkContract(_whitelistAddress);

        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        troveManager = ITroveManager(_troveManagerAddress);
        whitelist = IWhitelist(_whitelistAddress);

        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit WhitelistAddressChanged(_troveManagerAddress);

        _renounceOwnership();
    }

    // --- Functions ---

    /* getRedemptionHints() - Helper function for finding the right hints to pass to redeemCollateral().
     *
     * It simulates a redemption of `_YUSDamount` to figure out where the redemption sequence will start and what state the final Trove
     * of the sequence will end up in.
     *
     * Returns three hints:
     *  - `firstRedemptionHint` is the address of the first Trove with ICR >= MCR (i.e. the first Trove that will be redeemed).
     *  - `partialRedemptionHintICR` is the final ICR of the last Trove of the sequence after being hit by partial redemption,
     *     or zero in case of no partial redemption.
     *  - `truncatedYUSDamount` is the maximum amount that can be redeemed out of the the provided `_YUSDamount`. This can be lower than
     *    `_YUSDamount` when redeeming the full amount would leave the last Trove of the redemption sequence with less net debt than the
     *    minimum allowed value (i.e. MIN_NET_DEBT).
     *
     * The number of Troves to consider for redemption can be capped by passing a non-zero value as `_maxIterations`, while passing zero
     * will leave it uncapped.
     */

    function getRedemptionHints(
        uint _YUSDamount, 
        uint _maxIterations
    )
        external
        view
        returns (
            address firstRedemptionHint,
            uint partialRedemptionHintICR,
            uint truncatedYUSDamount
        )
    {
        ISortedTroves sortedTrovesCached = sortedTroves;

        uint remainingYUSD = _YUSDamount;
        address currentTroveuser = sortedTrovesCached.getLast();

        while (currentTroveuser != address(0) && sortedTroves.getOldICR(currentTroveuser) < MCR) {
            currentTroveuser = sortedTrovesCached.getPrev(currentTroveuser);
        }

        firstRedemptionHint = currentTroveuser;

        if (_maxIterations == 0) {
            _maxIterations = uint(-1);
        }

        while (currentTroveuser != address(0) && remainingYUSD != 0 && _maxIterations-- != 0) {
            uint netYUSDDebt = _getNetDebt(troveManager.getTroveDebt(currentTroveuser))
                .add(troveManager.getPendingYUSDDebtReward(currentTroveuser));

            if (netYUSDDebt > remainingYUSD) { // Partial redemption
                if (netYUSDDebt > MIN_NET_DEBT) { // MIN NET DEBT = 1800
                    uint maxRedeemableYUSD = LiquityMath._min(remainingYUSD, netYUSDDebt.sub(MIN_NET_DEBT));

                    uint newColl = _calculateVCAfterRedemption(currentTroveuser, maxRedeemableYUSD);
                    uint newDebt = netYUSDDebt.sub(maxRedeemableYUSD);

                    uint compositeDebt = _getCompositeDebt(newDebt);
                    partialRedemptionHintICR = LiquityMath._computeCR(newColl, compositeDebt);

                    remainingYUSD = remainingYUSD.sub(maxRedeemableYUSD);
                }
                break;
            } else { // Full redemption in this case
                remainingYUSD = remainingYUSD.sub(netYUSDDebt);
            }

            currentTroveuser = sortedTrovesCached.getPrev(currentTroveuser);
        }

        truncatedYUSDamount = _YUSDamount.sub(remainingYUSD);
    }

    // Function for calculating the VC of a trove after a redemption, since the value is given out proportionally to the 
    // USD Value of the collateral. Same function is used in TroveManagerRedemptions for the same purpose. 
    function _calculateVCAfterRedemption(address _borrower, uint _YUSDAmount) internal view returns (uint newCollVC) {
        newColls memory colls;
        (colls.tokens, colls.amounts, ) = troveManager.getCurrentTroveState(_borrower);

        uint256[] memory finalAmounts = new uint256[](colls.tokens.length);

        uint totalCollUSD = _getUSDColls(colls);
        uint baseLot = _YUSDAmount.mul(DECIMAL_PRECISION);

        // redemption addresses are the same as coll addresses for trove
        uint256 tokensLen = colls.tokens.length;
        for (uint256 i; i < tokensLen; ++i) {
            uint tokenAmount = colls.amounts[i];
            uint tokenAmountToRedeem = baseLot.mul(tokenAmount).div(totalCollUSD).div(DECIMAL_PRECISION);
            finalAmounts[i] = tokenAmount.sub(tokenAmountToRedeem);
        }

        newCollVC = _getVC(colls.tokens, finalAmounts);
    }


    /* getApproxHint() - return address of a Trove that is, on average, (length / numTrials) positions away in the 
    sortedTroves list from the correct insert position of the Trove to be inserted. 
    
    Note: The output address is worst-case O(n) positions away from the correct insert position, however, the function 
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput address will 
    be <= sqrt(length) positions away from the correct insert position.
    */
    function getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)
        external
        view
        returns (address hintAddress, uint diff, uint latestRandomSeed)
    {
        uint arrayLength = troveManager.getTroveOwnersCount();

        if (arrayLength == 0) {
            return (address(0), 0, _inputRandomSeed);
        }

        hintAddress = sortedTroves.getLast();
        diff = LiquityMath._getAbsoluteDifference(_CR, sortedTroves.getOldICR(hintAddress));
        latestRandomSeed = _inputRandomSeed;

        uint i = 1;

        while (i < _numTrials) {
            latestRandomSeed = uint(keccak256(abi.encodePacked(latestRandomSeed)));

            uint arrayIndex = latestRandomSeed % arrayLength;
            address currentAddress = troveManager.getTroveFromTroveOwnersArray(arrayIndex);
            uint currentICR = sortedTroves.getOldICR(currentAddress);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint currentDiff = LiquityMath._getAbsoluteDifference(currentICR, _CR);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            ++i;
        }
    }
}
