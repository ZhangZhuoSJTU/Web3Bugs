// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC20} from "solmate/tokens/ERC20.sol";
import {SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solmate/utils/FixedPointMathLib.sol";

import {CERC20} from "../../interfaces/CERC20.sol";

contract MockCToken is CERC20 {
    using SafeTransferLib for ERC20;
    using FixedPointMathLib for uint256;

    /*///////////////////////////////////////////////////////////////
                              CTOKEN LOGIC
    //////////////////////////////////////////////////////////////*/

    ERC20 public underlying;

    mapping(address => uint256) public override borrowBalanceCurrent;

    function mint(uint256 underlyingAmount) external override returns (uint256) {
        underlying.safeTransferFrom(msg.sender, address(this), underlyingAmount);

        _mint(msg.sender, underlyingAmount.divWadDown(exchangeRateStored()));

        return 0;
    }

    function borrow(uint256 underlyingAmount) external override returns (uint256) {
        borrowBalanceCurrent[msg.sender] += underlyingAmount;

        underlying.safeTransfer(msg.sender, underlyingAmount);

        return 0;
    }

    function repayBorrow(uint256 underlyingAmount) external override returns (uint256) {
        borrowBalanceCurrent[msg.sender] -= underlyingAmount;

        underlying.safeTransferFrom(msg.sender, address(this), underlyingAmount);

        return 0;
    }

    function redeemUnderlying(uint256 underlyingAmount) external override returns (uint256) {
        _burn(msg.sender, underlyingAmount.divWadDown(exchangeRateStored()));

        underlying.safeTransfer(msg.sender, underlyingAmount);

        return 0;
    }

    function repayBorrowBehalf(address user, uint256 underlyingAmount) external override returns (uint256) {
        borrowBalanceCurrent[user] -= underlyingAmount;

        underlying.safeTransferFrom(msg.sender, address(this), underlyingAmount);

        return 0;
    }

    function balanceOfUnderlying(address user) external view override returns (uint256) {
        return balanceOf[user].mulWadDown(exchangeRateStored());
    }

    function exchangeRateStored() public view override returns (uint256) {
        return 10**underlying.decimals();
    }

    /*///////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(ERC20 _underlying)
        ERC20(
            string(abi.encodePacked("Compound ", _underlying.name())),
            string(abi.encodePacked("c", _underlying.symbol)),
            _underlying.decimals()
        )
    {
        underlying = _underlying;
    }
}
