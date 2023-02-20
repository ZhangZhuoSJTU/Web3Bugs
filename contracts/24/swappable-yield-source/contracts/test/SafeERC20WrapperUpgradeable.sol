// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

// Mock implementation from OpenZeppelin modified for our usage in tests
// https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/contracts/mocks/SafeERC20HelperUpgradeable.sol
contract ERC20ReturnTrueMockUpgradeable is Initializable, ContextUpgradeable, ERC20Upgradeable {
    // solhint-disable func-name-mixedcase
    function __ERC20ReturnTrueMock_init() internal initializer {
        __Context_init_unchained();
        __ERC20ReturnTrueMock_init_unchained();
    }

    // solhint-disable func-name-mixedcase
    function __ERC20ReturnTrueMock_init_unchained() internal initializer {
    }
    mapping (address => uint256) private _allowances;

    // IERC20's functions are not pure, but these mock implementations are: to prevent Solidity from issuing warnings,
    // we write to a dummy state variable.
    uint256 private _dummy;

    function transfer(address, uint256) public override returns (bool) {
        _dummy = 0;
        return true;
    }

    function transferFrom(address, address, uint256) public override returns (bool) {
        _dummy = 0;
        return true;
    }

    function approve(address, uint256) public override returns (bool) {
        _dummy = 0;
        return true;
    }

    function setAllowance(uint256 allowance_) public {
        _allowances[_msgSender()] = allowance_;
    }

    function allowance(address owner, address) public view override returns (uint256) {
        return _allowances[owner];
    }
    uint256[48] private __gap;
}

contract SafeERC20WrapperUpgradeable is Initializable, ContextUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable private _token;

    // solhint-disable func-name-mixedcase
    function __SafeERC20Wrapper_init(IERC20Upgradeable token) internal initializer {
        __Context_init_unchained();
        __SafeERC20Wrapper_init_unchained(token);
    }

    // solhint-disable func-name-mixedcase
    function __SafeERC20Wrapper_init_unchained(IERC20Upgradeable token) internal initializer {
        _token = token;
    }

    function balanceOf(address account) public view returns (uint256) {
        _token.balanceOf(account);
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        _token.safeTransfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        _token.safeTransferFrom(sender, recipient, amount);
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _token.safeApprove(spender, amount);
    }

    function increaseAllowance(uint256 amount) public {
        _token.safeIncreaseAllowance(address(0), amount);
    }

    function decreaseAllowance(uint256 amount) public {
        _token.safeDecreaseAllowance(address(0), amount);
    }

    function setAllowance(uint256 allowance_) public {
        ERC20ReturnTrueMockUpgradeable(address(_token)).setAllowance(allowance_);
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _token.allowance(owner, spender);
    }
    uint256[49] private __gap;
}
