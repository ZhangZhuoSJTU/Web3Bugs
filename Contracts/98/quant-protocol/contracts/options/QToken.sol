// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../pricing/PriceRegistry.sol";
import "../interfaces/IQuantConfig.sol";
import "../interfaces/IQToken.sol";
import "../libraries/ProtocolValue.sol";
import "../libraries/OptionsUtils.sol";
import "../libraries/QuantMath.sol";
import "./QTokenStringUtils.sol";

/// @title Token that represents a user's long position
/// @author Rolla
/// @notice Can be used by owners to exercise their options
/// @dev Every option long position is an ERC20 token: https://eips.ethereum.org/EIPS/eip-20
contract QToken is ERC20Permit, QTokenStringUtils, IQToken {
    using QuantMath for uint256;

    /// @inheritdoc IQToken
    IQuantConfig public override quantConfig;

    /// @inheritdoc IQToken
    address public override underlyingAsset;

    /// @inheritdoc IQToken
    address public override strikeAsset;

    /// @inheritdoc IQToken
    address public override oracle;

    /// @inheritdoc IQToken
    uint256 public override strikePrice;

    /// @inheritdoc IQToken
    uint256 public override expiryTime;

    /// @inheritdoc IQToken
    bool public override isCall;

    /// @notice Configures the parameters of a new option token
    /// @param _quantConfig the address of the Quant system configuration contract
    /// @param _underlyingAsset asset that the option references
    /// @param _strikeAsset asset that the strike is denominated in
    /// @param _oracle price oracle for the underlying
    /// @param _strikePrice strike price with as many decimals in the strike asset
    /// @param _expiryTime expiration timestamp as a unix timestamp
    /// @param _isCall true if it's a call option, false if it's a put option
    constructor(
        address _quantConfig,
        address _underlyingAsset,
        address _strikeAsset,
        address _oracle,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    )
        ERC20(
            _qTokenName(
                _quantConfig,
                _underlyingAsset,
                _strikeAsset,
                _strikePrice,
                _expiryTime,
                _isCall
            ),
            _qTokenSymbol(
                _quantConfig,
                _underlyingAsset,
                _strikeAsset,
                _strikePrice,
                _expiryTime,
                _isCall
            )
        )
        ERC20Permit(
            _qTokenName(
                _quantConfig,
                _underlyingAsset,
                _strikeAsset,
                _strikePrice,
                _expiryTime,
                _isCall
            )
        )
    {
        require(
            _quantConfig != address(0),
            "QToken: invalid QuantConfig address"
        );
        require(
            _underlyingAsset != address(0),
            "QToken: invalid underlying asset address"
        );
        require(
            _strikeAsset != address(0),
            "QToken: invalid strike asset address"
        );
        require(_oracle != address(0), "QToken: invalid oracle address");

        quantConfig = IQuantConfig(_quantConfig);
        underlyingAsset = _underlyingAsset;
        strikeAsset = _strikeAsset;
        oracle = _oracle;
        strikePrice = _strikePrice;
        expiryTime = _expiryTime;
        isCall = _isCall;
    }

    /// @inheritdoc IQToken
    function mint(address account, uint256 amount) external override {
        require(
            quantConfig.hasRole(
                quantConfig.quantRoles("OPTIONS_MINTER_ROLE"),
                msg.sender
            ),
            "QToken: Only an options minter can mint QTokens"
        );
        _mint(account, amount);
        emit QTokenMinted(account, amount);
    }

    /// @inheritdoc IQToken
    function burn(address account, uint256 amount) external override {
        require(
            quantConfig.hasRole(
                quantConfig.quantRoles("OPTIONS_BURNER_ROLE"),
                msg.sender
            ),
            "QToken: Only an options burner can burn QTokens"
        );
        _burn(account, amount);
        emit QTokenBurned(account, amount);
    }

    /// @inheritdoc IQToken
    function getOptionPriceStatus()
        external
        view
        override
        returns (PriceStatus)
    {
        if (block.timestamp > expiryTime) {
            PriceRegistry priceRegistry = PriceRegistry(
                quantConfig.protocolAddresses(
                    ProtocolValue.encode("priceRegistry")
                )
            );

            if (
                priceRegistry.hasSettlementPrice(
                    oracle,
                    underlyingAsset,
                    expiryTime
                )
            ) {
                return PriceStatus.SETTLED;
            }
            return PriceStatus.AWAITING_SETTLEMENT_PRICE;
        } else {
            return PriceStatus.ACTIVE;
        }
    }

    /// @inheritdoc IQToken
    function getQTokenInfo()
        external
        view
        override
        returns (QTokenInfo memory)
    {
        return OptionsUtils.getQTokenInfo(address(this));
    }
}
