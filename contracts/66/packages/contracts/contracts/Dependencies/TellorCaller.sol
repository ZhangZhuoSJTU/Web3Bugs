// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../Interfaces/ITellorCaller.sol";
import "../Interfaces/ITellor.sol";
import "./SafeMath.sol";
/*
* This contract has a single external function that calls Tellor: getTellorCurrentValue(). 
*
* The function is called by the Liquity contract PriceFeed.sol. If any of its inner calls to Tellor revert, 
* this function will revert, and PriceFeed will catch the failure and handle it accordingly.
*
* The function comes from Tellor's own wrapper contract, 'UsingTellor.sol':
* https://github.com/tellor-io/usingtellor/blob/master/contracts/UsingTellor.sol
*
*/
contract TellorCaller is ITellorCaller {
    using SafeMath for uint256;

    ITellor public tellor;

    constructor (address _tellorMasterAddress) public {
        tellor = ITellor(_tellorMasterAddress);
    }

    /*
    * getTellorCurrentValue(): identical to getCurrentValue() in UsingTellor.sol
    *
    * @dev Allows the user to get the latest value for the requestId specified
    * @param _requestId is the requestId to look up the value for
    * @return ifRetrieve bool true if it is able to retrieve a value, the value, and the value's timestamp
    * @return value the value retrieved
    * @return _timestampRetrieved the value's timestamp
    */
    function getTellorCurrentValue(uint256 _requestId)
        external
        view
        override
        returns (
            bool ifRetrieve,
            uint256 value,
            uint256 _timestampRetrieved
        )
    {
        uint256 _count = tellor.getNewValueCountbyRequestId(_requestId);
        uint256 _time =
            tellor.getTimestampbyRequestIDandIndex(_requestId, _count.sub(1));
        uint256 _value = tellor.retrieveData(_requestId, _time);
        if (_value != 0) return (true, _value, _time);
        return (false, 0, _time);
    }
}
