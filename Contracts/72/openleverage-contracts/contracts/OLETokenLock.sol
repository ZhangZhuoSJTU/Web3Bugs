// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;


import "@openzeppelin/contracts/math/SafeMath.sol";
import "./gov/OLEToken.sol";


/// @title OLE token Locked
/// @author OpenLeverage
/// @notice Release OLE to beneficiaries linearly.
contract OLETokenLock {

    using SafeMath for uint256;
    OLEToken public token;
    mapping(address => ReleaseVar) public releaseVars;

    event Release(address beneficiary, uint amount);
    event TransferTo(address beneficiary, address to, uint amount);

    struct ReleaseVar {
        uint256 amount;
        uint128 startTime;
        uint128 endTime;
        uint128 lastUpdateTime;
    }

    constructor(OLEToken token_, address[] memory beneficiaries, uint256[] memory amounts, uint128[] memory startTimes, uint128[] memory endTimes) {
        require(beneficiaries.length == amounts.length
        && beneficiaries.length == startTimes.length
            && beneficiaries.length == endTimes.length, "Array length must be same");
        token = token_;
        for (uint i = 0; i < beneficiaries.length; i++) {
            address beneficiary = beneficiaries[i];
            releaseVars[beneficiary] = ReleaseVar(amounts[i], startTimes[i], endTimes[i], startTimes[i]);
        }
    }

    function release(address beneficiary) external {
        require(beneficiary != address(0), "beneficiary address cannot be 0");
        releaseInternal(beneficiary);
    }

    function releaseInternal(address beneficiary) internal {
        uint256 amount = token.balanceOf(address(this));
        require(amount > 0, "no amount available");
        uint256 releaseAmount = releaseAbleAmount(beneficiary);
        // The transfer out limit exceeds the available limit of the account
        require(amount >= releaseAmount, "transfer out limit exceeds ");
        releaseVars[beneficiary].lastUpdateTime = uint128(block.timestamp > releaseVars[beneficiary].endTime ? releaseVars[beneficiary].endTime : block.timestamp);
        token.transfer(beneficiary, releaseAmount);
        emit Release(beneficiary, releaseAmount);
    }

    function transferTo(address to, uint amount) external {
        address beneficiary = msg.sender;
        require(releaseVars[beneficiary].amount > 0, 'beneficiary does not exist');
        require(releaseVars[to].amount == 0, 'to is exist');
        require(to != beneficiary, 'same address');
        // release firstly
        releaseInternal(beneficiary);
        // calc locked left amount
        uint lockedLeftAmount = lockedAmount(beneficiary);
        require(lockedLeftAmount >= amount, 'Not enough');
        releaseVars[beneficiary].amount = lockedLeftAmount.sub(amount);
        uint128 startTime = uint128(releaseVars[beneficiary].startTime > block.timestamp ? releaseVars[beneficiary].startTime : block.timestamp);
        releaseVars[beneficiary].startTime = startTime;
        releaseVars[to] = ReleaseVar(amount, startTime, releaseVars[beneficiary].endTime, startTime);
        emit TransferTo(beneficiary, to, amount);
    }

    function releaseAbleAmount(address beneficiary) public view returns (uint256){
        ReleaseVar memory releaseVar = releaseVars[beneficiary];
        require(block.timestamp >= releaseVar.startTime, "not time to unlock");
        require(releaseVar.amount > 0, "beneficiary does not exist");
        uint256 calTime = block.timestamp > releaseVar.endTime ? releaseVar.endTime : block.timestamp;
        return calTime.sub(releaseVar.lastUpdateTime).mul(releaseVar.amount)
        .div(releaseVar.endTime - releaseVar.startTime);
    }

    function lockedAmount(address beneficiary) public view returns (uint256){
        ReleaseVar memory releaseVar = releaseVars[beneficiary];
        require(releaseVar.endTime >= block.timestamp, 'locked end');
        return releaseVar.amount.mul(releaseVar.endTime - releaseVar.lastUpdateTime)
        .div(releaseVar.endTime - releaseVar.startTime);
    }

}