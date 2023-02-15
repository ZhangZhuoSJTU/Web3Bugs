// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

/// @title USD Pool Delegator
/// @author John Deere
/// @notice USD Liquidity Pool that delegate calls Curve Pool.
/// @dev Storage is local, execution takes place as fallback via delegate call.

contract USDPoolDelegator {

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
    address[] public _underlying_coins;
    uint256[] public _balances;
    uint256 public A;
    uint256 public fee;
    uint256 public admin_fee;
    uint256 constant max_admin_fee = 5 * 10 ** 9;
    address public owner;
    address token;
    uint256 public admin_actions_deadline;
    uint256 public transfer_ownership_deadline;
    uint256 public future_A;
    uint256 public future_fee;
    uint256 public future_admin_fee;
    address public future_owner;
    
    uint256 kill_deadline;
    uint256 constant kill_deadline_dt = 2 * 30 * 86400;
    bool is_killed;
    
    constructor(address[4] memory _coinsIn, address[4] memory _underlying_coinsIn, address _pool_token, uint256 _A, uint256 _fee) public {
        for (uint i = 0; i < 4; i++) {
            require(_coinsIn[i] != address(0));
            require(_underlying_coinsIn[i] != address(0));
            _balances.push(0);
            _coins.push(_coinsIn[i]);
            _underlying_coins.push(_underlying_coinsIn[i]);
        }
        A = _A;
        fee = _fee;
        admin_fee = 0;
        owner = msg.sender;
        kill_deadline = block.timestamp + kill_deadline_dt;
        is_killed = false;
        token = _pool_token;
    }
    
    //Returns balances of a certain coin selected by index
    function balances(int128 i) public view returns (uint256) {
        return _balances[uint256(i)];
    }
    
    //Returns address of the coin
    function coins(int128 i) public view returns (address) {
        return _coins[uint256(i)];
    }
    
    //Returns address of the underlying coin
    function underlying_coins(int128 i) public view returns (address) {
        return _underlying_coins[uint256(i)];
    }

    fallback() external payable {
        address _target = 0xA5407eAE9Ba41422680e2e00537571bcC53efBfD; //Curve Contract on ETH Mainnet to be Delegate Called

        assembly {
            let _calldataMemOffset := mload(0x40)
            let _callDataSZ := calldatasize()
            let _size := and(add(_callDataSZ, 0x1f), not(0x1f))
            mstore(0x40, add(_calldataMemOffset, _size))
            calldatacopy(_calldataMemOffset, 0x0, _callDataSZ)
            let _retval := delegatecall(gas(), _target, _calldataMemOffset, _callDataSZ, 0, 0)
            switch _retval
            case 0 {
                revert(0,0)
            } default {
                let _returndataMemoryOff := mload(0x40)
                mstore(0x40, add(_returndataMemoryOff, returndatasize()))
                returndatacopy(_returndataMemoryOff, 0x0, returndatasize())
                return(_returndataMemoryOff, returndatasize())
            }
        }
    }
}