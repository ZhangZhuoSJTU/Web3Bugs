//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IBondingManager {
    function pendingStake(address _addr, uint256 _endRound)
        external
        view
        returns (uint256);

    function pendingFees(address _addr, uint256 _endRound)
        external
        view
        returns (uint256);

    function transferBond(
        address _delegator,
        uint256 _amount,
        address _oldDelegateNewPosPrev,
        address _oldDelegateNewPosNext,
        address _newDelegateNewPosPrev,
        address _newDelegateNewPosNext
    ) external;

    function withdrawFees(address payable _recipient, uint256 _amount) external;
}

contract DelegatorPool is Initializable {
    uint256 public initialStake;
    uint256 public claimedInitialStake;

    address public bondingManager;
    address public migrator;

    event Claimed(address indexed _delegator, uint256 _stake, uint256 _fees);

    modifier onlyMigrator() {
        require(msg.sender == migrator, "DelegatorPool#claim: NOT_MIGRATOR");
        _;
    }

    /**
     * @notice Initialize state
     * @param _bondingManager Address of L2 BondingManager
     */
    function initialize(address _bondingManager) public initializer {
        bondingManager = _bondingManager;
        migrator = msg.sender;
        initialStake = pendingStake();
    }

    /**
     * @notice Called by L2Migrator to credit stake and fees held by this contract to a delegator
     * @param _delegator Address of delegator
     * @param _stake Stake of delegator
     */
    function claim(address _delegator, uint256 _stake) external onlyMigrator {
        require(
            claimedInitialStake < initialStake,
            "DelegatorPool#claim: FULLY_CLAIMED"
        );

        // _stake is the delegator's original stake
        // This contract started off with initalStake
        // We can calculate how much of the contract's current stake and fees
        // are owed to the delegator proportional to _stake / (initialStake - claimedInitialStake)
        // where claimedInitialStake is the stake of the contract that has already been claimed

        // Calculate stake owed to delegator
        uint256 currTotalStake = pendingStake();
        uint256 owedStake = (currTotalStake * _stake) /
            (initialStake - claimedInitialStake);

        // Calculate fees owed to delegator
        uint256 currTotalFees = pendingFees();
        uint256 owedFees = (currTotalFees * _stake) /
            (initialStake - claimedInitialStake);

        // update claimed balance
        claimedInitialStake += _stake;

        // Transfer owed stake to the delegator
        transferBond(_delegator, owedStake);

        // Transfer owed fees to the delegator
        IBondingManager(bondingManager).withdrawFees(
            payable(_delegator),
            owedFees
        );

        emit Claimed(_delegator, owedStake, owedFees);
    }

    function transferBond(address _delegator, uint256 _stake) internal {
        IBondingManager(bondingManager).transferBond(
            _delegator,
            _stake,
            address(0),
            address(0),
            address(0),
            address(0)
        );
    }

    function pendingStake() internal view returns (uint256) {
        return IBondingManager(bondingManager).pendingStake(address(this), 0);
    }

    function pendingFees() internal view returns (uint256) {
        return IBondingManager(bondingManager).pendingFees(address(this), 0);
    }
}
