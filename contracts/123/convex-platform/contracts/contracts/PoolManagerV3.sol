// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./interfaces/IGaugeController.sol";

/** 
 * @title   PoolManagerV3
 * @author  ConvexFinance
 * @notice  Pool Manager v3
 *          PoolManagerV3 calls addPool on PoolManagerShutdownProxy which calls
 *          addPool on PoolManagerProxy which calls addPool on Booster. 
 *          PoolManager-ception
 * @dev     Add pools to the Booster contract
 */
contract PoolManagerV3{

    address public immutable pools;
    address public immutable gaugeController;
    address public operator;

    bool public protectAddPool;
    
    /**
     * @param _pools            Currently PoolManagerSecondaryProxy
     * @param _gaugeController  Curve gauge controller e.g: (0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB)
     * @param _operator         Convex multisig
     */
    constructor(
        address _pools, 
        address _gaugeController, 
        address _operator
    ) public {
        pools = _pools;
        gaugeController = _gaugeController;
        operator = _operator;
        protectAddPool = true;
    }

    function setOperator(address _operator) external {
        require(msg.sender == operator, "!auth");
        operator = _operator;
    }
  
    /**
     * @notice set if addPool is only callable by operator
     */
    function setProtectPool(bool _protectAddPool) external {
        require(msg.sender == operator, "!auth");
        protectAddPool = _protectAddPool;
    }

    /**
     * @notice Add a new curve pool to the system. (default stash to v3)
     */
    function addPool(address _gauge) external returns(bool){
        _addPool(_gauge,3);
        return true;
    }

    /**
     * @notice Add a new curve pool to the system
     */
    function addPool(address _gauge, uint256 _stashVersion) external returns(bool){
        _addPool(_gauge,_stashVersion);
        return true;
    }

    function _addPool(address _gauge, uint256 _stashVersion) internal{
        if(protectAddPool) {
            require(msg.sender == operator, "!auth");
        }
        //get lp token from gauge
        address lptoken = ICurveGauge(_gauge).lp_token();

        //gauge/lptoken address checks will happen in the next call
        IPools(pools).addPool(lptoken,_gauge,_stashVersion);
    }

    function forceAddPool(address _lptoken, address _gauge, uint256 _stashVersion) external returns(bool){
        require(msg.sender==operator, "!auth");
        
        //force add pool without weight checks (can only be used on new token and gauge addresses)
        return IPools(pools).forceAddPool(_lptoken, _gauge, _stashVersion);
    }

    function shutdownPool(uint256 _pid) external returns(bool){
        require(msg.sender==operator, "!auth");

        IPools(pools).shutdownPool(_pid);
        return true;
    }

}
