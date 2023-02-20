//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../interfaces/ICreditLimitModel.sol";

contract CreditLimitByMedian is Ownable, ICreditLimitModel {
    using Math for uint256;

    bool public constant override isCreditLimitModel = true;
    uint256 public override effectiveNumber;

    constructor(uint256 effectiveNumber_) {
        effectiveNumber = effectiveNumber_;
    }

    function getCreditLimit(uint256[] memory vouchs) public view override returns (uint256) {
        if (vouchs.length >= effectiveNumber) {
            return _findMedian(vouchs);
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

        uint256 newLockedAmount;
        if (isIncrease) {
            for (uint256 i = 0; i < array.length; i++) {
                uint256 remainingVouchingAmount;
                if (array[i].vouchingAmount > array[i].lockedAmount) {
                    remainingVouchingAmount = array[i].vouchingAmount - array[i].lockedAmount;
                } else {
                    remainingVouchingAmount = 0;
                }

                if (remainingVouchingAmount > array[i].availableStakingAmount) {
                    if (array[i].availableStakingAmount > amount) {
                        newLockedAmount = array[i].lockedAmount + amount;
                    } else {
                        newLockedAmount = array[i].lockedAmount + array[i].availableStakingAmount;
                    }
                } else {
                    if (remainingVouchingAmount > amount) {
                        newLockedAmount = array[i].lockedAmount + amount;
                    } else {
                        newLockedAmount = array[i].lockedAmount + remainingVouchingAmount;
                    }
                }

                if (account == array[i].staker) {
                    return newLockedAmount;
                }
            }
        } else {
            for (uint256 i = 0; i < array.length; i++) {
                if (array[i].lockedAmount > amount) {
                    newLockedAmount = array[i].lockedAmount - 1;
                } else {
                    newLockedAmount = 0;
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

    /**
     *  @dev Find median from uint array
     *  @param array array
     *  @return uint256
     */
    function _findMedian(uint256[] memory array) private pure returns (uint256) {
        uint256[] memory arr = _sortArray(array);
        if (arr.length == 0) return 0;

        if (arr.length % 2 == 0) {
            uint256 num1 = arr[arr.length >> 1];
            uint256 num2 = arr[(arr.length >> 1) - 1];
            return num1.average(num2);
        } else {
            return arr[arr.length >> 1];
        }
    }

    /**
     *  @dev Sort uint array
     *  @param arr array
     *  @return uint256 array
     */
    function _sortArray(uint256[] memory arr) private pure returns (uint256[] memory) {
        uint256 length = arr.length;

        for (uint256 i = 0; i < length; i++) {
            for (uint256 j = i + 1; j < length; j++) {
                if (arr[i] < arr[j]) {
                    uint256 temp = arr[j];
                    arr[j] = arr[i];
                    arr[i] = temp;
                }
            }
        }

        return arr;
    }
}
