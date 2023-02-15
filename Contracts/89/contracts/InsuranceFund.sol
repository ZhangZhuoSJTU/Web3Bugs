// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import { VanillaGovernable } from "./legos/Governable.sol";
import { IRegistry } from "./Interfaces.sol";

contract InsuranceFund is VanillaGovernable, ERC20Upgradeable {
    using SafeERC20 for IERC20;

    uint8 constant DECIMALS = 6;
    uint constant PRECISION = 10 ** DECIMALS;

    IERC20 public vusd;
    address public marginAccount;
    uint public pendingObligation;

    uint256[50] private __gap;

    event FundsAdded(address indexed insurer, uint amount, uint timestamp);
    event FundsWithdrawn(address indexed insurer, uint amount, uint timestamp);
    event BadDebtAccumulated(uint amount, uint timestamp);

    modifier onlyMarginAccount() {
        require(msg.sender == address(marginAccount), "IF.only_margin_account");
        _;
    }

    function initialize(address _governance) external {
        __ERC20_init("Hubble-Insurance-Fund", "HIF"); // has initializer modifier
        _setGovernace(_governance);
    }

    function deposit(uint _amount) external {
        settlePendingObligation();
        // we want to protect new LPs, when the insurance fund is in deficit
        require(pendingObligation == 0, "IF.deposit.pending_obligations");

        uint _pool = balance();
        uint _totalSupply = totalSupply();
        if (_totalSupply == 0 && _pool > 0) { // trading fee accumulated while there were no IF LPs
            vusd.safeTransfer(governance, _pool);
            _pool = 0;
        }

        vusd.safeTransferFrom(msg.sender, address(this), _amount);
        uint shares = 0;
        if (_pool == 0) {
            shares = _amount;
        } else {
            shares = _amount * _totalSupply / _pool;
        }
        _mint(msg.sender, shares);
        emit FundsAdded(msg.sender, _amount, block.timestamp);
    }

    function withdraw(uint _shares) external {
        settlePendingObligation();
        require(pendingObligation == 0, "IF.withdraw.pending_obligations");
        uint amount = balance() * _shares / totalSupply();
        _burn(msg.sender, _shares);
        vusd.safeTransfer(msg.sender, amount);
        emit FundsWithdrawn(msg.sender, amount, block.timestamp);
    }

    function seizeBadDebt(uint amount) external onlyMarginAccount {
        pendingObligation += amount;
        emit BadDebtAccumulated(amount, block.timestamp);
        settlePendingObligation();
    }

    function settlePendingObligation() public {
        if (pendingObligation > 0) {
            uint toTransfer = Math.min(vusd.balanceOf(address(this)), pendingObligation);
            if (toTransfer > 0) {
                pendingObligation -= toTransfer;
                vusd.safeTransfer(marginAccount, toTransfer);
            }
        }
    }

    /* ****************** */
    /*        View        */
    /* ****************** */

    /**
    * @notice Just a vanity function
    */
    function pricePerShare() external view returns (uint) {
        uint _totalSupply = totalSupply();
        uint _balance = balance();
        _balance -= Math.min(_balance, pendingObligation);
        if (_totalSupply == 0 || _balance == 0) {
            return PRECISION;
        }
        return _balance * PRECISION / _totalSupply;
    }

    function balance() public view returns (uint) {
        return vusd.balanceOf(address(this));
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /* ****************** */
    /*   onlyGovernance   */
    /* ****************** */

    function syncDeps(IRegistry _registry) public onlyGovernance {
        vusd = IERC20(_registry.vusd());
        marginAccount = _registry.marginAccount();
    }
}
