import "../BytesUtil.sol";

contract TestBytesUtils {
    using BytesUtils for *;

    function readLabel(bytes calldata name, uint offset) public pure returns(bytes32, uint) {
        return name.readLabel(offset);
    }

    function namehash(bytes calldata name, uint offset) public pure returns(bytes32) {
        return name.namehash(offset);
    }
}
