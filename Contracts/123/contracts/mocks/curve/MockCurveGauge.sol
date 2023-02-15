// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

contract MockCurveGauge is ERC20 {
    address public lp_token;

    // V2 gauge
    address[] public reward_tokens;

    constructor(
        string memory _name,
        string memory _symbol,
        address _lptoken,
        address[] memory _rewardTokens
    ) ERC20(_name, _symbol) {
        lp_token = _lptoken;
        reward_tokens = _rewardTokens;
    }

    function deposit(uint256 amount) external {
        _mint(msg.sender, amount);
        IERC20(lp_token).transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        IERC20(lp_token).transfer(msg.sender, amount);
    }

    function claim_rewards() external {
        uint256 amount = balanceOf(msg.sender);

        for (uint256 i = 0; i < reward_tokens.length; i++) {
            IERC20(reward_tokens[i]).transfer(msg.sender, amount);
        }
    }

    function claimable_reward(address, address) external view returns (uint256) {
        return 0;
    }

    function deposit_reward_token(address, uint256) external {}

    function add_reward(address _reward_token, address _distributor) external {}
}
