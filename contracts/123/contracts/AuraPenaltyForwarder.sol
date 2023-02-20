// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { IExtraRewardsDistributor } from "./Interfaces.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AuraPenaltyForwarder
 * @dev Receives a given token and forwards it on to a distribution contract. Used during
 *      the bootstrapping period to forward AURA rewards to the extra rewards distributor.
 */
contract AuraPenaltyForwarder {
    using SafeERC20 for IERC20;

    IExtraRewardsDistributor public immutable distributor;
    IERC20 public immutable token;

    uint256 public immutable distributionDelay;
    uint256 public lastDistribution;

    event Forwarded(uint256 amount);

    /**
     * @dev During deployment approves the distributor to spend all tokens
     * @param _distributor  Contract that will distribute tokens
     * @param _token        Token to be distributed
     * @param _delay        Delay between each distribution trigger
     */
    constructor(
        address _distributor,
        address _token,
        uint256 _delay
    ) {
        distributor = IExtraRewardsDistributor(_distributor);
        token = IERC20(_token);
        distributionDelay = _delay;

        lastDistribution = block.timestamp;

        token.safeApprove(address(distributor), type(uint256).max);
    }

    /**
     * @dev Forwards the complete balance of token in this contract to the distributor
     */
    function forward() public {
        require(block.timestamp > lastDistribution + distributionDelay, "!elapsed");
        lastDistribution = block.timestamp;

        uint256 bal = token.balanceOf(address(this));
        require(bal > 0, "!empty");

        distributor.addReward(address(token), bal);

        emit Forwarded(bal);
    }
}
