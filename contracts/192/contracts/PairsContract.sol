//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPairsContract.sol";
import "./interfaces/IPosition.sol";

contract PairsContract is Ownable, IPairsContract {

    address public protocol;

    mapping(uint256 => bool) public allowedAsset;

    uint256 private maxBaseFundingRate = 1e10;

    mapping(uint256 => Asset) private _idToAsset;
    function idToAsset(uint256 _asset) public view returns (Asset memory) {
        return _idToAsset[_asset];
    }

    mapping(uint256 => mapping(address => OpenInterest)) private _idToOi;
    function idToOi(uint256 _asset, address _tigAsset) public view returns (OpenInterest memory) {
        return _idToOi[_asset][_tigAsset];
    }

    // OWNER

    /**
     * @dev Update the Chainlink price feed of an asset
     * @param _asset index of the requested asset
     * @param _feed contract address of the Chainlink price feed
     */
    function setAssetChainlinkFeed(uint256 _asset, address _feed) external onlyOwner {
        bytes memory _name  = bytes(_idToAsset[_asset].name);
        require(_name.length > 0, "!Asset");
        _idToAsset[_asset].chainlinkFeed = _feed;
    }

    /**
     * @dev Add an allowed asset to fetch prices for
     * @param _asset index of the requested asset
     * @param _name name of the asset
     * @param _chainlinkFeed optional address of the respective Chainlink price feed
     * @param _maxLeverage maximimum allowed leverage
     * @param _maxLeverage minimum allowed leverage
     * @param _feeMultiplier percent value that the opening/closing fee is multiplied by in BP
     */
    function addAsset(uint256 _asset, string memory _name, address _chainlinkFeed, uint256 _minLeverage, uint256 _maxLeverage, uint256 _feeMultiplier, uint256 _baseFundingRate) external onlyOwner {
        bytes memory _assetName  = bytes(_idToAsset[_asset].name);
        require(_assetName.length == 0, "Already exists");
        require(bytes(_name).length > 0, "No name");
        require(_maxLeverage >= _minLeverage && _minLeverage > 0, "Wrong leverage values");

        allowedAsset[_asset] = true;
        _idToAsset[_asset].name = _name;

        _idToAsset[_asset].chainlinkFeed = _chainlinkFeed;

        _idToAsset[_asset].minLeverage = _minLeverage;
        _idToAsset[_asset].maxLeverage = _maxLeverage;
        _idToAsset[_asset].feeMultiplier = _feeMultiplier;
        _idToAsset[_asset].baseFundingRate = _baseFundingRate;

        emit AssetAdded(_asset, _name);
    }

    /**
     * @dev Update the leverage allowed per asset
     * @param _asset index of the asset
     * @param _minLeverage minimum leverage allowed
     * @param _maxLeverage Maximum leverage allowed
     */
    function updateAssetLeverage(uint256 _asset, uint256 _minLeverage, uint256 _maxLeverage) external onlyOwner {
        bytes memory _name  = bytes(_idToAsset[_asset].name);
        require(_name.length > 0, "!Asset");

        if (_maxLeverage > 0) {
            _idToAsset[_asset].maxLeverage = _maxLeverage;
        }
        if (_minLeverage > 0) {
            _idToAsset[_asset].minLeverage = _minLeverage;
        }
        
        require(_idToAsset[_asset].maxLeverage >= _idToAsset[_asset].minLeverage, "Wrong leverage values");
    }

    /**
     * @notice update the base rate for funding fees per asset
     * @param _asset index of the asset
     * @param _baseFundingRate the rate to set
     */
    function setAssetBaseFundingRate(uint256 _asset, uint256 _baseFundingRate) external onlyOwner {
        bytes memory _name  = bytes(_idToAsset[_asset].name);
        require(_name.length > 0, "!Asset");
        require(_baseFundingRate <= maxBaseFundingRate, "baseFundingRate too high");
        _idToAsset[_asset].baseFundingRate = _baseFundingRate;
    }

    /**
     * @notice update the fee multiplier per asset
     * @param _asset index of the asset
     * @param _feeMultiplier the fee multiplier
     */
    function updateAssetFeeMultiplier(uint256 _asset, uint256 _feeMultiplier) external onlyOwner {
        bytes memory _name  = bytes(_idToAsset[_asset].name);
        require(_name.length > 0, "!Asset");
        _idToAsset[_asset].feeMultiplier = _feeMultiplier;
    }

     /**
     * @notice pause an asset from being traded
     * @param _asset index of the asset
     * @param _isPaused paused if true
     */
    function pauseAsset(uint256 _asset, bool _isPaused) external onlyOwner {
        bytes memory _name  = bytes(_idToAsset[_asset].name);
        require(_name.length > 0, "!Asset");
        allowedAsset[_asset] = !_isPaused;
    }

    /**
     * @notice sets the max rate for funding fees
     * @param _maxBaseFundingRate max base funding rate
     */
    function setMaxBaseFundingRate(uint256 _maxBaseFundingRate) external onlyOwner {
        maxBaseFundingRate = _maxBaseFundingRate;
    }

    function setProtocol(address _protocol) external onlyOwner {
        protocol = _protocol;
    }

    /**
     * @dev Update max open interest limits
     * @param _asset index of the asset
     * @param _tigAsset contract address of the tigAsset
     * @param _maxOi Maximum open interest value per side
     */
    function setMaxOi(uint256 _asset, address _tigAsset, uint256 _maxOi) external onlyOwner {
        bytes memory _name  = bytes(_idToAsset[_asset].name);
        require(_name.length > 0, "!Asset");
        _idToOi[_asset][_tigAsset].maxOi = _maxOi;
    }

    // Protocol-only

    /**
     * @dev edits the current open interest for long
     * @param _asset index of the asset
     * @param _tigAsset contract address of the tigAsset
     * @param _onOpen true if adding to open interesr
     * @param _amount amount to be added/removed from open interest
     */
    function modifyLongOi(uint256 _asset, address _tigAsset, bool _onOpen, uint256 _amount) external onlyProtocol {
        if (_onOpen) {
            _idToOi[_asset][_tigAsset].longOi += _amount;
            require(_idToOi[_asset][_tigAsset].longOi <= _idToOi[_asset][_tigAsset].maxOi || _idToOi[_asset][_tigAsset].maxOi == 0, "MaxLongOi");
        }
        else {
            _idToOi[_asset][_tigAsset].longOi -= _amount;
            if (_idToOi[_asset][_tigAsset].longOi < 1e9) {
                _idToOi[_asset][_tigAsset].longOi = 0;
            }
        }
    }

     /**
     * @dev edits the current open interest for short
     * @param _asset index of the asset
     * @param _tigAsset contract address of the tigAsset
     * @param _onOpen true if adding to open interesr
     * @param _amount amount to be added/removed from open interest
     */
    function modifyShortOi(uint256 _asset, address _tigAsset, bool _onOpen, uint256 _amount) external onlyProtocol {
        if (_onOpen) {
            _idToOi[_asset][_tigAsset].shortOi += _amount;
            require(_idToOi[_asset][_tigAsset].shortOi <= _idToOi[_asset][_tigAsset].maxOi || _idToOi[_asset][_tigAsset].maxOi == 0, "MaxShortOi");
            }
        else {
            _idToOi[_asset][_tigAsset].shortOi -= _amount;
            if (_idToOi[_asset][_tigAsset].shortOi < 1e9) {
                _idToOi[_asset][_tigAsset].shortOi = 0;
            }
        }
    }

    // Modifiers

    modifier onlyProtocol() {
        require(_msgSender() == address(protocol), "!Protocol");
        _;
    }

    // EVENTS

    event AssetAdded(
        uint _asset,
        string _name
    );

}