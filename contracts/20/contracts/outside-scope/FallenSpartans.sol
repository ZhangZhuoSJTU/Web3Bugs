// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

import "./iBEP20.sol"; 
import "./iDAO.sol";
import "./iBASE.sol";

contract FallenSpartans {

    address public SPARTA;
    address public DEPLOYER;
    uint256 public genesis;

    mapping(address => uint256) mapFallenSpartan_toClaim;

    event SpartanAllocated(address indexed spartanAddress, uint256 amount);
    event SpartanClaimed(address indexed spartanAddress, uint256 amount);

    modifier onlyDAO() {
        require(msg.sender == DEPLOYER);
        _;
    }
    constructor(address _sparta) {
        SPARTA = _sparta;
        DEPLOYER = msg.sender;
        genesis = block.timestamp;
    }

    function _DAO() internal view returns(iDAO) {
         return iBASE(SPARTA).DAO(); 
    }

    function allocate(address [] memory _fallenSpartans, uint256 [] memory _claims) external onlyDAO {
        for(uint i = 0; i<_fallenSpartans.length; i++){
            mapFallenSpartan_toClaim[_fallenSpartans[i]] = _claims[i];
            emit SpartanAllocated(_fallenSpartans[i],_claims[i]);
        }
    }

    function claim() external {
       uint claimable = mapFallenSpartan_toClaim[msg.sender];
       mapFallenSpartan_toClaim[msg.sender] = 0;
       require(iBEP20(SPARTA).transfer(msg.sender, claimable));
       emit SpartanClaimed( msg.sender, claimable);
    }

    function expire() external onlyDAO {
        require(block.timestamp >= genesis + 15552000);//6months 15552000
        iBEP20(SPARTA).transfer(_DAO().RESERVE(),iBEP20(SPARTA).balanceOf(address(this)));
    }

    //============================Helpers=============================//
    function getClaim(address spartan) public view returns (uint){
        return mapFallenSpartan_toClaim[spartan];
    }


}