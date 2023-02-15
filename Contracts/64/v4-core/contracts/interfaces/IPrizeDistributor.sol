// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IDrawBuffer.sol";
import "./IDrawCalculator.sol";

/** @title  IPrizeDistributor
  * @author PoolTogether Inc Team
  * @notice The PrizeDistributor interface.
*/
interface IPrizeDistributor {

    /**
     * @notice Emit when user has claimed token from the PrizeDistributor.
     * @param user   User address receiving draw claim payouts
     * @param drawId Draw id that was paid out
     * @param payout Payout for draw
     */
    event ClaimedDraw(address indexed user, uint32 indexed drawId, uint256 payout);

    /**
     * @notice Emit when DrawCalculator is set.
     * @param calculator DrawCalculator address
     */
    event DrawCalculatorSet(IDrawCalculator indexed calculator);

    /**
     * @notice Emit when Token is set.
     * @param token Token address
     */
    event TokenSet(IERC20 indexed token);

    /**
     * @notice Emit when ERC20 tokens are withdrawn.
     * @param token  ERC20 token transferred.
     * @param to     Address that received funds.
     * @param amount Amount of tokens transferred.
     */
    event ERC20Withdrawn(IERC20 indexed token, address indexed to, uint256 amount);

    /**
     * @notice Claim prize payout(s) by submitting valud drawId(s) and winning pick indice(s). The user address
               is used as the "seed" phrase to generate random numbers.
     * @dev    The claim function is public and any wallet may execute claim on behalf of another user.
               Prizes are always paid out to the designated user account and not the caller (msg.sender).
               Claiming prizes is not limited to a single transaction. Reclaiming can be executed
               subsequentially if an "optimal" prize was not included in previous claim pick indices. The
               payout difference for the new claim is calculated during the award process and transfered to user.
     * @param user    Address of user to claim awards for. Does NOT need to be msg.sender
     * @param drawIds Draw IDs from global DrawBuffer reference
     * @param data    The data to pass to the draw calculator
     * @return Total claim payout. May include calcuations from multiple draws.
     */
    function claim(
        address user,
        uint32[] calldata drawIds,
        bytes calldata data
    ) external returns (uint256);

    /**
        * @notice Read global DrawCalculator address.
        * @return IDrawCalculator
     */
    function getDrawCalculator() external view returns (IDrawCalculator);

    /**
        * @notice Get the amount that a user has already been paid out for a draw
        * @param user   User address
        * @param drawId Draw ID
     */
    function getDrawPayoutBalanceOf(address user, uint32 drawId) external view returns (uint256);

    /**
        * @notice Read global Ticket address.
        * @return IERC20
     */
    function getToken() external view returns (IERC20);

    /**
        * @notice Sets DrawCalculator reference contract.
        * @param newCalculator DrawCalculator address
        * @return New DrawCalculator address
     */
    function setDrawCalculator(IDrawCalculator newCalculator) external returns (IDrawCalculator);

    /**
        * @notice Transfer ERC20 tokens out of contract to recipient address.
        * @dev    Only callable by contract owner.
        * @param token  ERC20 token to transfer.
        * @param to     Recipient of the tokens.
        * @param amount Amount of tokens to transfer.
        * @return true if operation is successful.
    */
    function withdrawERC20(
        IERC20 token,
        address to,
        uint256 amount
    ) external returns (bool);
}
