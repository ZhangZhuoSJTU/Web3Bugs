pragma solidity ^0.5.11;

import "../../ManagerProxyTarget.sol";

contract ManagerProxyTargetMockV3 is ManagerProxyTarget {
    uint256 public initValue;
    uint8 public uint8Value;
    uint64 public uint64Value;
    uint256 public uint256Value;
    bytes32 public bytes32Value;
    address public addressValue;
    mapping(uint256 => uint256) public kvMap;

    constructor(address _controller) public Manager(_controller) {}

    function setUint8(uint8 _value) external {
        uint8Value = _value;
    }

    function setUint64(uint64 _value) external {
        uint64Value = _value;
    }

    function setUint256(uint256 _value) external {
        uint256Value = _value;
    }

    function setBytes32(bytes32 _value) external {
        bytes32Value = _value;
    }

    function setAddress(address _value) external {
        addressValue = _value;
    }

    function setKv(uint256 _key, uint256 _value) external {
        kvMap[_key] = _value;
    }
}
