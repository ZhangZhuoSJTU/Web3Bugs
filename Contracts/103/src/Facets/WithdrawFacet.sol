// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { LibDiamond } from "../Libraries/LibDiamond.sol";

contract WithdrawFacet {
    using SafeERC20 for IERC20;
    address private constant NATIVE_ASSET = address(0);

    event LogWithdraw(address indexed _assetAddress, address _from, uint256 amount);

    /**
     * @dev Withdraw asset.
     * @param _assetAddress Asset to be withdrawn.
     * @param _to address to withdraw to.
     * @param _amount amount of asset to withdraw.
     */
    function withdraw(
        address _assetAddress,
        address _to,
        uint256 _amount
    ) public {
        LibDiamond.enforceIsContractOwner();
        address sendTo = (_to == address(0)) ? msg.sender : _to;
        uint256 assetBalance;
        if (_assetAddress == NATIVE_ASSET) {
            address self = address(this); // workaround for a possible solidity bug
            assert(_amount <= self.balance);
            payable(sendTo).transfer(_amount);
        } else {
            assetBalance = IERC20(_assetAddress).balanceOf(address(this));
            assert(_amount <= assetBalance);
            IERC20(_assetAddress).safeTransfer(sendTo, _amount);
        }
        emit LogWithdraw(sendTo, _assetAddress, _amount);
    }
}
