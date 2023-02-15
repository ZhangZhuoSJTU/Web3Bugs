// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IRewards.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IVoteProxy.sol";

contract YaxisVotePower is IVoteProxy {
    using SafeMath for uint256;

    // solhint-disable-next-line const-name-snakecase
    uint8 public constant override decimals = uint8(18);

    IUniswapV2Pair public immutable yaxisEthUniswapV2Pair;
    IERC20 public immutable yaxis;
    IRewards public immutable rewardsYaxis;
    IRewards public immutable rewardsYaxisEth;

    constructor(
        address _yaxis,
        address _rewardsYaxis,
        address _rewardsYaxisEth,
        address _yaxisEthUniswapV2Pair
    )
        public
    {
        yaxis = IERC20(_yaxis);
        rewardsYaxis = IRewards(_rewardsYaxis);
        rewardsYaxisEth = IRewards(_rewardsYaxisEth);
        yaxisEthUniswapV2Pair = IUniswapV2Pair(_yaxisEthUniswapV2Pair);
    }

    function totalSupply()
        external
        view
        override
        returns (uint256)
    {
        return sqrt(yaxis.totalSupply());
    }

    function balanceOf(
        address _voter
    )
        external
        view
        override
        returns (uint256 _balance)
    {
        uint256 _stakeAmount = rewardsYaxisEth.balanceOf(_voter);
        (uint256 _yaxReserves,,) = yaxisEthUniswapV2Pair.getReserves();
        uint256 _supply = yaxisEthUniswapV2Pair.totalSupply();
        _supply = _supply == 0
            ? 1e18
            : _supply;
        uint256 _lpStakingYax = _yaxReserves
            .mul(_stakeAmount)
            .div(_supply)
            .add(rewardsYaxisEth.earned(_voter));
        uint256 _rewardsYaxisAmount = rewardsYaxis.balanceOf(_voter)
            .add(rewardsYaxis.earned(_voter));
        _balance = sqrt(
            yaxis.balanceOf(_voter)
                .add(_lpStakingYax)
                .add(_rewardsYaxisAmount)
        );
    }

    function sqrt(
        uint256 x
    )
        private
        pure
        returns (uint256 y)
    {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        y = y * (10 ** 9);
    }
}
