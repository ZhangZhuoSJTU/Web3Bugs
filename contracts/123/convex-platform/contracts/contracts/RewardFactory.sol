// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./BaseRewardPool4626.sol";
import "./VirtualBalanceRewardPool.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";


/**
 * @title   RewardFactory
 * @author  ConvexFinance
 * @notice  Used to deploy reward pools when a new pool is added to the Booster
 *          contract. This contract deploys two types of reward pools:
 *          - BaseRewardPool handles CRV rewards for guages
 *          - VirtualBalanceRewardPool for extra rewards
 */
contract RewardFactory {
    using Address for address;

    address public immutable operator;
    address public immutable crv;

    mapping (address => bool) private rewardAccess;
    mapping(address => uint256[]) public rewardActiveList;


    event RewardPoolCreated(address rewardPool, uint256 _pid, address depositToken);
    event TokenRewardPoolCreated(address rewardPool, address token, address mainRewards, address operator);

    event AccessChanged(address stash, bool hasAccess);

    /**
     * @param _operator   Contract operator is Booster
     * @param _crv        CRV token address
     */
    constructor(address _operator, address _crv) public {
        operator = _operator;
        crv = _crv;
    }

    //stash contracts need access to create new Virtual balance pools for extra gauge incentives(ex. snx)
    function setAccess(address _stash, bool _status) external{
        require(msg.sender == operator, "!auth");
        rewardAccess[_stash] = _status;

        emit AccessChanged(_stash, _status);
    }

    /**
     * @notice Create a Managed Reward Pool to handle distribution of all crv mined in a pool
     */
    function CreateCrvRewards(uint256 _pid, address _depositToken, address _lptoken) external returns (address) {
        require(msg.sender == operator, "!auth");

        //operator = booster(deposit) contract so that new crv can be added and distributed
        //reward manager = this factory so that extra incentive tokens(ex. snx) can be linked to the main managed reward pool
        BaseRewardPool4626 rewardPool = new BaseRewardPool4626(_pid,_depositToken,crv,operator, address(this), _lptoken);

        emit RewardPoolCreated(address(rewardPool), _pid, _depositToken);
        return address(rewardPool);
    }

    /**
     * @notice  Create a virtual balance reward pool that mimics the balance of a pool's main reward contract
     *          used for extra incentive tokens(ex. snx) as well as vecrv fees
     */
    function CreateTokenRewards(address _token, address _mainRewards, address _operator) external returns (address) {
        require(msg.sender == operator || rewardAccess[msg.sender] == true, "!auth");

        //create new pool, use main pool for balance lookup
        VirtualBalanceRewardPool rewardPool = new VirtualBalanceRewardPool(_mainRewards,_token,_operator);
        address rAddress = address(rewardPool);
        //add the new pool to main pool's list of extra rewards, assuming this factory has "reward manager" role
        IRewards(_mainRewards).addExtraReward(rAddress);

        emit TokenRewardPoolCreated(rAddress, _token, _mainRewards, _operator);
        //return new pool's address
        return rAddress;
    }
}
