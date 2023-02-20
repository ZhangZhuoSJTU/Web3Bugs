// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@pooltogether/owner-manager-contracts/contracts/Ownable.sol";

import "./interfaces/IPrizeDistributor.sol";
import "./interfaces/IDrawCalculator.sol";

/**
    * @title  PoolTogether V4 PrizeDistributor
    * @author PoolTogether Inc Team
    * @notice The PrizeDistributor contract holds Tickets (captured interest) and distributes tickets to users with winning draw claims.
              PrizeDistributor uses an external IDrawCalculator to validate a users draw claim, before awarding payouts. To prevent users 
              from reclaiming prizes, a payout history for each draw claim is mapped to user accounts. Reclaiming a draw can occur
              if an "optimal" prize was not included in previous claim pick indices and the new claims updated payout is greater then
              the previous prize distributor claim payout.
*/
contract PrizeDistributor is IPrizeDistributor, Ownable {
    using SafeERC20 for IERC20;

    /* ============ Global Variables ============ */

    /// @notice DrawCalculator address
    IDrawCalculator internal drawCalculator;

    /// @notice Token address
    IERC20 internal immutable token;

    /// @notice Maps users => drawId => paid out balance
    mapping(address => mapping(uint256 => uint256)) internal userDrawPayouts;

    /* ============ Initialize ============ */

    /**
     * @notice Initialize PrizeDistributor smart contract.
     * @param _owner          Owner address
     * @param _token          Token address
     * @param _drawCalculator DrawCalculator address
     */
    constructor(
        address _owner,
        IERC20 _token,
        IDrawCalculator _drawCalculator
    ) Ownable(_owner) {
        _setDrawCalculator(_drawCalculator);
        require(address(_token) != address(0), "PrizeDistributor/token-not-zero-address");
        token = _token;
        emit TokenSet(_token);
    }

    /* ============ External Functions ============ */

    /// @inheritdoc IPrizeDistributor
    function claim(
        address _user,
        uint32[] calldata _drawIds,
        bytes calldata _data
    ) external override returns (uint256) {
        
        uint256 totalPayout;
        
        (uint256[] memory drawPayouts, ) = drawCalculator.calculate(_user, _drawIds, _data); // neglect the prizeCounts since we are not interested in them here

        uint256 drawPayoutsLength = drawPayouts.length;
        for (uint256 payoutIndex = 0; payoutIndex < drawPayoutsLength; payoutIndex++) {
            uint32 drawId = _drawIds[payoutIndex];
            uint256 payout = drawPayouts[payoutIndex];
            uint256 oldPayout = _getDrawPayoutBalanceOf(_user, drawId);
            uint256 payoutDiff = 0;

            // helpfully short-circuit, in case the user screwed something up.
            require(payout > oldPayout, "PrizeDistributor/zero-payout");

            unchecked {
                payoutDiff = payout - oldPayout;
            }

            _setDrawPayoutBalanceOf(_user, drawId, payout);

            totalPayout += payoutDiff;

            emit ClaimedDraw(_user, drawId, payoutDiff);
        }

        _awardPayout(_user, totalPayout);

        return totalPayout;
    }

    /// @inheritdoc IPrizeDistributor
    function withdrawERC20(
        IERC20 _erc20Token,
        address _to,
        uint256 _amount
    ) external override onlyOwner returns (bool) {
        require(_to != address(0), "PrizeDistributor/recipient-not-zero-address");
        require(address(_erc20Token) != address(0), "PrizeDistributor/ERC20-not-zero-address");

        _erc20Token.safeTransfer(_to, _amount);

        emit ERC20Withdrawn(_erc20Token, _to, _amount);

        return true;
    }

    /// @inheritdoc IPrizeDistributor
    function getDrawCalculator() external view override returns (IDrawCalculator) {
        return drawCalculator;
    }

    /// @inheritdoc IPrizeDistributor
    function getDrawPayoutBalanceOf(address _user, uint32 _drawId)
        external
        view
        override
        returns (uint256)
    {
        return _getDrawPayoutBalanceOf(_user, _drawId);
    }

    /// @inheritdoc IPrizeDistributor
    function getToken() external view override returns (IERC20) {
        return token;
    }

    /// @inheritdoc IPrizeDistributor
    function setDrawCalculator(IDrawCalculator _newCalculator)
        external
        override
        onlyOwner
        returns (IDrawCalculator)
    {
        _setDrawCalculator(_newCalculator);
        return _newCalculator;
    }

    /* ============ Internal Functions ============ */

    function _getDrawPayoutBalanceOf(address _user, uint32 _drawId)
        internal
        view
        returns (uint256)
    {
        return userDrawPayouts[_user][_drawId];
    }

    function _setDrawPayoutBalanceOf(
        address _user,
        uint32 _drawId,
        uint256 _payout
    ) internal {
        userDrawPayouts[_user][_drawId] = _payout;
    }

    /**
     * @notice Sets DrawCalculator reference for individual draw id.
     * @param _newCalculator  DrawCalculator address
     */
    function _setDrawCalculator(IDrawCalculator _newCalculator) internal {
        require(address(_newCalculator) != address(0), "PrizeDistributor/calc-not-zero");
        drawCalculator = _newCalculator;

        emit DrawCalculatorSet(_newCalculator);
    }

    /**
     * @notice Transfer claimed draw(s) total payout to user.
     * @param _to      User address
     * @param _amount  Transfer amount
     */
    function _awardPayout(address _to, uint256 _amount) internal {
        token.safeTransfer(_to, _amount);
    }

}
