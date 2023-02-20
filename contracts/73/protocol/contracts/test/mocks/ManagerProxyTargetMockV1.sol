pragma solidity ^0.5.11;

import "../../ManagerProxyTarget.sol";

contract ManagerProxyTargetMockV1 is ManagerProxyTarget {
    uint256 public initValue;
    uint8 public uint8Value;
    uint64 public uint64Value;
    uint256 public uint256Value;
    bytes32 public bytes32Value;
    address public addressValue;
    string public stringValue;
    bytes public bytesValue;
    uint256 public tupleValue1;
    uint256 public tupleValue2;
    bytes32 public tupleValue3;

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

    function setString(string calldata _value) external {
        stringValue = _value;
    }

    function setBytes(bytes calldata _value) external {
        bytesValue = _value;
    }

    function setTuple(
        uint256 _value1,
        uint256 _value2,
        bytes32 _value3
    ) external {
        tupleValue1 = _value1;
        tupleValue2 = _value2;
        tupleValue3 = _value3;
    }

    function getTuple()
        external
        view
        returns (
            uint256,
            uint256,
            bytes32
        )
    {
        return (tupleValue1, tupleValue2, tupleValue3);
    }
}
