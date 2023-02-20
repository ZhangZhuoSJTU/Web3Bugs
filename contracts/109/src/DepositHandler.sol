// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

contract DepositHandler {
    uint256 internal constant IS_NOT_LOCKED = uint256(0);
    uint256 internal constant IS_LOCKED = uint256(1);

    uint256 internal _lockedStatus = IS_NOT_LOCKED;

    modifier noReenter() {
        require(_lockedStatus == IS_NOT_LOCKED);

        _lockedStatus = IS_LOCKED;
        _;
        _lockedStatus = IS_NOT_LOCKED;
    }

    function execute(address callee, bytes calldata data)
        external
        noReenter
        returns (bool success, bytes memory returnData)
    {
        (success, returnData) = callee.call(data);
    }

    function destroy(address etherDestination) external noReenter {
        selfdestruct(payable(etherDestination));
    }
}
