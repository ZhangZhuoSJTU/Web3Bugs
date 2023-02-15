// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";

/**
 * @title   ArbitratorVault
 * @author  ConvexFinance
 * @notice  Hold extra reward tokens on behalf of pools that have the same token as a reward (e.g. stkAAVE fro multiple aave pools)
 * @dev     Sits on top of the STASH to basically handle the re-distribution of rewards to multiple stashes.
 *          Because anyone can call gauge.claim_rewards(address) for the convex staking contract, rewards
 *          could be forced to the wrong pool. Hold tokens here and distribute fairly(or at least more fairly),
 *          to both pools at a later timing.
 */
contract ArbitratorVault{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public operator;
    address public immutable depositor;


    /**
     * @param  _depositor Booster address
     */
    constructor(address _depositor)public
    {
        operator = msg.sender;
        depositor = _depositor;
    }

    function setOperator(address _op) external {
        require(msg.sender == operator, "!auth");
        operator = _op;
    }

    /**
    * @notice  Permissioned fn to distribute any accrued rewards to a relevant stash
    * @dev     Only called by operator: ConvexMultisig
    */
    function distribute(address _token, uint256[] calldata _toPids, uint256[] calldata _amounts) external {
       require(msg.sender == operator, "!auth");

       for(uint256 i = 0; i < _toPids.length; i++){
        //get stash from pid
        (,,,,address stashAddress,bool shutdown) = IDeposit(depositor).poolInfo(_toPids[i]);

        //if sent to a shutdown pool, could get trapped
        require(shutdown==false,"pool closed");

        //transfer
        IERC20(_token).safeTransfer(stashAddress, _amounts[i]);
       }
    }

}