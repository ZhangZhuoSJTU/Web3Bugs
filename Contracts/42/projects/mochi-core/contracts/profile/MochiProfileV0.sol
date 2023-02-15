// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "../interfaces/IMochiProfile.sol";
import "../interfaces/IMochiEngine.sol";

///@notice this is where policies including some math is registered will be able to swap the profile when current profile is not suitable
///@dev this profile is built with https://docs.google.com/spreadsheets/d/1T2WKpwj5QmueR7O8R9AXNbnHLc-rJ_-8DLdRI2eJZqA
contract MochiProfileV0 is IMochiProfile {
    using Float for float;
    using Float for uint256;
    IMochiEngine public immutable engine;

    uint256 public override liquidityRequirement;

    uint256 public override minimumDebt;

    mapping(address => AssetClass) internal _assetClass;

    mapping(address => uint256) public override creditCap;

    uint256 public immutable secPerYear;

    uint256 public override delay;

    constructor(address _engine) {
        secPerYear = 31536000;
        engine = IMochiEngine(_engine);

        liquidityRequirement = 1000000e18; // 1million dollar
        minimumDebt = 1000e18;
        delay = 3 minutes;
    }

    modifier onlyGov() {
        require(msg.sender == engine.governance(), "!gov");
        _;
    }

    function assetClass(address _asset)
        public
        view
        override
        returns (AssetClass)
    {
        return _assetClass[_asset];
    }

    function changeLiquidityRequirement(uint256 _requirement)
        external
        override
        onlyGov
    {
        liquidityRequirement = _requirement;
    }

    function registerAsset(address _asset) external {
        uint256 liq = engine.cssr().getLiquidity(_asset);
        require(liq >= liquidityRequirement, "<liquidity");
        _register(_asset, AssetClass.Sigma);
    }

    function registerAssetByGov(
        address[] calldata _asset,
        AssetClass[] calldata _classes
    ) external onlyGov {
        for (uint256 i = 0; i < _asset.length; i++) {
            _register(_asset[i], _classes[i]);
            engine.vaultFactory().deployVault(_asset[i]);
        }
    }

    function _register(address _asset, AssetClass _class) internal {
        _assetClass[_asset] = _class;
    }

    function changeMinimumDebt(uint256 _debt) external override onlyGov {
        minimumDebt = _debt;
    }

    function changeAssetClass(
        address[] calldata _assets,
        AssetClass[] calldata _classes
    ) external override onlyGov {
        for (uint256 i = 0; i < _assets.length; i++) {
            _assetClass[_assets[i]] = _classes[i];
        }
    }

    function changeCreditCap(
        address[] calldata _assets,
        uint256[] calldata _caps
    ) external onlyGov {
        for (uint256 i = 0; i < _assets.length; i++) {
            creditCap[_assets[i]] = _caps[i];
        }
    }

    function setDelay(uint256 _delay) external onlyGov {
        delay = _delay;
    }

    ///@notice The Collateral Factor at which the users vault will be liquidated
    function liquidationFactor(address _asset)
        public
        view
        override
        returns (float memory)
    {
        AssetClass class = assetClass(_asset);
        if (class == AssetClass.Stable) {
            return float({numerator: 95, denominator: 100});
        } else if (class == AssetClass.Alpha) {
            return float({numerator: 85, denominator: 100});
        } else if (class == AssetClass.Gamma) {
            return float({numerator: 80, denominator: 100});
        } else if (class == AssetClass.Delta) {
            return float({numerator: 75, denominator: 100});
        } else if (class == AssetClass.Zeta) {
            return float({numerator: 65, denominator: 100});
        } else if (class == AssetClass.Sigma) {
            return float({numerator: 40, denominator: 100});
        } else {
            revert("invalid");
        }
    }

    function riskFactor(address _asset) public view returns (uint256) {
        AssetClass class = assetClass(_asset);
        if (class == AssetClass.Stable) {
            return 1;
        } else if (class == AssetClass.Alpha) {
            return 2;
        } else if (class == AssetClass.Gamma) {
            return 3;
        } else if (class == AssetClass.Delta) {
            return 4;
        } else if (class == AssetClass.Zeta) {
            return 5;
        } else if (class == AssetClass.Sigma) {
            return 6;
        } else {
            revert("invalid");
        }
    }

    function maxCollateralFactor(address _asset)
        public
        view
        override
        returns (float memory)
    {
        AssetClass class = assetClass(_asset);
        if (class == AssetClass.Stable) {
            return float({numerator: 90, denominator: 100});
        } else if (class == AssetClass.Alpha) {
            return float({numerator: 80, denominator: 100});
        } else if (class == AssetClass.Gamma) {
            return float({numerator: 75, denominator: 100});
        } else if (class == AssetClass.Delta) {
            return float({numerator: 65, denominator: 100});
        } else if (class == AssetClass.Zeta) {
            return float({numerator: 55, denominator: 100});
        } else if (class == AssetClass.Sigma) {
            return float({numerator: 45, denominator: 100});
        } else {
            revert("invalid");
        }
    }

    function baseFee() public pure returns (float memory) {
        return float({numerator: 5, denominator: 1000});
    }

    function liquidationFee(address _asset)
        public
        view
        override
        returns (float memory)
    {
        AssetClass class = assetClass(_asset);
        if (class == AssetClass.Stable) {
            return float({numerator: 45, denominator: 1000});
        } else if (class == AssetClass.Alpha) {
            return float({numerator: 100, denominator: 1000});
        } else if (class == AssetClass.Gamma) {
            return float({numerator: 125, denominator: 1000});
        } else if (class == AssetClass.Delta) {
            return float({numerator: 150, denominator: 1000});
        } else if (class == AssetClass.Zeta) {
            return float({numerator: 175, denominator: 1000});
        } else if (class == AssetClass.Sigma) {
            return float({numerator: 200, denominator: 1000});
        } else {
            revert("invalid");
        }
    }

    function keeperFee(address _asset)
        public
        view
        override
        returns (float memory)
    {
        AssetClass class = assetClass(_asset);
        if (class == AssetClass.Stable) {
            return float({numerator: 5, denominator: 1000});
        } else if (class == AssetClass.Alpha) {
            return float({numerator: 10, denominator: 1000});
        } else if (class == AssetClass.Gamma) {
            return float({numerator: 15, denominator: 1000});
        } else if (class == AssetClass.Delta) {
            return float({numerator: 20, denominator: 1000});
        } else if (class == AssetClass.Zeta) {
            return float({numerator: 25, denominator: 1000});
        } else if (class == AssetClass.Sigma) {
            return float({numerator: 30, denominator: 1000});
        } else {
            revert("invalid");
        }
    }

    function maxFee(AssetClass _class) public pure returns (float memory) {
        if (_class == AssetClass.Stable) {
            return float({numerator: 10, denominator: 1000});
        } else if (_class == AssetClass.Alpha) {
            return float({numerator: 15, denominator: 1000});
        } else if (_class == AssetClass.Gamma) {
            return float({numerator: 20, denominator: 1000});
        } else if (_class == AssetClass.Delta) {
            return float({numerator: 21, denominator: 1000});
        } else if (_class == AssetClass.Zeta) {
            return float({numerator: 22, denominator: 1000});
        } else if (_class == AssetClass.Sigma) {
            return float({numerator: 23, denominator: 1000});
        } else {
            revert("invalid");
        }
    }

    function stabilityFee(address _asset)
        public
        view
        override
        returns (float memory)
    {
        float memory base = baseFee();
        AssetClass class = assetClass(_asset);
        float memory max = maxFee(class);
        float memory u = utilizationRatio(_asset);
        if (u.gt(float({numerator: 1, denominator: 1}))) {
            return max;
        }
        return base.add(max.sub(base).mul(u));
    }

    function calculateFeeIndex(
        address _asset,
        uint256 _currentIndex,
        uint256 _lastAccrued
    ) external view override returns (uint256) {
        float memory feePerYear = stabilityFee(_asset);
        uint256 timePassed = block.timestamp - _lastAccrued;
        float memory feeAccumulated = feePerYear.mul(
            float({numerator: timePassed, denominator: secPerYear})
        );
        return _currentIndex + _currentIndex.multiply(feeAccumulated);
    }

    ///@dev returns utilization ratio scaled with 1e18
    function utilizationRatio(address _asset)
        public
        view
        override
        returns (float memory ratio)
    {
        IMochiVault vault = engine.vaultFactory().getVault(_asset);
        uint256 debts = vault.debts();
        uint256 cap = creditCap[_asset];
        return float({numerator: debts, denominator: cap});
    }
}
