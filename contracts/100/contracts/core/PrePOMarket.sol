// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./interfaces/ILongShortToken.sol";
import "./interfaces/IPrePOMarket.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PrePOMarket is IPrePOMarket, Ownable, ReentrancyGuard {
    address private _treasury;

    IERC20 private immutable _collateral;
    ILongShortToken private immutable _longToken;
    ILongShortToken private immutable _shortToken;

    uint256 private immutable _floorLongPrice;
    uint256 private immutable _ceilingLongPrice;
    uint256 private _finalLongPrice;

    uint256 private immutable _floorValuation;
    uint256 private immutable _ceilingValuation;

    uint256 private _mintingFee;
    uint256 private _redemptionFee;

    uint256 private immutable _expiryTime;

    bool private _publicMinting;

    uint256 private constant MAX_PRICE = 1e18;
    uint256 private constant FEE_DENOMINATOR = 1000000;
    uint256 private constant FEE_LIMIT = 50000;

    /**
     * Assumes `_newCollateral`, `_newLongToken`, and `_newShortToken` are
     * valid, since they will be handled by the PrePOMarketFactory. The
     * treasury is initialized to governance due to stack limitations.
     *
     * Assumes that ownership of `_longToken` and `_shortToken` has been
     * transferred to this contract via `createMarket()` in
     * `PrePOMarketFactory.sol`.
     */
    constructor(
        address _governance,
        address _newCollateral,
        ILongShortToken _newLongToken,
        ILongShortToken _newShortToken,
        uint256 _newFloorLongPrice,
        uint256 _newCeilingLongPrice,
        uint256 _newFloorValuation,
        uint256 _newCeilingValuation,
        uint256 _newMintingFee,
        uint256 _newRedemptionFee,
        uint256 _newExpiryTime,
        bool _allowed
    ) {
        require(
            _newCeilingLongPrice > _newFloorLongPrice,
            "Ceiling must exceed floor"
        );
        require(_newExpiryTime > block.timestamp, "Invalid expiry");
        require(_newMintingFee <= FEE_LIMIT, "Exceeds fee limit");
        require(_newRedemptionFee <= FEE_LIMIT, "Exceeds fee limit");
        require(_newCeilingLongPrice <= MAX_PRICE, "Ceiling cannot exceed 1");

        transferOwnership(_governance);
        _treasury = _governance;

        _collateral = IERC20(_newCollateral);
        _longToken = _newLongToken;
        _shortToken = _newShortToken;

        _floorLongPrice = _newFloorLongPrice;
        _ceilingLongPrice = _newCeilingLongPrice;
        _finalLongPrice = MAX_PRICE + 1;

        _floorValuation = _newFloorValuation;
        _ceilingValuation = _newCeilingValuation;

        _mintingFee = _newMintingFee;
        _redemptionFee = _newRedemptionFee;

        _expiryTime = _newExpiryTime;

        _publicMinting = _allowed;

        emit MarketCreated(
            address(_newLongToken),
            address(_newShortToken),
            _newFloorLongPrice,
            _newCeilingLongPrice,
            _newFloorValuation,
            _newCeilingValuation,
            _newMintingFee,
            _newRedemptionFee,
            _newExpiryTime
        );
    }

    function mintLongShortTokens(uint256 _amount)
        external
        override
        nonReentrant
        returns (uint256)
    {
        if (msg.sender != owner()) {
            require(_publicMinting, "Public minting disabled");
        }
        require(_finalLongPrice > MAX_PRICE, "Market ended");
        require(
            _collateral.balanceOf(msg.sender) >= _amount,
            "Insufficient collateral"
        );
        /**
         * Add 1 to avoid rounding to zero, only process if user is minting
         * an amount large enough to pay a fee
         */
        uint256 _fee = (_amount * _mintingFee) / FEE_DENOMINATOR + 1;
        require(_amount > _fee, "Minting amount too small");
        _collateral.transferFrom(msg.sender, _treasury, _fee);
        _amount -= _fee;
        _collateral.transferFrom(msg.sender, address(this), _amount);
        _longToken.mint(msg.sender, _amount);
        _shortToken.mint(msg.sender, _amount);
        emit Mint(msg.sender, _amount);
        return _amount;
    }

    function redeem(uint256 _longAmount, uint256 _shortAmount)
        external
        override
        nonReentrant
    {
        require(
            _longToken.balanceOf(msg.sender) >= _longAmount,
            "Insufficient long tokens"
        );
        require(
            _shortToken.balanceOf(msg.sender) >= _shortAmount,
            "Insufficient short tokens"
        );

        uint256 _collateralOwed;
        if (_finalLongPrice <= MAX_PRICE) {
            uint256 _shortPrice = MAX_PRICE - _finalLongPrice;
            _collateralOwed =
                (_finalLongPrice * _longAmount + _shortPrice * _shortAmount) /
                MAX_PRICE;
        } else {
            require(
                _longAmount == _shortAmount,
                "Long and Short must be equal"
            );
            _collateralOwed = _longAmount;
        }

        _longToken.burnFrom(msg.sender, _longAmount);
        _shortToken.burnFrom(msg.sender, _shortAmount);
        /**
         * Add 1 to avoid rounding to zero, only process if user is redeeming
         * an amount large enough to pay a fee
         */
        uint256 _fee = (_collateralOwed * _redemptionFee) /
            FEE_DENOMINATOR +
            1;
        require(_collateralOwed > _fee, "Redemption amount too small");
        _collateral.transfer(_treasury, _fee);
        _collateralOwed -= _fee;
        _collateral.transfer(msg.sender, _collateralOwed);

        emit Redemption(msg.sender, _collateralOwed);
    }

    function setTreasury(address _newTreasury) external override onlyOwner {
        _treasury = _newTreasury;
        emit TreasuryChanged(_newTreasury);
    }

    function setFinalLongPrice(uint256 _newFinalLongPrice)
        external
        override
        onlyOwner
    {
        require(
            _newFinalLongPrice >= _floorLongPrice,
            "Price cannot be below floor"
        );
        require(
            _newFinalLongPrice <= _ceilingLongPrice,
            "Price cannot exceed ceiling"
        );
        _finalLongPrice = _newFinalLongPrice;
        emit FinalLongPriceSet(_newFinalLongPrice);
    }

    function setMintingFee(uint256 _newMintingFee)
        external
        override
        onlyOwner
    {
        require(_newMintingFee <= FEE_LIMIT, "Exceeds fee limit");
        _mintingFee = _newMintingFee;
        emit MintingFeeChanged(_newMintingFee);
    }

    function setRedemptionFee(uint256 _newRedemptionFee)
        external
        override
        onlyOwner
    {
        require(_newRedemptionFee <= FEE_LIMIT, "Exceeds fee limit");
        _redemptionFee = _newRedemptionFee;
        emit RedemptionFeeChanged(_newRedemptionFee);
    }

    function setPublicMinting(bool _allowed) external override onlyOwner {
        _publicMinting = _allowed;
        emit PublicMintingChanged(_allowed);
    }

    function getTreasury() external view override returns (address) {
        return _treasury;
    }

    function getCollateral() external view override returns (IERC20) {
        return _collateral;
    }

    function getLongToken() external view override returns (ILongShortToken) {
        return _longToken;
    }

    function getShortToken() external view override returns (ILongShortToken) {
        return _shortToken;
    }

    function getFloorLongPrice() external view override returns (uint256) {
        return _floorLongPrice;
    }

    function getCeilingLongPrice() external view override returns (uint256) {
        return _ceilingLongPrice;
    }

    function getFinalLongPrice() external view override returns (uint256) {
        return _finalLongPrice;
    }

    function getFloorValuation() external view override returns (uint256) {
        return _floorValuation;
    }

    function getCeilingValuation() external view override returns (uint256) {
        return _ceilingValuation;
    }

    function getMintingFee() external view override returns (uint256) {
        return _mintingFee;
    }

    function getRedemptionFee() external view override returns (uint256) {
        return _redemptionFee;
    }

    function getExpiryTime() external view override returns (uint256) {
        return _expiryTime;
    }

    function isPublicMintingAllowed() external view override returns (bool) {
        return _publicMinting;
    }

    function getMaxPrice() external pure override returns (uint256) {
        return MAX_PRICE;
    }

    function getFeeDenominator() external pure override returns (uint256) {
        return FEE_DENOMINATOR;
    }

    function getFeeLimit() external pure override returns (uint256) {
        return FEE_LIMIT;
    }
}
