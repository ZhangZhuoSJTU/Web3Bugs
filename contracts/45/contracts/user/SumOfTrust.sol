//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/ICreditLimitModel.sol";

contract SumOfTrust is Ownable, ICreditLimitModel {
    using Math for uint256;

    bool public constant override isCreditLimitModel = true;
    uint256 public override effectiveNumber;

    constructor(uint256 effectiveNumber_) {
        effectiveNumber = effectiveNumber_;
    }

    function getCreditLimit(uint256[] memory vouchs) public view override returns (uint256) {
        if (vouchs.length >= effectiveNumber) {
            uint256 limit;
            for (uint256 i = 0; i < vouchs.length; i++) {
                limit += vouchs[i];
            }

            return limit;
        } else {
            return 0;
        }
    }

    function getLockedAmount(
        LockedInfo[] memory array,
        address account,
        uint256 amount,
        bool isIncrease
    ) public pure override returns (uint256) {
        if (array.length == 0) return 0;

        uint256 remaining = amount;
        uint256 newLockedAmount;
        if (isIncrease) {
            array = _sortArray(array, true);
            for (uint256 i = 0; i < array.length; i++) {
                uint256 remainingVouchingAmount;
                if (array[i].vouchingAmount > array[i].lockedAmount) {
                    remainingVouchingAmount = array[i].vouchingAmount - array[i].lockedAmount;
                } else {
                    remainingVouchingAmount = 0;
                }

                if (remainingVouchingAmount > array[i].availableStakingAmount) {
                    if (array[i].availableStakingAmount > remaining) {
                        newLockedAmount = array[i].lockedAmount + remaining;
                        remaining = 0;
                    } else {
                        newLockedAmount = array[i].lockedAmount + array[i].availableStakingAmount;
                        remaining = remaining - array[i].availableStakingAmount;
                    }
                } else {
                    if (remainingVouchingAmount > remaining) {
                        newLockedAmount = array[i].lockedAmount + remaining;
                        remaining = 0;
                    } else {
                        newLockedAmount = array[i].lockedAmount + remainingVouchingAmount;
                        remaining -= remainingVouchingAmount;
                    }
                }

                if (account == array[i].staker) {
                    return newLockedAmount;
                }
            }
        } else {
            array = _sortArray(array, false);
            for (uint256 i = 0; i < array.length; i++) {
                if (array[i].lockedAmount > remaining) {
                    newLockedAmount = array[i].lockedAmount - remaining;
                    remaining = 0;
                } else {
                    newLockedAmount = 0;
                    remaining -= array[i].lockedAmount;
                }

                if (account == array[i].staker) {
                    return newLockedAmount;
                }
            }
        }

        return 0;
    }

    function setEffectNumber(uint256 number) external onlyOwner {
        effectiveNumber = number;
    }

    function _sortArray(LockedInfo[] memory arr, bool isPositive) private pure returns (LockedInfo[] memory) {
        uint256 length = arr.length;

        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = i + 1; j < length; j++) {
                if (isPositive) {
                    if (arr[i].vouchingAmount < arr[j].vouchingAmount) {
                        LockedInfo memory temp = arr[j];
                        arr[j] = arr[i];
                        arr[i] = temp;
                    }
                } else {
                    if (arr[i].vouchingAmount > arr[j].vouchingAmount) {
                        LockedInfo memory temp = arr[j];
                        arr[j] = arr[i];
                        arr[i] = temp;
                    }
                }
            }
        }

        return arr;
    }
}
