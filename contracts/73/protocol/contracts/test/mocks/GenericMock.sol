pragma solidity ^0.5.11;

/**
 * @title A mock contract that can set/return mock values and execute functions
 * on target contracts
 */
contract GenericMock {
    struct MockValue {
        uint256 uint256Value;
        bytes32 bytes32Value;
        bool boolValue;
        address addressValue;
        MockValueType valueType;
        bool set;
        mapping(bytes32 => uint256) uint256Values;
    }

    enum MockValueType {
        Uint256,
        Bytes32,
        Bool,
        Address
    }

    // Track function selectors and mapped mock values
    mapping(bytes4 => MockValue) mockValues;

    /**
     * @dev Return mock value for a functione
     */
    function() external payable {
        bytes4 func;
        assembly {
            func := calldataload(0)
        }

        bytes32 dataHash = keccak256(abi.encodePacked(msg.data));

        if (!mockValues[func].set) {
            // If mock value not set, default to return a bool with value false
            mLoadAndReturn(false);
        } else {
            if (mockValues[func].valueType == MockValueType.Uint256) {
                uint256 value = mockValues[func].uint256Values[dataHash];
                // TODO: Make sure we don't go into this code block if the value set
                // for dataHash should actually be 0
                if (value == 0) {
                    value = mockValues[func].uint256Value;
                }
                mLoadAndReturn(value);
            } else if (mockValues[func].valueType == MockValueType.Bytes32) {
                mLoadAndReturn(mockValues[func].bytes32Value);
            } else if (mockValues[func].valueType == MockValueType.Bool) {
                mLoadAndReturn(mockValues[func].boolValue);
            } else if (mockValues[func].valueType == MockValueType.Address) {
                mLoadAndReturn(mockValues[func].addressValue);
            }
        }
    }

    /**
     * @dev Call a function on a target address using provided calldata for a function
     * @param _target Target contract to call with data
     * @param _data Transaction data to be used to call the target contract
     */
    function execute(address _target, bytes calldata _data) external payable {
        // solium-disable-next-line
        (bool ok, bytes memory res) = _target.call.value(msg.value)(_data);
        require(ok, string(res));
    }

    /**
     * @dev Set a mock uint256 value for a function
     * @param _func Function selector (bytes4(keccak256(FUNCTION_SIGNATURE)))
     * @param _value Mock uint256 value
     */
    function setMockUint256(bytes4 _func, uint256 _value) external returns (bool) {
        mockValues[_func].valueType = MockValueType.Uint256;
        mockValues[_func].uint256Value = _value;
        mockValues[_func].set = true;
    }

    /**
     * @dev Set a mockuint256 value for a function with specific params passed
     * @param _func Function selector (bytes4(keccak256(FUNCTION_SIGNATURE)))
     * @param _dataHash keccak256 hash of tx data i.e. keccak256(msg.data)
     * @param _value Mock uint256 value
     */
    function setMockUint256WithParam(
        bytes4 _func,
        bytes32 _dataHash,
        uint256 _value
    ) external returns (bool) {
        mockValues[_func].valueType = MockValueType.Uint256;
        mockValues[_func].uint256Values[_dataHash] = _value;
        mockValues[_func].set = true;
    }

    /**
     * @dev Set a mock bytes32 value for a function
     * @param _func Function selector (bytes4(keccak256(FUNCTION_SIGNATURE)))
     * param _value Mock bytes32 value
     */
    function setMockBytes32(bytes4 _func, bytes32 _value) external {
        mockValues[_func].valueType = MockValueType.Bytes32;
        mockValues[_func].bytes32Value = _value;
        mockValues[_func].set = true;
    }

    /**
     * @dev Set a mock bool value for a function
     * @param _func Function selector (bytes4(keccak256(FUNCTION_SIGNATURE)))
     * @param _value Mock bool value
     */
    function setMockBool(bytes4 _func, bool _value) external {
        mockValues[_func].valueType = MockValueType.Bool;
        mockValues[_func].boolValue = _value;
        mockValues[_func].set = true;
    }

    /**
     * @dev Set a mock address value for a function
     * @param _func Function selector (bytes4(keccak256(FUNCTION_SIGNATURE)))
     * @param _value Mock address value
     */
    function setMockAddress(bytes4 _func, address _value) external {
        mockValues[_func].valueType = MockValueType.Address;
        mockValues[_func].addressValue = _value;
        mockValues[_func].set = true;
    }

    /**
     * @dev Load a uint256 value into memory and return it
     * @param _value Uint256 value
     */
    function mLoadAndReturn(uint256 _value) private pure {
        assembly {
            let memOffset := mload(0x40)
            mstore(0x40, add(memOffset, 32))
            mstore(memOffset, _value)
            return(memOffset, 32)
        }
    }

    /**
     * @dev Load a bytes32 value into memory and return it
     * @param _value Bytes32 value
     */
    function mLoadAndReturn(bytes32 _value) private pure {
        assembly {
            let memOffset := mload(0x40)
            mstore(0x40, add(memOffset, 32))
            mstore(memOffset, _value)
            return(memOffset, 32)
        }
    }

    /**
     * @dev Load a bool value into memory and return it
     * @param _value Bool value
     */
    function mLoadAndReturn(bool _value) private pure {
        assembly {
            let memOffset := mload(0x40)
            mstore(0x40, add(memOffset, 32))
            mstore(memOffset, _value)
            return(memOffset, 32)
        }
    }

    /**
     * @dev Load an address value into memory and return it
     * @param _value Address value
     */
    function mLoadAndReturn(address _value) private pure {
        assembly {
            let memOffset := mload(0x40)
            mstore(0x40, add(memOffset, 32))
            mstore(memOffset, _value)
            return(memOffset, 32)
        }
    }
}
