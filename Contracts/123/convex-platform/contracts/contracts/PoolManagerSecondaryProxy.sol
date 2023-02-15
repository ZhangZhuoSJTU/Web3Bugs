// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./interfaces/IGaugeController.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";

/**
 * @title   PoolManagerSecondaryProxy
 * @author  ConvexFinance
 * @notice  Basically a PoolManager that has a better shutdown and calls addPool on PoolManagerProxy. 
 *          Immutable pool manager proxy to enforce that when a  pool is shutdown, the proper number
 *          of lp tokens are returned to the booster contract for withdrawal.
 */
contract PoolManagerSecondaryProxy{
    using SafeMath for uint256;

    address public immutable gaugeController;
    address public immutable pools;
    address public immutable booster;
    address public owner;
    address public operator;
    bool public isShutdown;

    mapping(address => bool) public usedMap;

    /**
     * @param _gaugeController Curve Gauge controller (0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB)
     * @param _pools PoolManagerProxy (0x5F47010F230cE1568BeA53a06eBAF528D05c5c1B)
     * @param _booster Booster
     * @param _owner Executoor
     */
    constructor(
        address _gaugeController,
        address _pools,
        address _booster,
        address _owner
    ) public {
        gaugeController = _gaugeController;
        pools = _pools;
        booster = _booster;
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

    //manual set an address to used state
    function setUsedAddress(address[] memory usedList) external onlyOwner{
        for(uint i=0; i < usedList.length; i++){
            usedMap[usedList[i]] = true;
        }
    }

    //shutdown pool management and disallow new pools. change is immutable
    function shutdownSystem() external onlyOwner{
        isShutdown = true;
    }

    /**
     * @notice  Shutdown a pool - only OPERATOR
     * @dev     Shutdowns a pool and ensures all the LP tokens are properly
     *          withdrawn to the Booster contract 
     */
    function shutdownPool(uint256 _pid) external onlyOperator returns(bool){
        //get pool info
        (address lptoken, address depositToken,,,,bool isshutdown) = IPools(booster).poolInfo(_pid);
        require(!isshutdown, "already shutdown");

        //shutdown pool and get before and after amounts
        uint256 beforeBalance = IERC20(lptoken).balanceOf(booster);
        IPools(pools).shutdownPool(_pid);
        uint256 afterBalance = IERC20(lptoken).balanceOf(booster);

        //check that proper amount of tokens were withdrawn(will also fail if already shutdown)
        require( afterBalance.sub(beforeBalance) >= IERC20(depositToken).totalSupply(), "supply mismatch");

        return true;
    }

    //add a new pool if it has weight on the gauge controller - only OPERATOR
    function addPool(address _lptoken, address _gauge, uint256 _stashVersion) external onlyOperator returns(bool){
        //check that the pool as weight
        uint256 weight = IGaugeController(gaugeController).get_gauge_weight(_gauge);
        require(weight > 0, "must have weight");

        return _addPool(_lptoken, _gauge, _stashVersion);
    }

    //force add a new pool, but only for addresses that have never been used before - only OPERATOR
    function forceAddPool(address _lptoken, address _gauge, uint256 _stashVersion) external onlyOperator returns(bool){
        require(!usedMap[_lptoken] && !usedMap[_gauge], "cant force used pool");

        return _addPool(_lptoken, _gauge, _stashVersion);
    }

    //internal add pool and updated used list
    function _addPool(address _lptoken, address _gauge, uint256 _stashVersion) internal returns(bool){
        require(!isShutdown, "shutdown");

        usedMap[_lptoken] = true;
        usedMap[_gauge] = true;

        return IPools(pools).addPool(_lptoken,_gauge,_stashVersion);
    }
}
