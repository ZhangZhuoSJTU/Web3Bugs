// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @notice Vether (vetherasset.io) contract for Public Sale Batch Withdrawals
 * @author Vether (vetherasset.io)
 */

interface BootTGE {

    function withdrawShareForMember(uint era, uint day, address member) external returns (uint value);

    function getDaysContributedForEra(address member, uint era) external view returns(uint);

    function mapMemberEra_Days(address member, uint era, uint day) external view returns(uint);
}

/**
 * @title BatchWithdraw
 */
contract BatchWithdraw {
    address tgeContract; //Contract address of PublicSale.sol
    constructor (address _tgeContract) {
        require(address(_tgeContract) != address(0), "Invalid address");
        tgeContract = _tgeContract;
    }

    function batchWithdraw(uint era, uint[] memory arrayDays, address member) public {
        for (uint i = 0; i < arrayDays.length; i++) {
            BootTGE(tgeContract).withdrawShareForMember(era, arrayDays[i], member);
        }
    }

    function withdrawAll(uint era, address member) public {
        uint length = BootTGE(tgeContract).getDaysContributedForEra(member, era);
        for (uint i = 0; i < length; i++) {
            uint day = BootTGE(tgeContract).mapMemberEra_Days(member, era, i);
            BootTGE(tgeContract).withdrawShareForMember(era, day, member);
        }
    }
}