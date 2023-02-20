// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./interfaces/iBEP20.sol";
import "./interfaces/iDAO.sol";
import "./interfaces/iBASE.sol";
import "./interfaces/iUTILS.sol";
import "./interfaces/iROUTER.sol";
import "./interfaces/iPOOL.sol";
import "./interfaces/iPOOLFACTORY.sol";

contract BondVault {
    address public BASE;
    address public DEPLOYER;
    uint256 public totalWeight;
    bool private bondRelease;
    address [] public arrayMembers;

    struct ListedAssets {
        bool isListed;
        address[] members;
        mapping(address => bool) isMember;
        mapping(address => uint256) bondedLP;
        mapping(address => uint256) claimRate;
        mapping(address => uint256) lastBlockTime;
    }
    struct MemberDetails {
        bool isMember;
        uint256 bondedLP;
        uint256 claimRate;
        uint256 lastBlockTime;
    }

    mapping(address => ListedAssets) public mapBondAsset_memberDetails;
    mapping(address => uint256) private mapMember_weight; // Value of users weight (scope: user)
    mapping(address => mapping(address => uint256)) private mapMemberPool_weight; // Value of users weight (scope: pool)

    constructor (address _base) {
        BASE = _base;
        DEPLOYER = msg.sender;
        bondRelease = false;
    }

    // Restrict access
    modifier onlyDAO() {
        require(msg.sender == _DAO().DAO() || msg.sender == DEPLOYER);
        _;
    }

    // Can purge deployer once DAO is stable and final
    function purgeDeployer() public onlyDAO {
        DEPLOYER = address(0);
    }

    // Get the current DAO address as reported by the BASE contract
    function _DAO() internal view returns(iDAO) {
        return iBASE(BASE).DAO();
    }

    // Deposit LPs in the BondVault for a user (Called from DAO)
    function depositForMember(address asset, address member, uint LPS) external onlyDAO returns(bool){
        if(!mapBondAsset_memberDetails[asset].isMember[member]){
            mapBondAsset_memberDetails[asset].isMember[member] = true; // Register user as member (scope: user -> asset)
            arrayMembers.push(member); // Add user to member array (scope: vault)
            mapBondAsset_memberDetails[asset].members.push(member); // Add user to member array (scope: user -> asset)
        }
        if(mapBondAsset_memberDetails[asset].bondedLP[member] != 0){
            claimForMember(asset, member); // Force claim if member has an existing remainder
        }
        mapBondAsset_memberDetails[asset].bondedLP[member] += LPS; // Add new deposit to users remainder
        mapBondAsset_memberDetails[asset].lastBlockTime[member] = block.timestamp; // Set lastBlockTime to current time
        mapBondAsset_memberDetails[asset].claimRate[member] = mapBondAsset_memberDetails[asset].bondedLP[member] / iDAO(_DAO().DAO()).bondingPeriodSeconds(); // Set claim rate per second
        increaseWeight(asset, member); // Update user's weight
        return true;
    }

    // Increase user's weight in the BondVault
    function increaseWeight(address asset, address member) internal{
        address pool = iPOOLFACTORY(_DAO().POOLFACTORY()).getPool(asset); // Get pool address
        if (mapMemberPool_weight[member][pool] > 0) {
            totalWeight -= mapMemberPool_weight[member][pool]; // Remove user weight from totalWeight (scope: vault)
            mapMember_weight[member] -= mapMemberPool_weight[member][pool]; // Remove user weight from totalWeight (scope: user)
            mapMemberPool_weight[member][pool] = 0; // Zero out user weight (scope: user -> pool)
        }
        uint256 weight = iUTILS(_DAO().UTILS()).getPoolShareWeight(asset, mapBondAsset_memberDetails[asset].bondedLP[member]); // Calculate user's bonded weight
        mapMemberPool_weight[member][pool] = weight; // Set new weight (scope: user -> pool)
        mapMember_weight[member] += weight; // Add new weight to totalWeight (scope: user)
        totalWeight += weight; // Add new weight to totalWeight (scope: vault)
    }

    // Calculate the user's current available claim amount
    function calcBondedLP(address member, address asset) public view returns (uint claimAmount){ 
        if(mapBondAsset_memberDetails[asset].isMember[member]){
            uint256 _secondsSinceClaim = block.timestamp - mapBondAsset_memberDetails[asset].lastBlockTime[member]; // Get seconds passed since last claim
            uint256 rate = mapBondAsset_memberDetails[asset].claimRate[member]; // Get user's claim rate
            claimAmount = _secondsSinceClaim * rate; // Set claim amount
            if(claimAmount >= mapBondAsset_memberDetails[asset].bondedLP[member] || bondRelease){
                claimAmount = mapBondAsset_memberDetails[asset].bondedLP[member]; // If final claim; set claimAmount as remainder
            }
            return claimAmount;
        }
    }

    // Perform a claim of the users's current available claim amount
    function claimForMember(address asset, address member) public onlyDAO returns (bool){
        require(mapBondAsset_memberDetails[asset].bondedLP[member] > 0, '!bonded'); // They must have remaining unclaimed LPs
        require(mapBondAsset_memberDetails[asset].isMember[member], '!member'); // They must be a member (scope: user -> asset)
        uint256 _claimable = calcBondedLP(member, asset); // Get the current claimable amount
        address _pool = iPOOLFACTORY(_DAO().POOLFACTORY()).getPool(asset); // Get the pool address
        mapBondAsset_memberDetails[asset].lastBlockTime[member] = block.timestamp; // Set lastBlockTime to current time
        mapBondAsset_memberDetails[asset].bondedLP[member] -= _claimable; // Remove the claim amount from the user's remainder
        if(_claimable == mapBondAsset_memberDetails[asset].bondedLP[member]){
            mapBondAsset_memberDetails[asset].claimRate[member] = 0; // If final claim; zero-out their claimRate
        }
        decreaseWeight(asset, member); // Update user's weight
        iBEP20(_pool).transfer(member, _claimable); // Send claim amount to user
        return true;
    }

    // Decrease user's weight in the BondVault
    function decreaseWeight(address asset, address member) internal {
        address _pool = iPOOLFACTORY(_DAO().POOLFACTORY()).getPool(asset); // Get pool address
        totalWeight -= mapMemberPool_weight[member][_pool]; // Remove user weight from totalWeight (scope: vault)
        mapMember_weight[member] -= mapMemberPool_weight[member][_pool]; // Remove user weight from totalWeight (scope: user)
        mapMemberPool_weight[member][_pool] = 0; // Zero out user weight (scope: user -> pool)
        uint256 weight = iUTILS(_DAO().UTILS()).getPoolShareWeight(asset, mapBondAsset_memberDetails[asset].bondedLP[member]); // Calculate user's bonded weight
        mapMemberPool_weight[member][_pool] = weight; // Set new weight (scope: user -> pool)
        mapMember_weight[member] += weight; // Add new weight to totalWeight (scope: user)
        totalWeight += weight; // // Add new weight to totalWeight (scope: vault)
    }

    // Get the total count of all existing & past BondVault members
    function memberCount() external view returns (uint256 count){
        return arrayMembers.length;
    }

    // Get array of all existing & past BondVault members
    function allMembers() external view returns (address[] memory _allMembers){
        return arrayMembers;
    }

    function release() external onlyDAO {
        bondRelease = true;
    }

    // Get a bond details (scope: user -> asset)
    function getMemberDetails(address member, address asset) external view returns (MemberDetails memory memberDetails){
        memberDetails.isMember = mapBondAsset_memberDetails[asset].isMember[member];
        memberDetails.bondedLP = mapBondAsset_memberDetails[asset].bondedLP[member];
        memberDetails.claimRate = mapBondAsset_memberDetails[asset].claimRate[member];
        memberDetails.lastBlockTime = mapBondAsset_memberDetails[asset].lastBlockTime[member];
        return memberDetails;
    }

    // Get a users's totalWeight (scope: user)
    function getMemberWeight(address member) external view returns (uint256) {
        if (mapMember_weight[member] > 0) {
            return mapMember_weight[member];
        } else {
            return 0;
        }
    } 
}