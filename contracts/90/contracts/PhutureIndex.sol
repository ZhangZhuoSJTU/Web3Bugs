// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "./libraries/AUMCalculationLibrary.sol";

import "./interfaces/IFeePool.sol";
import "./interfaces/INameRegistry.sol";
import "./interfaces/IIndexRegistry.sol";

import "./IndexLayout.sol";

/// @title Phuture index
/// @notice Contains AUM fee's logic, overrides name and symbol
abstract contract PhutureIndex is IndexLayout, ERC20Permit, ERC165 {
    constructor() ERC20Permit("PhutureIndex") ERC20("", "") {}

    /// @notice Index symbol
    /// @return Returns index symbol
    function symbol() public view override returns (string memory) {
        return INameRegistry(registry).symbolOfIndex(address(this));
    }

    /// @notice Index name
    /// @return Returns index name
    function name() public view override returns (string memory) {
        return INameRegistry(registry).nameOfIndex(address(this));
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
        return
            _interfaceId == type(IIndexLayout).interfaceId ||
            _interfaceId == type(IERC20Permit).interfaceId ||
            _interfaceId == type(IERC20).interfaceId ||
            super.supportsInterface(_interfaceId);
    }

    /// @dev Overrides _transfer to include AUM fee logic
    function _transfer(
        address _from,
        address _to,
        uint _value
    ) internal override {
        _chargeAUMFee(IIndexRegistry(registry).feePool());
        super._transfer(_from, _to, _value);
    }

    /// @notice Calculates and mints AUM fee
    /// @param _feePool Fee pool address
    function _chargeAUMFee(address _feePool) internal {
        uint timePassed = block.timestamp - lastTransferTime;
        if (timePassed > 0) {
            uint fee = ((totalSupply() - balanceOf(factory)) *
                (AUMCalculationLibrary.rpow(
                    IFeePool(_feePool).AUMScaledPerSecondsRateOf(address(this)),
                    timePassed,
                    AUMCalculationLibrary.RATE_SCALE_BASE
                ) - AUMCalculationLibrary.RATE_SCALE_BASE)) / AUMCalculationLibrary.RATE_SCALE_BASE;

            if (fee > 0) {
                super._mint(factory, fee);
                lastTransferTime = block.timestamp;
            }
        }
    }
}
