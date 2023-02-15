pragma solidity ^0.5.11;

import "../Manager.sol";
import "./IMinter.sol";
import "./ILivepeerToken.sol";
import "../rounds/IRoundsManager.sol";
import "../bonding/IBondingManager.sol";
import "../libraries/MathUtilsV2.sol";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Minter
 * @dev Manages inflation rate and the minting of new tokens for each round of the Livepeer protocol
 */
contract Minter is Manager, IMinter {
    using SafeMath for uint256;

    // Per round inflation rate
    uint256 public inflation;
    // Change in inflation rate per round until the target bonding rate is achieved
    uint256 public inflationChange;
    // Target bonding rate
    uint256 public targetBondingRate;

    // Current number of mintable tokens. Reset every round
    uint256 public currentMintableTokens;
    // Current number of minted tokens. Reset every round
    uint256 public currentMintedTokens;

    // Checks if caller is BondingManager
    modifier onlyBondingManager() {
        require(msg.sender == controller.getContract(keccak256("BondingManager")), "msg.sender not BondingManager");
        _;
    }

    // Checks if caller is RoundsManager
    modifier onlyRoundsManager() {
        require(msg.sender == controller.getContract(keccak256("RoundsManager")), "msg.sender not RoundsManager");
        _;
    }

    // Checks if caller is either BondingManager or JobsManager
    modifier onlyBondingManagerOrJobsManager() {
        require(
            msg.sender == controller.getContract(keccak256("BondingManager")) ||
                msg.sender == controller.getContract(keccak256("JobsManager")),
            "msg.sender not BondingManager or JobsManager"
        );
        _;
    }

    // Checks if caller is either the currently registered Minter or JobsManager
    modifier onlyMinterOrJobsManager() {
        require(
            msg.sender == controller.getContract(keccak256("Minter")) ||
                msg.sender == controller.getContract(keccak256("JobsManager")),
            "msg.sender not Minter or JobsManager"
        );
        _;
    }

    /**
     * @notice Minter constructor
     * @param _inflation Base inflation rate as a percentage of current total token supply
     * @param _inflationChange Change in inflation rate each round (increase or decrease) if target bonding rate is not achieved
     * @param _targetBondingRate Target bonding rate as a percentage of total bonded tokens / total token supply
     */
    constructor(
        address _controller,
        uint256 _inflation,
        uint256 _inflationChange,
        uint256 _targetBondingRate
    ) public Manager(_controller) {
        // Inflation must be valid percentage
        require(MathUtils.validPerc(_inflation), "_inflation is invalid percentage");
        // Inflation change must be valid percentage
        require(MathUtils.validPerc(_inflationChange), "_inflationChange is invalid percentage");
        // Target bonding rate must be valid percentage
        require(MathUtils.validPerc(_targetBondingRate), "_targetBondingRate is invalid percentage");

        inflation = _inflation;
        inflationChange = _inflationChange;
        targetBondingRate = _targetBondingRate;
    }

    /**
     * @notice Set targetBondingRate. Only callable by Controller owner
     * @param _targetBondingRate Target bonding rate as a percentage of total bonded tokens / total token supply
     */
    function setTargetBondingRate(uint256 _targetBondingRate) external onlyControllerOwner {
        // Must be valid percentage
        require(MathUtils.validPerc(_targetBondingRate), "_targetBondingRate is invalid percentage");

        targetBondingRate = _targetBondingRate;

        emit ParameterUpdate("targetBondingRate");
    }

    /**
     * @notice Set inflationChange. Only callable by Controller owner
     * @param _inflationChange Inflation change as a percentage of total token supply
     */
    function setInflationChange(uint256 _inflationChange) external onlyControllerOwner {
        // Must be valid percentage
        require(MathUtils.validPerc(_inflationChange), "_inflationChange is invalid percentage");

        inflationChange = _inflationChange;

        emit ParameterUpdate("inflationChange");
    }

    /**
     * @notice Migrate to a new Minter by transferring ownership of the token as well
     * as the current Minter's token balance to the new Minter. Only callable by Controller when system is paused
     * @param _newMinter Address of new Minter
     */
    function migrateToNewMinter(IMinter _newMinter) external onlyControllerOwner whenSystemPaused {
        // New Minter cannot be the current Minter
        require(_newMinter != this, "new Minter cannot be current Minter");
        // Check for null address
        require(address(_newMinter) != address(0), "new Minter cannot be null address");

        IController newMinterController = _newMinter.getController();
        // New Minter must have same Controller as current Minter
        require(newMinterController == controller, "new Minter Controller must be current Controller");
        // New Minter's Controller must have the current Minter registered
        require(newMinterController.getContract(keccak256("Minter")) == address(this), "new Minter must be registered");

        // Transfer ownership of token to new Minter
        livepeerToken().transferOwnership(address(_newMinter));
        // Transfer current Minter's token balance to new Minter
        livepeerToken().transfer(address(_newMinter), livepeerToken().balanceOf(address(this)));
        // Transfer current Minter's ETH balance to new Minter
        _newMinter.depositETH.value(address(this).balance)();
    }

    /**
     * @notice Create reward based on a fractional portion of the mintable tokens for the current round
     * @param _fracNum Numerator of fraction (active transcoder's stake)
     * @param _fracDenom Denominator of fraction (total active stake)
     */
    function createReward(uint256 _fracNum, uint256 _fracDenom)
        external
        onlyBondingManager
        whenSystemNotPaused
        returns (uint256)
    {
        // Compute and mint fraction of mintable tokens to include in reward
        uint256 mintAmount = MathUtils.percOf(currentMintableTokens, _fracNum, _fracDenom);
        // Update amount of minted tokens for round
        currentMintedTokens = currentMintedTokens.add(mintAmount);
        // Minted tokens must not exceed mintable tokens
        require(currentMintedTokens <= currentMintableTokens, "minted tokens cannot exceed mintable tokens");
        // Mint new tokens
        livepeerToken().mint(address(this), mintAmount);

        // Reward = minted tokens
        return mintAmount;
    }

    /**
     * @notice Transfer tokens to a receipient. Only callable by BondingManager - always trusts BondingManager
     * @param _to Recipient address
     * @param _amount Amount of tokens
     */
    function trustedTransferTokens(address _to, uint256 _amount) external onlyBondingManager whenSystemNotPaused {
        livepeerToken().transfer(_to, _amount);
    }

    /**
     * @notice Burn tokens. Only callable by BondingManager - always trusts BondingManager
     * @param _amount Amount of tokens to burn
     */
    function trustedBurnTokens(uint256 _amount) external onlyBondingManager whenSystemNotPaused {
        livepeerToken().burn(_amount);
    }

    /**
     * @notice Withdraw ETH to a recipient. Only callable by BondingManager or TicketBroker - always trusts these two contracts
     * @param _to Recipient address
     * @param _amount Amount of ETH
     */
    function trustedWithdrawETH(address payable _to, uint256 _amount)
        external
        onlyBondingManagerOrJobsManager
        whenSystemNotPaused
    {
        _to.transfer(_amount);
    }

    /**
     * @notice Deposit ETH to this contract. Only callable by the currently registered Minter or JobsManager
     */
    function depositETH() external payable onlyMinterOrJobsManager returns (bool) {
        return true;
    }

    /**
     * @notice Set inflation and mintable tokens for the round. Only callable by the RoundsManager
     */
    function setCurrentRewardTokens() external onlyRoundsManager whenSystemNotPaused {
        setInflation();

        // Set mintable tokens based upon current inflation and current total token supply
        currentMintableTokens = MathUtils.percOf(livepeerToken().totalSupply(), inflation);
        currentMintedTokens = 0;

        emit SetCurrentRewardTokens(currentMintableTokens, inflation);
    }

    /**
     * @dev Returns Controller interface
     */
    function getController() public view returns (IController) {
        return controller;
    }

    /**
     * @dev Set inflation based upon the current bonding rate and target bonding rate
     */
    function setInflation() internal {
        uint256 currentBondingRate = 0;
        uint256 totalSupply = livepeerToken().totalSupply();

        if (totalSupply > 0) {
            uint256 totalBonded = bondingManager().getTotalBonded();
            currentBondingRate = MathUtils.percPoints(totalBonded, totalSupply);
        }

        if (currentBondingRate < targetBondingRate) {
            // Bonding rate is below the target - increase inflation
            inflation = inflation.add(inflationChange);
        } else if (currentBondingRate > targetBondingRate) {
            // Bonding rate is above the target - decrease inflation
            if (inflationChange > inflation) {
                inflation = 0;
            } else {
                inflation = inflation.sub(inflationChange);
            }
        }
    }

    /**
     * @dev Returns LivepeerToken interface
     */
    function livepeerToken() internal view returns (ILivepeerToken) {
        return ILivepeerToken(controller.getContract(keccak256("LivepeerToken")));
    }

    /**
     * @dev Returns BondingManager interface
     */
    function bondingManager() internal view returns (IBondingManager) {
        return IBondingManager(controller.getContract(keccak256("BondingManager")));
    }
}
