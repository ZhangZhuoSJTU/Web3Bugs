// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/access/IAccessControl.sol";

import "./libraries/BP.sol";
import "./libraries/IndexLibrary.sol";

import "./interfaces/IvToken.sol";
import "./interfaces/IOrderer.sol";
import "./interfaces/IIndexLogic.sol";
import "./interfaces/IvTokenFactory.sol";
import "./interfaces/IPhuturePriceOracle.sol";

import "./PhutureIndex.sol";

/// @title Index logic
/// @notice Contains common logic for index minting and burning
contract IndexLogic is PhutureIndex, IIndexLogic {
    using FullMath for uint;
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Asset role
    bytes32 internal constant ASSET_ROLE = keccak256("ASSET_ROLE");
    /// @notice Role granted for asset which should be skipped during burning
    bytes32 internal constant SKIPPED_ASSET_ROLE = keccak256("SKIPPED_ASSET_ROLE");

    /// @notice Mints index to `_recipient` address
    /// @param _recipient Recipient address
    function mint(address _recipient) external override {
        address feePool = IIndexRegistry(registry).feePool();
        _chargeAUMFee(feePool);

        IPhuturePriceOracle oracle = IPhuturePriceOracle(IIndexRegistry(registry).priceOracle());

        uint lastAssetBalanceInBase;
        uint minAmountInBase = type(uint).max;
        for (uint i; i < assets.length(); ++i) {
            require(IAccessControl(registry).hasRole(ASSET_ROLE, assets.at(i)), "Index: INVALID_ASSET");
            if (weightOf[assets.at(i)] == 0) {
                continue;
            }
            uint assetPerBaseInUQ = oracle.refreshedAssetPerBaseInUQ(assets.at(i));
            // Q_b * w_i * p_i = Q_i
            // Q_b = Q_i / (w_i * p_i)
            IvToken vToken = IvToken(IvTokenFactory(vTokenFactory).createOrReturnVTokenOf(assets.at(i)));
            uint amountInAsset = IERC20(assets.at(i)).balanceOf(address(vToken)) - vToken.lastBalance();
            uint weightedPrice = assetPerBaseInUQ * weightOf[assets.at(i)];
            uint _minAmountInBase = amountInAsset.mulDiv(FixedPoint112.Q112 * IndexLibrary.MAX_WEIGHT, weightedPrice);
            if (_minAmountInBase < minAmountInBase) {
                minAmountInBase = _minAmountInBase;
            }
            uint lastBalanceInAsset = vToken.lastAssetBalanceOf(address(this));
            vToken.mint();
            uint balanceInBase = lastBalanceInAsset.mulDiv(FixedPoint112.Q112, assetPerBaseInUQ);
            lastAssetBalanceInBase += balanceInBase;
        }

        for (uint i; i < inactiveAssets.length(); ++i) {
            if (!IAccessControl(registry).hasRole(SKIPPED_ASSET_ROLE, inactiveAssets.at(i))) {
                uint lastBalanceInAsset = IvToken(
                    IvTokenFactory(vTokenFactory).createOrReturnVTokenOf(inactiveAssets.at(i))
                ).lastAssetBalanceOf(address(this));
                lastAssetBalanceInBase += lastBalanceInAsset.mulDiv(
                    FixedPoint112.Q112,
                    oracle.refreshedAssetPerBaseInUQ(inactiveAssets.at(i))
                );
            }
        }

        assert(minAmountInBase != type(uint).max);

        uint value;
        if (totalSupply() != 0) {
            require(lastAssetBalanceInBase > 0, "Index: INSUFFICIENT_AMOUNT");
            value =
                (oracle.convertToIndex(minAmountInBase, decimals()) * totalSupply()) /
                oracle.convertToIndex(lastAssetBalanceInBase, decimals());
        } else {
            value = oracle.convertToIndex(minAmountInBase, decimals()) - IndexLibrary.INITIAL_QUANTITY;
            _mint(address(0xdead), IndexLibrary.INITIAL_QUANTITY);
        }

        uint fee = (value * IFeePool(feePool).mintingFeeInBPOf(address(this))) / BP.DECIMAL_FACTOR;
        if (fee > 0) {
            _mint(feePool, fee);
            value -= fee;
        }

        _mint(_recipient, value);
    }

    /// @notice Burns index and transfers assets to `_recipient` address
    /// @param _recipient Recipient address
    function burn(address _recipient) external override {
        uint value = balanceOf(address(this));
        require(value > 0, "Index: INSUFFICIENT_AMOUNT");
        uint length = assets.length();

        bool containsBlacklistedAssets;
        for (uint i; i < length; ++i) {
            if (!IAccessControl(registry).hasRole(ASSET_ROLE, assets.at(i))) {
                containsBlacklistedAssets = true;
                break;
            }
        }

        if (!containsBlacklistedAssets) {
            address feePool = IIndexRegistry(registry).feePool();

            uint fee = (value * IFeePool(feePool).burningFeeInBPOf(address(this))) / BP.DECIMAL_FACTOR;

            if (fee > 0) {
                // AUM charged in _transfer method
                _transfer(address(this), feePool, fee);
                value -= fee;
            } else {
                _chargeAUMFee(feePool);
            }
        }

        address orderer = IIndexRegistry(registry).orderer();
        uint lastOrderId = IOrderer(orderer).lastOrderIdOf(address(this));
        for (uint i; i < length + inactiveAssets.length(); ++i) {
            address asset = i < length ? assets.at(i) : inactiveAssets.at(i - length);
            if (containsBlacklistedAssets && IAccessControl(registry).hasRole(SKIPPED_ASSET_ROLE, asset)) {
                continue;
            }

            IvToken vToken = IvToken(IvTokenFactory(vTokenFactory).vTokenOf(asset));
            uint indexAssetBalance = vToken.balanceOf(address(this));
            uint accountBalance = (value * indexAssetBalance) / totalSupply();
            if (accountBalance == 0) {
                continue;
            }

            // calculate index value in vault to be burned
            vToken.transfer(address(vToken), accountBalance);
            vToken.burn(_recipient);
            if (lastOrderId > 0) {
                IOrderer(orderer).reduceOrderAsset(asset, totalSupply() - value, totalSupply());
            }
        }

        _burn(address(this), value);
    }
}
