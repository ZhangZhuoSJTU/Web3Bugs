// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;


contract MockTellor {

    // --- Mock price data ---

    bool didRetrieve = true; // default to a positive retrieval
    uint private price;
    uint private updateTime;

    bool private revertRequest;

    // --- Setters for mock price data ---

    function setPrice(uint _price) external {
        price = _price;
    }

      function setDidRetrieve(bool _didRetrieve) external {
        didRetrieve = _didRetrieve;
    }

    function setUpdateTime(uint _updateTime) external {
        updateTime = _updateTime;
    }

      function setRevertRequest() external {
        revertRequest = !revertRequest;
    }

    // --- Mock data reporting functions --- 

    function getTimestampbyRequestIDandIndex(uint, uint) external view returns (uint) {
        return updateTime;
    }

    function getNewValueCountbyRequestId(uint) external view returns (uint) {
        if (revertRequest) {require (1 == 0, "Tellor request reverted");}
        return 1;
    }

    function retrieveData(uint256, uint256) external view returns (uint256) {
        return price;
    }



}
