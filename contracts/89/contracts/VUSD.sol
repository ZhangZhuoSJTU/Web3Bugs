// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC20PresetMinterPauserUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";

import { VanillaGovernable } from "./legos/Governable.sol";

contract VUSD is VanillaGovernable, ERC20PresetMinterPauserUpgradeable {
    using SafeERC20 for IERC20;

    struct Withdrawal {
        address usr;
        uint amount;
    }

    /// @notice vUSD is backed 1:1 with reserveToken (USDC)
    IERC20 public immutable reserveToken;

    Withdrawal[] public withdrawals;

    /// @dev withdrawals will start processing at withdrawals[start]
    uint public start;

    /// @dev Constrained by block gas limit
    uint public maxWithdrawalProcesses;

    uint256[50] private __gap;

    constructor(address _reserveToken) {
        require(_reserveToken != address(0), "vUSD: null _reserveToken");
        reserveToken = IERC20(_reserveToken);
    }

    function init(address _governance) external {
        super.initialize("Hubble USD", "hUSD"); // has initializer modifier
        _setGovernace(_governance);
        maxWithdrawalProcesses = 100;
    }

    function mintWithReserve(address to, uint amount) external {
        reserveToken.safeTransferFrom(msg.sender, address(this), amount);
        _mint(to, amount);
    }

    function withdraw(uint amount) external {
        burn(amount);
        withdrawals.push(Withdrawal(msg.sender, amount));
    }

    function processWithdrawals() external {
        uint reserve = reserveToken.balanceOf(address(this));
        require(reserve >= withdrawals[start].amount, 'Cannot process withdrawals at this time: Not enough balance');
        uint i = start;
        while (i < withdrawals.length && (i - start) <= maxWithdrawalProcesses) {
            Withdrawal memory withdrawal = withdrawals[i];
            if (reserve < withdrawal.amount) {
                break;
            }
            reserveToken.safeTransfer(withdrawal.usr, withdrawal.amount);
            reserve -= withdrawal.amount;
            i += 1;
        }
        start = i;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function setMaxWithdrawalProcesses(uint _maxWithdrawalProcesses) external onlyGovernance {
        maxWithdrawalProcesses = _maxWithdrawalProcesses;
    }
}
