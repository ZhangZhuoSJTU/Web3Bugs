// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {L2ArbitrumMessenger} from "./L2ArbitrumMessenger.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

contract L2LPTDataCache is Ownable, L2ArbitrumMessenger {
    address public l1LPTDataCache;
    address public l2LPTGateway;

    // Total supply of LPT on L1
    // Updates are initiated by a call from the L1LPTDataCache on L1
    uint256 public l1TotalSupply;
    // Amount of L2 LPT transferred from L1 via the LPT bridge
    uint256 public l2SupplyFromL1;

    event CacheTotalSupplyFinalized(uint256 totalSupply);

    modifier onlyL2LPTGateway() {
        require(msg.sender == l2LPTGateway, "NOT_L2_LPT_GATEWAY");
        _;
    }

    /**
     * @notice Sets the L1LPTDataCache
     * @param _l1LPTDataCache L1 address of L1LPTDataCache
     */
    function setL1LPTDataCache(address _l1LPTDataCache) external onlyOwner {
        l1LPTDataCache = _l1LPTDataCache;
    }

    /**
     * @notice Sets the L2LPTGateway
     * @param _l2LPTGateway L2 address of L2LPTGateway
     */
    function setL2LPTGateway(address _l2LPTGateway) external onlyOwner {
        l2LPTGateway = _l2LPTGateway;
    }

    /**
     * @notice Called by L2LPTGateway to increase l2SupplyFromL1
     * @dev Should be called when L2LPTGateway mints LPT to ensure that L2 total supply and l2SupplyFromL1 increase by the same amount
     * @param _amount Amount to increase l2SupplyFromL1
     */
    function increaseL2SupplyFromL1(uint256 _amount) external onlyL2LPTGateway {
        l2SupplyFromL1 += _amount;

        // No event because the L2LPTGateway events are sufficient
    }

    /**
     * @notice Called by L2LPTGateway to decrease l2SupplyFromL1
     * @dev Should be called when L2LPTGateway burns LPT ensure L2 total supply and l2SupplyFromL1 decrease by the same amount
     * @param _amount Amount to decrease l2SupplyFromL1
     */
    function decreaseL2SupplyFromL1(uint256 _amount) external onlyL2LPTGateway {
        // If there is a mass withdrawal from L2, _amount could exceed l2SupplyFromL1.
        // In this case, we just set l2SupplyFromL1 = 0 because there will be no more supply on L2
        // that is from L1 and the excess (_amount - l2SupplyFromL1) is inflationary LPT that was
        // never from L1 in the first place.
        if (_amount > l2SupplyFromL1) {
            l2SupplyFromL1 = 0;
        } else {
            l2SupplyFromL1 -= _amount;
        }

        // No event because the L2LPTGateway events are sufficient
    }

    /**
     * @notice Called by L1LPTDataCache from L1 to cache L1 LPT total supply
     * @param _totalSupply L1 LPT total supply
     */
    function finalizeCacheTotalSupply(uint256 _totalSupply)
        external
        onlyL1Counterpart(l1LPTDataCache)
    {
        l1TotalSupply = _totalSupply;

        emit CacheTotalSupplyFinalized(_totalSupply);
    }

    /**
     * @notice Calculate and return L1 LPT circulating supply
     * @return L1 LPT circulating supply
     */
    function l1CirculatingSupply() public view returns (uint256) {
        // After the first update from L1, l1TotalSupply should always be >= l2SupplyFromL1
        // The below check is defensive to avoid reverting if this invariant for some reason violated
        return
            l1TotalSupply >= l2SupplyFromL1
                ? l1TotalSupply - l2SupplyFromL1
                : 0;
    }
}
