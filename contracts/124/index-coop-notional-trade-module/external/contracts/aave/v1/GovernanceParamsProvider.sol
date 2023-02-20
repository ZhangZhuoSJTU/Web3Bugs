pragma solidity ^0.5.16;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "../interfaces/IGovernanceParamsProvider.sol";

contract GovernanceParamsProvider is Ownable, IGovernanceParamsProvider {

    event AssetVotingWeightProviderSet(address indexed setter, IAssetVotingWeightProvider  assetVotingWeightProvider);
    event PropositionPowerThresholdSet(address indexed setter, uint256  propositionPowerThreshold);
    event PropositionPowerSet(address indexed setter, IERC20 propositionPower);

    /// @notice Address of the smart contract providing the weight of the whitelisted assets
    IAssetVotingWeightProvider private assetVotingWeightProvider;

    /// @notice Used to get the percentage of the supply of propositionPower needed to register a proposal
    uint256 private propositionPowerThreshold;

    /// @notice Address of the asset to control who can register new proposals
    IERC20 private propositionPower;

    constructor(
        uint256 _propositionPowerThreshold,
        IERC20 _propositionPower,
        IAssetVotingWeightProvider _assetVotingWeightProvider
    ) public {
        internalSetPropositionPowerThreshold(_propositionPowerThreshold);
        internalSetPropositionPower(_propositionPower);
        internalSetAssetVotingWeightProvider(_assetVotingWeightProvider);
    }

    /// @notice Sets the propositionPowerThreshold
    /// @param _propositionPowerThreshold The address of the propositionPowerThreshold
    function setPropositionPowerThreshold(uint256 _propositionPowerThreshold) external onlyOwner {
        internalSetPropositionPowerThreshold(_propositionPowerThreshold);
    }

    /// @notice Sets the propositionPower
    /// @param _propositionPower The address of the propositionPower
    function setPropositionPower(IERC20 _propositionPower) external onlyOwner {
        internalSetPropositionPower(_propositionPower);
    }

    /// @notice Sets the assetVotingWeightProvider
    /// @param _assetVotingWeightProvider The address of the assetVotingWeightProvider
    function setAssetVotingWeightProvider(IAssetVotingWeightProvider _assetVotingWeightProvider) external onlyOwner {
        internalSetAssetVotingWeightProvider(_assetVotingWeightProvider);
    }

    /// @notice Sets the propositionPowerThreshold
    /// @param _propositionPowerThreshold The numeric propositionPowerThreshold
    function internalSetPropositionPowerThreshold(uint256 _propositionPowerThreshold) internal {
        propositionPowerThreshold = _propositionPowerThreshold;
        emit PropositionPowerThresholdSet(msg.sender, _propositionPowerThreshold);
    }

    /// @notice Sets the propositionPower
    /// @param _propositionPower The address of the propositionPower
    function internalSetPropositionPower(IERC20 _propositionPower) internal {
        propositionPower = _propositionPower;
        emit PropositionPowerSet(msg.sender, _propositionPower);
    }

    /// @notice Sets the assetVotingWeightProvider
    /// @param _assetVotingWeightProvider The address of the assetVotingWeightProvider
    function internalSetAssetVotingWeightProvider(IAssetVotingWeightProvider _assetVotingWeightProvider) internal {
        assetVotingWeightProvider = _assetVotingWeightProvider;
        emit AssetVotingWeightProviderSet(msg.sender, _assetVotingWeightProvider);
    }

    /// @notice Return the address of the propositionPower
    /// @return The address of the propositionPower
    function getPropositionPower() external view returns(IERC20) {
        return propositionPower;
    }

    /// @notice Returns the propositionPowerThreshold
    /// @return The propositionPowerThreshold
    function getPropositionPowerThreshold() external view returns(uint256) {
        return propositionPowerThreshold;
    }

    /// @notice Returns the assetVotingWeightProvider address
    /// @return The address of the assetVotingWeightProvider
    function getAssetVotingWeightProvider() external view returns(IAssetVotingWeightProvider) {
        return assetVotingWeightProvider;
    }
}