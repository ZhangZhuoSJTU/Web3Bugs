// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

/// @title ETH Pool Delegator
/// @author John Deere
/// @notice ETH Liquidity Pool that delegate calls Curve Pool.
/// @dev Storage is local, execution takes place as fallback via delegate call.

contract ETHPoolDelegator {

    // _coins The addresses of coins in the pool
    // _balances The balances of above coins in the pool
    // fee Base swap fee of pool
    // admin_fee Percentage of base swap fee collected by DAO as admin fee
    // max_admin_fee Max admin fee permitted for this pool
    // owner The owner of the contract
    // token LP token for this pool
    // initial_A The initial A invariant
    // future_A The future A invariant
    // initial_A_time The number of rings from dendrochronological sample
    // future_A_time The number of rings from dendrochronological sample
    // admin_actions_deadline The deadline before pending changes have to be executed
    // transfer_ownership_deadline The deadline before pending ownership transfer has to be executed
    // future_fee The swap fee that would be set in the future
    // future_admin_fee The admin fee that would be set in the future
    // future_owner The owner in the future pending ownership transfer
    // kill_deadline The timestamp until which the pool can be killed
    // kill_deadline_dt Used to set kill_deadline
    // is_killed Is the contract killled? Only withdrawals permitted.
    
    address[] public _coins;
    uint256[] public _balances;
    uint256 public fee;
    uint256 public admin_fee;
    uint256 constant max_admin_fee = 5 * 10 ** 9;
    address public owner;
    address token;

    uint256 public initial_A;
    uint256 public future_A;
    uint256 public initial_A_time;
    uint256 public future_A_time;
    
    uint256 public admin_actions_deadline;
    uint256 public transfer_ownership_deadline;
    
    uint256 public future_fee;
    uint256 public future_admin_fee;
    address public future_owner;
    
    bool is_killed;
    uint256 kill_deadline;
    uint256 constant kill_deadline_dt = 2 * 30 * 86400;

    
    constructor(
        address _owner,
        address[2] memory coins_,
        address _lp_token,
        uint256 _A,
        uint256 _fee,
        uint256 _adminFee
    ) public {
        for (uint i = 0; i < 2; i++) {
            require(coins_[i] != address(0));
            _balances.push(0);
            _coins.push(coins_[i]);
        }
        initial_A = _A;
        future_A = _A;
        fee = _fee;
        admin_fee = _adminFee;
        owner = _owner;
        kill_deadline = block.timestamp + kill_deadline_dt;
        is_killed = false;
        token = _lp_token;
    }
    
    //Returns balances of a certain coin selected by index
    function balances(int128 i) public view returns (uint256) {
        return _balances[uint256(i)];
    }
    
    //Returns address of the coin
    function coins(int128 i) public view returns (address) {
        return _coins[uint256(i)];
    }

    fallback() external payable {
        address _target = 0xc5424B857f758E906013F3555Dad202e4bdB4567; //Curve Contract on ETH Mainnet to be Delegate Called

        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0x0, calldatasize())
            let _retval := delegatecall(
                gas(),
                _target,
                ptr,
                calldatasize(),
                0,
                0
            )
            returndatacopy(ptr, 0, returndatasize())

            switch _retval
                case 0 {
                    revert(ptr, returndatasize())
                }
                default {
                    return(ptr, returndatasize())
                }
        }
    }
}