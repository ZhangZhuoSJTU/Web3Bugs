// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/vendor/IBooster.sol";
import "../testing/MockErc20.sol";
import "./MockRewardStaking.sol";

// solhint-disable no-unused-vars
contract MockBooster is IBooster {
    address public lpToken;
    address public token;
    address public crvRewards;

    mapping(address => uint256) public balances;

    constructor(
        address _lpToken,
        address _token,
        address _crvRewards
    ) {
        lpToken = _lpToken;
        token = _token;
        crvRewards = _crvRewards;
    }

    function deposit(
        uint256 _pid,
        uint256 _amount,
        bool _stake
    ) external override returns (bool) {
        IERC20(lpToken).transferFrom(msg.sender, address(this), _amount);
        if (_stake) {
            MockErc20(token).mint_for_testing(address(this), _amount);
            balances[msg.sender] += _amount;
            MockErc20(token).approve(crvRewards, _amount);
            MockRewardStaking(crvRewards).stakeFor(msg.sender, _amount);
        } else {
            MockErc20(token).mint_for_testing(msg.sender, _amount);
        }
        return true;
    }

    function withdraw(uint256 _pid, uint256 _amount) external override returns (bool) {
        MockErc20(token).transferFrom(msg.sender, address(0), _amount);
        IERC20(lpToken).transfer(msg.sender, _amount);
        return true;
    }

    function withdrawTo(
        uint256 _pid,
        uint256 _amount,
        address _to
    ) external override returns (bool) {
        MockErc20(token).transferFrom(msg.sender, address(0), _amount);
        IERC20(lpToken).transfer(_to, _amount);
        return true;
    }

    function withdrawAll(uint256 _pid) external override returns (bool) {
        return true;
    }

    function depositAll(uint256 _pid, bool _stake) external override returns (bool) {
        return true;
    }

    function poolInfo(uint256 pid)
        external
        view
        override
        returns (
            address,
            address,
            address,
            address,
            address,
            bool
        )
    {
        return (lpToken, token, address(0), crvRewards, address(0), false);
    }
}
