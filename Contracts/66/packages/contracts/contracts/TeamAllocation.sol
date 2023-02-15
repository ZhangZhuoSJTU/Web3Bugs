// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "./Interfaces/IERC20.sol";
import "./Dependencies/SafeERC20.sol";

/*
 * Brought to you by @YetiFinance
 * Holds/Distributes Yeti Finance Team Tokens
*/
contract TeamAllocation {
    using SafeERC20 for IERC20;

    IERC20 YETI;
    address teamWallet;

    address[7] team;
    uint[7] allocations;

    bool allocationClaimed;
    bool yetiSet;

    uint internal _94_5_thousand = 945e20; // 70% * 27% * 500,000

    event teamAddressUpdated(address newTeamAddress);


    constructor() public {

        teamWallet = msg.sender;

        team = [
        address(0x5Ed80B5C5e8A34D5E60572C022483Dc234Aea5Bb),
        address(0x02B11CdD34Ca73358c162C6B50f8eCe40a63F67F),
        address(0x95F58372A6e4b1B6D571e638E4f0aaFb4B0D895d),
        address(0xE4147a2B5bAc2D1B9FA23a1C0D477700Af590280),
        address(0x7Cd7D566ad0AD1903dfE680e4a1696814734eC28),
        address(0x7eFCCB1dE156b0ee337fD22567ae60c660dc265E),
        address(0xFB2B6fe35470CE08721cdfC84a61A6aa814262E7)
        ];

        allocations = [
        _94_5_thousand * 320,
        _94_5_thousand * 265,
        _94_5_thousand * 220,
        _94_5_thousand * 80,
        _94_5_thousand * 70,
        _94_5_thousand * 30,
        _94_5_thousand * 15
        ];

        emit teamAddressUpdated(teamWallet);
    }


    modifier onlyTeam() {
        require(msg.sender == teamWallet, "Not a team wallet");
        _;
    }


    function setYetiAddress(IERC20 _YETI) external onlyTeam {
        YETI = _YETI;
        yetiSet = true;
    }


    function sendAllocatedYETI() external {
        require(yetiSet, "sendAllocatedYETI: yeti team address not set");
        require(!allocationClaimed, "sendAllocatedYETI: allocation claimed");
        for (uint256 i; i < 7; ++i) {
            address member = team[i];
            uint amount = allocations[i];
            YETI.safeTransfer(member, amount);
        }
        allocationClaimed = true;
    }


    function sendUnallocatedYETI(address _to, uint _amount) external onlyTeam {
        require(allocationClaimed, "sendUnallocatedYETI: allocation already claimed");
        YETI.safeTransfer(_to, _amount);
    }


    function updateTeamAddress(address _newTeamWallet) external onlyTeam {
        require(_newTeamWallet != address(0), "updateTeamAddress: new team wallet cannot be the zero address");
        teamWallet = _newTeamWallet;
        emit teamAddressUpdated(teamWallet);
    }


    function getTeamWallet() external view returns (address) {
        return teamWallet;
    }

}
