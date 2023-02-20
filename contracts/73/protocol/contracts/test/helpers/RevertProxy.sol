pragma solidity ^0.5.11;

contract RevertProxy {
    bytes data;

    function() external {
        data = msg.data;
    }

    // solium-disable security/no-low-level-calls
    function execute(address _target) external returns (bool) {
        (bool ok, ) = _target.call(data);
        return ok;
    }
}
