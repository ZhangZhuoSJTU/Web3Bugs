// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./../../token/ERC20OwnerMintableToken.sol";
import "../../protocols/aave/ILendingPool.sol";
import "../../protocols/aave/IAToken.sol";
import "./WadRayMath.sol";

/// Yield Bearing Token for AAVE - AToken
contract ATokenMock is ERC20, IAToken {
    using WadRayMath for uint;
    using SafeERC20 for IERC20;

    address public immutable override UNDERLYING_ASSET_ADDRESS;
    ILendingPool public override POOL;
    uint8 private immutable contractDecimals;

    constructor(
        ILendingPool pool,
        address underlyingAssetAddress,
        uint8 _decimals,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        POOL = pool;
        UNDERLYING_ASSET_ADDRESS = underlyingAssetAddress;
        contractDecimals = _decimals;
    }

    function decimals() public view override returns (uint8) {
        return contractDecimals;
    }

    function balanceOf(address account) public view override(ERC20, IERC20) returns (uint256) {
        return ERC20.balanceOf(account).rayMul(POOL.getReserveNormalizedIncome(address(UNDERLYING_ASSET_ADDRESS)));
    }

    /// @param account Recipient address to mint tokens to
    /// @param amount Number of tokens to mint
    function mint(address account, uint256 amount) public {
        require(msg.sender == address(POOL), "mint: only manager can mint");
        _mint(account, amount);
    }

    /// @dev Burns aTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
    /// @param user The owner of the aTokens, getting them burned
    /// @param receiverOfUnderlying The address that will receive the underlying
    /// @param amount The amount being burned
    /// @param index The new liquidity index of the reserve
    function burn(
        address user,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) public {
        require(msg.sender == address(POOL), "caller must be lending pool");

        uint256 amountScaled = amount.rayDiv(index);
        require(amountScaled != 0, "invalid burn amount");
        _burn(user, amountScaled);

        IERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(receiverOfUnderlying, amount);
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        ERC20._transfer(from, to, amount.rayDiv(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS)));
    }
}
