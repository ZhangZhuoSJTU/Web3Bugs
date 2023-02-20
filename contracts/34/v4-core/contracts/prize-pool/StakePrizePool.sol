// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./PrizePool.sol";

/**
 * @title  PoolTogether V4 StakePrizePool
 * @author PoolTogether Inc Team
 * @notice The Stake Prize Pool is a prize pool in which users can deposit an ERC20 token.
 *         These tokens are simply held by the Stake Prize Pool and become eligible for prizes.
 *         Prizes are added manually by the Stake Prize Pool owner and are distributed to users at the end of the prize period.
 */
contract StakePrizePool is PrizePool {
    /// @notice Address of the stake token.
    IERC20 private stakeToken;

    /// @dev Emitted when stake prize pool is deployed.
    /// @param stakeToken Address of the stake token.
    event Deployed(IERC20 indexed stakeToken);

    /// @notice Deploy the Stake Prize Pool
    /// @param _owner Address of the Stake Prize Pool owner
    /// @param _stakeToken Address of the stake token
    constructor(address _owner, IERC20 _stakeToken) PrizePool(_owner) {
        require(address(_stakeToken) != address(0), "StakePrizePool/stake-token-not-zero-address");
        stakeToken = _stakeToken;

        emit Deployed(_stakeToken);
    }

    /// @notice Determines whether the passed token can be transferred out as an external award.
    /// @dev Different yield sources will hold the deposits as another kind of token: such a Compound's cToken.  The
    /// prize strategy should not be allowed to move those tokens.
    /// @param _externalToken The address of the token to check
    /// @return True if the token may be awarded, false otherwise
    function _canAwardExternal(address _externalToken) internal view override returns (bool) {
        return address(stakeToken) != _externalToken;
    }

    /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
    /// @return The underlying balance of asset tokens
    function _balance() internal view override returns (uint256) {
        return stakeToken.balanceOf(address(this));
    }

    /// @notice Returns the address of the ERC20 asset token used for deposits.
    /// @return Address of the ERC20 asset token.
    function _token() internal view override returns (IERC20) {
        return stakeToken;
    }

    /// @notice Supplies asset tokens to the yield source.
    /// @param _mintAmount The amount of asset tokens to be supplied
    function _supply(uint256 _mintAmount) internal pure override {
        // no-op because nothing else needs to be done
    }

    /// @notice Redeems asset tokens from the yield source.
    /// @param _redeemAmount The amount of yield-bearing tokens to be redeemed
    /// @return The actual amount of tokens that were redeemed.
    function _redeem(uint256 _redeemAmount) internal pure override returns (uint256) {
        return _redeemAmount;
    }
}
