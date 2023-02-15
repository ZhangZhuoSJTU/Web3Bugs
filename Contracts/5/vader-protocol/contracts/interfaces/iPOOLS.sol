// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

interface iPOOLS{
    function pooledVADER() external view returns(uint);
    function pooledUSDV() external view returns(uint);
    function addLiquidity(address base, address token, address member) external returns(uint liquidityUnits);
    function removeLiquidity(address base, address token, uint basisPoints) external returns (uint outputBase, uint outputToken);
    function sync(address token, address pool) external;
    function swap(address base, address token, address member, bool toBase) external returns (uint outputAmount);
    function deploySynth(address token) external;
    function mintSynth(address base, address token, address member) external returns (uint outputAmount);
    function burnSynth(address base, address token, address member) external returns (uint outputBase);
    function syncSynth(address token) external;
    function lockUnits(uint units, address token, address member) external;
    function unlockUnits(uint units, address token, address member) external;
    function isMember(address member) external view returns(bool);
    function isAsset(address token) external view returns(bool);
    function isAnchor(address token) external view returns(bool);
    function getPoolAmounts(address token) external view returns(uint, uint);
    function getBaseAmount(address token) external view returns(uint);
    function getTokenAmount(address token) external view returns(uint);
    function getUnits(address token) external view returns(uint);
    function getMemberUnits(address token, address member) external view returns(uint);
    function getSynth(address token) external returns (address);
    function isSynth(address token) external returns (bool);
}