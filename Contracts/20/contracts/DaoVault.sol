// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./interfaces/iBEP20.sol";
import "./interfaces/iDAO.sol";
import "./interfaces/iBASE.sol";
import "./interfaces/iPOOL.sol";
import "./interfaces/iUTILS.sol";
import "./interfaces/iROUTER.sol";
import "./interfaces/iRESERVE.sol";

contract DaoVault {
    address public BASE;
    address public DEPLOYER;
    uint256 public totalWeight; // Total weight of the whole DAOVault

    constructor(address _base) {
        BASE = _base;
        DEPLOYER = msg.sender;
    }

    mapping(address => uint256) private mapMember_weight; // Member's total weight in DAOVault
    mapping(address => mapping(address => uint256)) private mapMemberPool_balance; // Member's LPs locked in DAOVault
    mapping(address => mapping(address => uint256)) public mapMember_depositTime; // Timestamp when user last deposited
    mapping(address => mapping(address => uint256)) private mapMemberPool_weight; // Member's total weight in DOAVault (scope: pool)

    // Restrict access
    modifier onlyDAO() {
        require(msg.sender == _DAO().DAO() || msg.sender == DEPLOYER, "!DAO");
        _;
    }

    function _DAO() internal view returns (iDAO) {
        return iBASE(BASE).DAO();
    }

    // User despoits LP tokens in the DAOVault
    function depositLP(address pool, uint256 amount, address member) external onlyDAO returns (bool) {
        mapMemberPool_balance[member][pool] += amount; // Updated user's vault balance
        increaseWeight(pool, member); // Recalculate user's DAOVault weights
        return true;
    }

    // Update a member's weight in the DAOVault (scope: pool)
    function increaseWeight(address pool, address member) internal returns (uint256){
        if (mapMemberPool_weight[member][pool] > 0) {
            totalWeight -= mapMemberPool_weight[member][pool]; // Remove user's previous weight (scope: vault)
            mapMember_weight[member] -= mapMemberPool_weight[member][pool]; // Remove user's previous weight (scope: member -> pool)
            mapMemberPool_weight[member][pool] = 0; // Reset user's weight to zero (scope: member -> pool)
        }
        uint256 weight = iUTILS(_DAO().UTILS()).getPoolShareWeight(iPOOL(pool).TOKEN(), mapMemberPool_balance[member][pool]); // Get user's current weight
        mapMemberPool_weight[member][pool] = weight; // Set user's new weight (scope: member -> pool)
        mapMember_weight[member] += weight; // Set user's new total weight (scope: member)
        totalWeight += weight; // Add user's new weight to the total weight (scope: DAOVault)
        mapMember_depositTime[member][pool] = block.timestamp; // Set user's new last-deposit-time
        return weight;
    }

    // Update a member's weight in the DAOVault (scope: pool)
    function decreaseWeight(address pool, address member) internal {
        uint256 weight = mapMemberPool_weight[member][pool]; // Get user's previous weight
        mapMemberPool_balance[member][pool] = 0; // Zero out user's balance (scope: member -> pool)
        mapMemberPool_weight[member][pool] = 0; // Zero out user's weight (scope: member -> pool)
        totalWeight -= weight; // Remove user's previous weight from the total weight (scope: DAOVault)
        mapMember_weight[member] -= weight; // Remove user's previous weight from their total weight (scope: member)
    }

    // Withdraw 100% of user's LPs from their DAOVault
    function withdraw(address pool, address member) external onlyDAO returns (bool){
        require(block.timestamp > (mapMember_depositTime[member][pool] + 86400), '!unlocked'); // 1 day must have passed since last deposit (lockup period)
        uint256 _balance = mapMemberPool_balance[member][pool]; // Get user's whole balance (scope: member -> pool)
        require(_balance > 0, "!balance"); // Withdraw amount must be valid
        decreaseWeight(pool, member); // Recalculate user's DAOVault weights
        require(iBEP20(pool).transfer(member, _balance), "!transfer"); // Transfer user's balance to their wallet
        return true;
    }

    // Get user's current total DAOVault weight
    function getMemberWeight(address member) external view returns (uint256) {
        if (mapMember_weight[member] > 0) {
            return mapMember_weight[member];
        } else {
            return 0;
        }
    }

    // Get user's current balance of a chosen asset
    function getMemberPoolBalance(address pool, address member)  external view returns (uint256){
        return mapMemberPool_balance[member][pool];
    }

    // Get user's current DAOVault weight from a chosen asset
    function getMemberPoolWeight(address pool, address member) external view returns (uint256){
        return mapMemberPool_weight[member][pool];
    }
}