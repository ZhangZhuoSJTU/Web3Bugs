// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";

/**
 * @title   PoolManagerProxy
 * @author  ConvexFinance
 * @notice  Immutable pool manager proxy to enforce that there are no multiple pools of the same gauge
 *          as well as new lp tokens are not gauge tokens
 * @dev     Called by PoolManagerShutdownProxy 
 */
contract PoolManagerProxy{

    address public immutable pools;
    address public owner;
    address public operator;

    /**
     * @param _pools      Contract can call addPool currently Booster
     * @param _owner      Contract owner currently multisig
     */
    constructor(
      address _pools, 
      address _owner
    ) public {
        pools = _pools;
        owner = _owner;
        operator = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operator == msg.sender, "!op");
        _;
    }

    //set owner - only OWNER
    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }

    //set operator - only OWNER
    function setOperator(address _operator) external onlyOwner{
        operator = _operator;
    }

    // sealed to be immutable
    // function revertControl() external{
    // }

    //shutdown a pool - only OPERATOR
    function shutdownPool(uint256 _pid) external onlyOperator returns(bool){
        return IPools(pools).shutdownPool(_pid);
    }

    /**
     * @notice  Add pool to system
     * @dev     Only callable by the operator looks up the gauge from the gaugeMap in Booster to ensure
     *          it hasn't already been added
     */
    function addPool(address _lptoken, address _gauge, uint256 _stashVersion) external onlyOperator returns(bool){

        require(_gauge != address(0),"gauge is 0");
        require(_lptoken != address(0),"lp token is 0");

        //check if a pool with this gauge already exists
        bool gaugeExists = IPools(pools).gaugeMap(_gauge);
        require(!gaugeExists, "already registered gauge");

        //must also check that the lp token is not a registered gauge
        //because curve gauges are tokenized
        gaugeExists = IPools(pools).gaugeMap(_lptoken);
        require(!gaugeExists, "already registered lptoken");

        return IPools(pools).addPool(_lptoken,_gauge,_stashVersion);
    }
}
