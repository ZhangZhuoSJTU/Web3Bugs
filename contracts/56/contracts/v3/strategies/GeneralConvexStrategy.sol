// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IConvexVault.sol';
import '../interfaces/ExtendedIERC20.sol';
import '../interfaces/IStableSwapPool.sol';
import '../interfaces/IStableSwap2Pool.sol';
import './BaseStrategy.sol';

contract GeneralConvexStrategy is BaseStrategy {
    using SafeMath for uint8;

    address public immutable crv;
    address public immutable cvx;

    uint256 public immutable pid;
    IConvexVault public immutable convexVault;
    address public immutable cvxDepositLP;
    IConvexRewards public immutable crvRewards;
    address public immutable stableSwapPool;

    address[] public tokens;
    uint8[] public decimalMultiples;

    /**
     * @param _name The strategy name
     * @param _want The desired token of the strategy
     * @param _crv The address of CRV
     * @param _cvx The address of CVX
     * @param _weth The address of WETH
     * @param _pid The pool id of convex
     * @param _coinCount The number of coins in the pool
     * @param _convexVault The address of the convex vault
     * @param _stableSwapPool The address of the stable swap pool
     * @param _controller The address of the controller
     * @param _manager The address of the manager
     * @param _router The address of the router for swapping tokens
     */
    constructor(
        string memory _name,
        address _want,
        address _crv,
        address _cvx,
        address _weth,
        uint256 _pid,
        uint256 _coinCount,
        IConvexVault _convexVault,
        address _stableSwapPool,
        address _controller,
        address _manager,
        address _router
    ) public BaseStrategy(_name, _controller, _manager, _want, _weth, _router) {
        require(_coinCount == 2 || _coinCount == 3, '_coinCount should be 2 or 3');
        require(address(_crv) != address(0), '!_crv');
        require(address(_cvx) != address(0), '!_cvx');
        require(address(_convexVault) != address(0), '!_convexVault');
        require(address(_stableSwapPool) != address(0), '!_stableSwapPool');

        (, address _token, , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        pid = _pid;
        convexVault = _convexVault;
        cvxDepositLP = _token;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwapPool = _stableSwapPool;

        for (uint256 i = 0; i < _coinCount; i++) {
            tokens.push(IStableSwapPool(_stableSwapPool).coins(i));
            decimalMultiples.push(18 - ExtendedIERC20(tokens[i]).decimals());
            IERC20(tokens[i]).safeApprove(_stableSwapPool, type(uint256).max);
        }

        IERC20(_want).safeApprove(address(_convexVault), type(uint256).max);
        IERC20(_crv).safeApprove(address(_router), type(uint256).max);
        IERC20(_cvx).safeApprove(address(_router), type(uint256).max);
        IERC20(_want).safeApprove(address(_stableSwapPool), type(uint256).max);
    }

    function _deposit() internal override {
        convexVault.depositAll(pid, true);
    }

    function _claimReward() internal {
        crvRewards.getReward(address(this), true);
    }

    function _addLiquidity() internal {
        if (tokens.length == 2) {
            uint256[2] memory amounts;
            amounts[0] = IERC20(tokens[0]).balanceOf(address(this));
            amounts[1] = IERC20(tokens[1]).balanceOf(address(this));
            IStableSwap2Pool(stableSwapPool).add_liquidity(amounts, 1);
            return;
        }

        uint256[3] memory amounts;
        amounts[0] = IERC20(tokens[0]).balanceOf(address(this));
        amounts[1] = IERC20(tokens[1]).balanceOf(address(this));
        amounts[2] = IERC20(tokens[2]).balanceOf(address(this));
        IStableSwap3Pool(stableSwapPool).add_liquidity(amounts, 1);
    }

    function getMostPremium() public view returns (address, uint256) {
        uint256 balance0 = IStableSwap3Pool(stableSwapPool).balances(0).mul(
            10**(decimalMultiples[0])
        );
        uint256 balance1 = IStableSwap3Pool(stableSwapPool).balances(1).mul(
            10**(decimalMultiples[1])
        );

        if (tokens.length == 2) {
            if (balance0 > balance1) {
                return (tokens[1], 1);
            }

            return (tokens[0], 0);
        }

        uint256 balance2 = IStableSwap3Pool(stableSwapPool).balances(2).mul(
            10**(decimalMultiples[2])
        );

        if (balance0 < balance1 && balance0 < balance2) {
            return (tokens[0], 0);
        }

        if (balance1 < balance0 && balance1 < balance2) {
            return (tokens[1], 1);
        }

        if (balance2 < balance0 && balance2 < balance1) {
            return (tokens[2], 2);
        }

        return (tokens[0], 0);
    }

    function _harvest(uint256 _estimatedWETH, uint256 _estimatedYAXIS) internal override {
        _claimReward();
        uint256 _cvxBalance = IERC20(cvx).balanceOf(address(this));
        if (_cvxBalance > 0) {
            _swapTokens(cvx, crv, _cvxBalance, 1);
        }

        uint256 _extraRewardsLength = crvRewards.extraRewardsLength();
        for (uint256 i = 0; i < _extraRewardsLength; i++) {
            address _rewardToken = IConvexRewards(crvRewards.extraRewards(i)).rewardToken();
            uint256 _extraRewardBalance = IERC20(_rewardToken).balanceOf(address(this));
            if (_extraRewardBalance > 0) {
                _swapTokens(_rewardToken, weth, _extraRewardBalance, 1);
            }
        }

        uint256 _remainingWeth = _payHarvestFees(crv, _estimatedWETH, _estimatedYAXIS);
        if (_remainingWeth > 0) {
            (address _targetCoin, ) = getMostPremium();
            _swapTokens(weth, _targetCoin, _remainingWeth, 1);
            _addLiquidity();

            if (balanceOfWant() > 0) {
                _deposit();
            }
        }
    }

    function _withdrawAll() internal override {
        convexVault.withdrawAll(pid);
    }

    function _withdraw(uint256 _amount) internal override {
        convexVault.withdraw(pid, _amount);
    }

    function balanceOfPool() public view override returns (uint256) {
        return IERC20(cvxDepositLP).balanceOf(address(this));
    }
}
