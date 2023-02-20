// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

interface iVAULT {
    function setParams(uint newEra, uint newDepositTime, uint newGrantTime) external;
    function grant(address recipient, uint amount) external;

    function deposit(address synth, uint amount) external;
    function depositForMember(address synth, address member, uint amount) external;
    function harvest(address synth) external returns(uint reward);
    function calcCurrentReward(address synth, address member) external view returns(uint reward);
    function calcReward(address synth, address member) external view returns(uint);
    function withdraw(address synth, uint basisPoints) external returns(uint redeemedAmount);
    
    function totalWeight() external view returns(uint);
    function reserveUSDV() external view returns(uint);
    function reserveVADER() external view returns(uint);
    function getMemberDeposit(address synth, address member) external view returns(uint);
    function getMemberWeight(address member) external view returns(uint);
    function getMemberLastTime(address synth, address member) external view returns(uint);
}