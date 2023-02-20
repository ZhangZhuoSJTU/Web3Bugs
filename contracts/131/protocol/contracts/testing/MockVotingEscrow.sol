// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/vendor/IGauge.sol";
import "./MockErc20.sol";

contract MockVotingEscrow is IVotingEscrow {
    // mock total veCRV supply
    uint256 private _supply = 0;

    address private _crvToken;

    // veCRV balances
    mapping(address => uint256) private _balances;

    constructor(address crvToken_) {
        _crvToken = crvToken_;
    }

    // we don't actually lock tokens and we don't account for linear decay in balance
    // solhint-disable-next-line func-name-mixedcase
    function create_lock(
        uint256 _value,
        uint256 /* _time */
    ) external override {
        require(
            MockErc20(_crvToken).balanceOf(msg.sender) >= _value,
            "msg.sender has insufficient funds to lock"
        );
        _deposit(_value);
    }

    // solhint-disable-next-line func-name-mixedcase
    function increase_amount(uint256 _value) external override {
        require(_balances[msg.sender] > 0, "a lock needs to first be created");
        _deposit(_value);
    }

    // solhint-disable-next-line func-name-mixedcase
    function increase_unlock_time(uint256 unlockTime) external override {}

    function withdraw() external override {
        // We don't withdraw; skip for mocking
    }

    // mock change in total veCRV supply
    function updateTotalSupply(uint256 amount) external {
        _supply = amount;
    }

    function balanceOf(address _address) external view override returns (uint256) {
        return _balances[_address];
    }

    function totalSupply() external view override returns (uint256) {
        return _supply;
    }

    function _deposit(uint256 amount) internal {
        MockErc20(_crvToken).transferFrom(msg.sender, address(this), amount);
        _balances[msg.sender] += amount;
        _supply += amount;
    }
}
