// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import '../interfaces/IConvexVault.sol';
import '../interfaces/IStableSwap2Pool.sol';
import './BaseStrategy.sol';

contract MIMConvexStrategy is BaseStrategy {
    // used for Crv -> weth -> [mim/3crv] -> mimCrv route
    address public immutable crv;
    address public immutable cvx;

    address public immutable mim;
    address public immutable crv3;

    uint256 public immutable pid;
    IConvexVault public immutable convexVault;
    address public immutable mimCvxDepositLP;
    IConvexRewards public immutable crvRewards;
    IStableSwap2Pool public immutable stableSwap2Pool;

    /**
     * @param _name The strategy name
     * @param _want The desired token of the strategy
     * @param _crv The address of CRV
     * @param _cvx The address of CVX
     * @param _weth The address of WETH
     * @param _mim The address of MIM
     * @param _crv3 The address of 3CRV
     * @param _pid The pool id of convex
     * @param _convexVault The address of the convex vault
     * @param _stableSwap2Pool The address of the stable swap pool
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
        address _mim,
        address _crv3,
        uint256 _pid,
        IConvexVault _convexVault,
        IStableSwap2Pool _stableSwap2Pool,
        address _controller,
        address _manager,
        address _router
    ) public BaseStrategy(_name, _controller, _manager, _want, _weth, _router) {
        require(address(_crv) != address(0), '!_crv');
        require(address(_cvx) != address(0), '!_cvx');
        require(address(_mim) != address(0), '!_mim');
        require(address(_crv3) != address(0), '!_crv3');
        require(address(_convexVault) != address(0), '!_convexVault');
        require(address(_stableSwap2Pool) != address(0), '!_stableSwap2Pool');

        (, address _token, , address _crvRewards, , ) = _convexVault.poolInfo(_pid);
        crv = _crv;
        cvx = _cvx;
        mim = _mim;
        crv3 = _crv3;
        pid = _pid;
        convexVault = _convexVault;
        mimCvxDepositLP = _token;
        crvRewards = IConvexRewards(_crvRewards);
        stableSwap2Pool = _stableSwap2Pool;
        // Required to overcome "Stack Too Deep" error
        _setApprovals(
            _want,
            _crv,
            _cvx,
            _mim,
            _crv3,
            address(_convexVault),
            address(_stableSwap2Pool)
        );
    }

    function _setApprovals(
        address _want,
        address _crv,
        address _cvx,
        address _mim,
        address _crv3,
        address _convexVault,
        address _stableSwap2Pool
    ) internal {
        IERC20(_want).safeApprove(address(_convexVault), type(uint256).max);
        IERC20(_crv).safeApprove(address(router), type(uint256).max);
        IERC20(_cvx).safeApprove(address(router), type(uint256).max);
        IERC20(_mim).safeApprove(address(_stableSwap2Pool), type(uint256).max);
        IERC20(_crv3).safeApprove(address(_stableSwap2Pool), type(uint256).max);
        IERC20(_want).safeApprove(address(_stableSwap2Pool), type(uint256).max);
    }

    function _deposit() internal override {
        if (balanceOfWant() > 0) {
            convexVault.depositAll(pid, true);
        }
    }

    function _claimReward() internal {
        crvRewards.getReward(address(this), true);
    }

    function _addLiquidity() internal {
        uint256[2] memory amounts;
        amounts[0] = IERC20(mim).balanceOf(address(this));
        amounts[1] = IERC20(crv3).balanceOf(address(this));
        stableSwap2Pool.add_liquidity(amounts, 1);
    }

    function getMostPremium() public view returns (address, uint256) {
        // both MIM and 3CRV have 18 decimals
        if (stableSwap2Pool.balances(0) > stableSwap2Pool.balances(1)) {
            return (crv3, 1);
        }

        return (mim, 0); // If they're somehow equal, we just want MIM
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
            (address _token, ) = getMostPremium(); // stablecoin we want to convert to
            _swapTokens(weth, _token, _remainingWeth, 1);
            _addLiquidity();
            _deposit();
        }
    }

    function _withdrawAll() internal override {
        convexVault.withdrawAll(pid);
    }

    function _withdraw(uint256 _amount) internal override {
        convexVault.withdraw(pid, _amount);
    }

    function balanceOfPool() public view override returns (uint256) {
        return IERC20(mimCvxDepositLP).balanceOf(address(this));
    }
}
