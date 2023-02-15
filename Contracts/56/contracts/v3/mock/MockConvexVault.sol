// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../mock/MockERC20.sol';
import './MockConvexBaseRewardPool.sol';

contract MockConvexVault {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public immutable crv;
    address public immutable cvx;

    address public owner;
    address public immutable staker;
    address public immutable minter;

    struct PoolInfo {
        address lptoken;
        address token;
        address gauge;
        address crvRewards;
        address stash;
        bool shutdown;
    }

    //index(pid) -> pool
    PoolInfo[] public poolInfo;

    event Deposited(address indexed user, uint256 indexed poolid, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed poolid, uint256 amount);

    constructor(
        address _staker,
        address _minter,
        address _crv,
        address _cvx
    ) public {
        staker = _staker;
        owner = msg.sender;
        minter = _minter;
        crv = _crv;
        cvx = _cvx;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    //create a new pool
    function addPool(
        address _lptoken,
        address _gauge,
        uint256 /*_stashVersion*/
    ) external returns (bool) {
        //the next pool's pid
        uint256 pid = poolInfo.length;

        //create a tokenized deposit
        MockERC20 token = new MockERC20(
            string(abi.encodePacked(ERC20(_lptoken).name(), ' Convex Deposit')),
            string(abi.encodePacked('cvx', ERC20(_lptoken).symbol())),
            18
        );

        //create a reward contract for crv rewards
        MockConvexBaseRewardPool newRewardPool = new MockConvexBaseRewardPool(
            pid,
            address(token),
            crv,
            address(this),
            address(this)
        );

        // give some fake generated rewards to reward pool so user can claim
        IERC20(cvx).safeTransferFrom(address(this), address(newRewardPool), 10000);

        //add the new pool
        poolInfo.push(
            PoolInfo({
                lptoken: _lptoken,
                token: address(token),
                gauge: _gauge,
                crvRewards: address(newRewardPool),
                stash: address(0),
                shutdown: false
            })
        );
        return true;
    }

    //deposit lp tokens and stake
    function deposit(
        uint256 _pid,
        uint256 _amount,
        bool /*_stake*/
    ) public returns (bool) {
        PoolInfo storage pool = poolInfo[_pid];
        //send to proxy to stake
        address lptoken = pool.lptoken;
        IERC20(lptoken).safeTransferFrom(msg.sender, address(this), _amount);

        address token = pool.token;

        //add user balance directly
        MockERC20(token).mint(msg.sender, _amount);

        emit Deposited(msg.sender, _pid, _amount);
        return true;
    }

    //deposit all lp tokens and stake
    function depositAll(uint256 _pid, bool _stake) external returns (bool) {
        address lptoken = poolInfo[_pid].lptoken;
        uint256 balance = IERC20(lptoken).balanceOf(msg.sender);
        deposit(_pid, balance, _stake);
        return true;
    }

    //withdraw lp tokens
    function _withdraw(
        uint256 _pid,
        uint256 _amount,
        address _from,
        address _to
    ) internal {
        PoolInfo storage pool = poolInfo[_pid];
        address lptoken = pool.lptoken;

        //remove lp balance
        address token = pool.token;
        MockERC20(token).burnFrom(_from, _amount);

        //return lp tokens
        IERC20(lptoken).safeTransfer(_to, _amount);

        emit Withdrawn(_to, _pid, _amount);
    }

    //withdraw lp tokens
    function withdraw(uint256 _pid, uint256 _amount) public returns (bool) {
        _withdraw(_pid, _amount, msg.sender, msg.sender);
        return true;
    }

    //withdraw all lp tokens
    function withdrawAll(uint256 _pid) public returns (bool) {
        address token = poolInfo[_pid].token;
        uint256 userBal = IERC20(token).balanceOf(msg.sender);
        withdraw(_pid, userBal);
        return true;
    }
}
