pragma solidity ^0.5.16;

import "@openzeppelin/contracts/ownership/Ownable.sol";

import "../interfaces/IAssetVotingWeightProvider.sol";

/// @title AssetVotingWeightProvider
/// @notice Smart contract to register whitelisted assets with its voting weight per asset
///  - The ownership is on the AaveProtoGovernance, that way the whitelisting of new assets or
///    the change of the weight of a current one will be done through governance.
contract AssetVotingWeightProvider is Ownable, IAssetVotingWeightProvider {

    event AssetWeightSet(IERC20 indexed asset, address indexed setter, uint256 weight);

    mapping(address => uint256) private votingWeights;

    /// @notice Constructor
    /// @param _assets Dynamic array of asset addresses
    /// @param _weights Dynamic array of asset weights, for each one of _assets
    constructor(IERC20[] memory _assets, uint256[] memory _weights) public {
        require(_assets.length == _weights.length, "INCONSISTENT_ASSETS_WEIGHTS_LENGTHS");
        for (uint256 i = 0; i < _assets.length; i++) {
            internalSetVotingWeight(_assets[i], _weights[i]);
        }
    }

    /// @notice Gets the weight of an asset
    /// @param _asset The asset smart contract address
    /// @return The uint256 weight of the asset
    function getVotingWeight(IERC20 _asset) public view returns(uint256) {
        address asset = address(_asset);
        return votingWeights[asset];
    }

    /// @notice Sets the weight for an asset
    /// @param _asset The asset smart contract address
    /// @param _weight The asset smart contract address
    /// @return The uint256 weight of the asset
    function setVotingWeight(IERC20 _asset, uint256 _weight) external onlyOwner {
        internalSetVotingWeight(_asset, _weight);
    }

    /// @notice Internal function to set the weight for an asset
    /// @param _asset The asset smart contract address
    /// @return The uint256 weight of the asset
    function internalSetVotingWeight(IERC20 _asset, uint256 _weight) internal {
        address asset = address(_asset);
        votingWeights[asset] = _weight;
        emit AssetWeightSet(_asset, msg.sender, _weight);
    }

}