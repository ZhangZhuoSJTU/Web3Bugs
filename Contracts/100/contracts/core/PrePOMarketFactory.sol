// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./LongShortToken.sol";
import "./PrePOMarket.sol";
import "./interfaces/ILongShortToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IPrePOMarketFactory.sol";

contract PrePOMarketFactory is
    IPrePOMarketFactory,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    mapping(address => bool) private _validCollateral;
    mapping(bytes32 => address) private _deployedMarkets;

    function initialize() public initializer {
        OwnableUpgradeable.__Ownable_init();
    }

    function isCollateralValid(address _collateral)
        external
        view
        override
        returns (bool)
    {
        return _validCollateral[_collateral];
    }

    function getMarket(bytes32 _longShortHash)
        external
        view
        override
        returns (IPrePOMarket)
    {
        return IPrePOMarket(_deployedMarkets[_longShortHash]);
    }

    function createMarket(
        string memory _tokenNameSuffix,
        string memory _tokenSymbolSuffix,
        address _governance,
        address _collateral,
        uint256 _floorLongPrice,
        uint256 _ceilingLongPrice,
        uint256 _floorValuation,
        uint256 _ceilingValuation,
        uint256 _mintingFee,
        uint256 _redemptionFee,
        uint256 _expiryTime
    ) external override onlyOwner nonReentrant {
        require(_validCollateral[_collateral], "Invalid collateral");

        (
            LongShortToken _longToken,
            LongShortToken _shortToken
        ) = _createPairTokens(_tokenNameSuffix, _tokenSymbolSuffix);
        bytes32 _salt = keccak256(abi.encodePacked(_longToken, _shortToken));

        PrePOMarket _newMarket = new PrePOMarket{salt: _salt}(
            _governance,
            _collateral,
            ILongShortToken(address(_longToken)),
            ILongShortToken(address(_shortToken)),
            _floorLongPrice,
            _ceilingLongPrice,
            _floorValuation,
            _ceilingValuation,
            _mintingFee,
            _redemptionFee,
            _expiryTime,
            false
        );
        _deployedMarkets[_salt] = address(_newMarket);

        _longToken.transferOwnership(address(_newMarket));
        _shortToken.transferOwnership(address(_newMarket));
        emit MarketAdded(address(_newMarket), _salt);
    }

    function setCollateralValidity(address _collateral, bool _validity)
        external
        override
        onlyOwner
    {
        _validCollateral[_collateral] = _validity;
        emit CollateralValidityChanged(_collateral, _validity);
    }

    function _createPairTokens(
        string memory _tokenNameSuffix,
        string memory _tokenSymbolSuffix
    )
        internal
        returns (LongShortToken _newLongToken, LongShortToken _newShortToken)
    {
        string memory _longTokenName = string(
            abi.encodePacked("LONG", " ", _tokenNameSuffix)
        );
        string memory _shortTokenName = string(
            abi.encodePacked("SHORT", " ", _tokenNameSuffix)
        );
        string memory _longTokenSymbol = string(
            abi.encodePacked("L", "_", _tokenSymbolSuffix)
        );
        string memory _shortTokenSymbol = string(
            abi.encodePacked("S", "_", _tokenSymbolSuffix)
        );
        _newLongToken = new LongShortToken(_longTokenName, _longTokenSymbol);
        _newShortToken = new LongShortToken(
            _shortTokenName,
            _shortTokenSymbol
        );
        return (_newLongToken, _newShortToken);
    }
}
