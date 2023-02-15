pragma solidity >=0.8.0;

import {Hevm} from "./Hevm.sol";

contract HEVMState {
    bytes20 constant CHEAT_CODE =
        bytes20(uint160(uint(keccak256('hevm cheat code'))));
    Hevm hevm = Hevm(address(CHEAT_CODE));

    address me = address(this);

    mapping (address => mapping(bytes4 => uint256)) public slots;
    mapping (address => mapping(bytes4 => bool)) public finds;
}