pragma solidity ^0.8.0;

import "./HEVMState.sol";
import "solmate/tokens/ERC20.sol";
import { HEVMHelpers } from "./HEVMHelpers.sol";

interface Checkpointing {
	function numCheckpoints ( address ) external view returns ( uint32 );
	function checkpoints ( address, uint32 ) external view returns ( uint32 fromBlock, uint96 votes );
}

// example usage:
//
//
// 		function getUSDC(uint256 amount) {
// 			address usdc = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
// 			write_balanceOf_ts(usdc, address(this), amount);
// 		}

contract TokenExtensions is HEVMHelpers {
	// update balanceOf and total supply
	function write_balanceOf_ts(address who, address acct, uint256 value) public {
        uint256 bal = ERC20(who).balanceOf(acct);
        write_map(who, "balanceOf(address)", acct, value);

        uint256 newTS;
        if (bal > value) {
            uint256 negdelta = bal - value;
            newTS = ERC20(who).totalSupply() - negdelta;
        } else {
            uint256 posdelta = value - bal;
            newTS = ERC20(who).totalSupply() + posdelta;
        }

        write_flat(who, "totalSupply()", newTS);
    }

    // update balance of
    function write_balanceOf(address who, address acct, uint256 value) public {
        uint256 bal = ERC20(who).balanceOf(acct);
        write_map(who, "balanceOf(address)", acct, value);
    }

    // update balance of underlying
    function write_balanceOfUnderlying(address who, address acct, uint256 value) public {
        write_map(who, "balanceOfUnderlying(address)", acct, value);
    }

    // manually writes a checkpoint in a checkpointing token
    function write_checkpoint(address checkpointToken, address account, uint256 checkpoint, uint256 fromBlock, uint256 bal) public {
        bytes32[] memory keys = new bytes32[](2);
        keys[0] = bytes32(uint256(uint160(account)));
        keys[1] = bytes32(uint256(uint32(checkpoint)));
        write_deep_map_struct(address(checkpointToken), "checkpoints(address,uint32)", keys, fromBlock, 0);
        write_deep_map_struct(address(checkpointToken), "checkpoints(address,uint32)", keys, bal, 1);
    }

    function write_last_checkpoint(address checkpointToken, address account, uint256 votes) public {
        uint256 lcp = Checkpointing(checkpointToken).numCheckpoints(account);
        if (lcp > 0) {
          lcp = lcp - 1;
        }
        bytes32[] memory keys = new bytes32[](2);
        keys[0] = bytes32(uint256(uint160(account)));
        keys[1] = bytes32(uint256(uint32(lcp)));
        write_deep_map_struct(checkpointToken, "checkpoints(address,uint32)", keys, votes, 1);
        if (lcp == 0) {
          write_deep_map_struct(checkpointToken, "checkpoints(address,uint32)", keys, block.number - 1, 0);
          write_map(checkpointToken, "numCheckpoints(address)", account, 1);
        }
    }
}