// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract MockDRewards {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public lpToken;
    IERC20 public rewardToken;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    uint256 rewardRate; // over 1000

    constructor(
        address _lpToken,
        address _rewardToken,
        uint256 _rewardRate
    ) public {
        lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function earned(address account) public view returns (uint256) {
        return balanceOf(account).mul(rewardRate).div(1000);
    }

    function stake(uint256 amount) public {
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        lpToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public {
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        lpToken.safeTransfer(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
        getReward();
    }

    function getReward() public {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            if (reward > rewardToken.balanceOf(address(this))) {
                reward = rewardToken.balanceOf(address(this));
            }
            rewardToken.safeTransfer(msg.sender, reward);
        }
    }
}
