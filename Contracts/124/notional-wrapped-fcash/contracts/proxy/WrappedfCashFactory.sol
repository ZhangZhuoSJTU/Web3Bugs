// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/utils/Create2.sol";
import "./nBeaconProxy.sol";

contract WrappedfCashFactory {

    /// @dev the Beacon contract here is an UpgradeableBeacon proxy, the contract
    /// at this address can be upgraded which will upgrade all deployed wrappers.
    address public immutable BEACON;
    bytes32 public constant SALT = 0;

    /// @notice Emitted when a new fCash wrapper has been deployed
    event WrapperDeployed(uint16 currencyId, uint40 maturity, address wrapper);

    constructor(address _beacon) {
        BEACON = _beacon;
    }

    function _getByteCode(uint16 currencyId, uint40 maturity) internal view returns (bytes memory) {
        bytes memory initCallData = abi.encodeWithSignature("initialize(uint16,uint40)", currencyId, maturity);
        return abi.encodePacked(type(nBeaconProxy).creationCode, abi.encode(BEACON, initCallData));
    }

    function deployWrapper(uint16 currencyId, uint40 maturity) external returns (address) {
        address _computedWrapper = computeAddress(currencyId, maturity);

        if (Address.isContract(_computedWrapper)) {
            // If wrapper has already been deployed then just return it's address
            return _computedWrapper;
        } else {
            address wrapper = Create2.deploy(0, SALT, _getByteCode(currencyId, maturity));
            emit WrapperDeployed(currencyId, maturity, wrapper);
            return wrapper;
        }
    }

    function computeAddress(uint16 currencyId, uint40 maturity) public view returns (address) {
        return Create2.computeAddress(SALT, keccak256(_getByteCode(currencyId, maturity)));
    }
}