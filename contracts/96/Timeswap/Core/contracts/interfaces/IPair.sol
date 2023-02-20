// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IFactory} from './IFactory.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IPair {
    /* ===== STRUCT ===== */

    struct Tokens {
        uint128 asset;
        uint128 collateral;
    }

    struct Claims {
        uint112 bondPrincipal;
        uint112 bondInterest;
        uint112 insurancePrincipal;
        uint112 insuranceInterest;
    }

    struct Due {
        uint112 debt;
        uint112 collateral;
        uint32 startBlock;
    }

    struct State {
        Tokens reserves;
        uint256 feeStored;
        uint256 totalLiquidity;
        Claims totalClaims;
        uint120 totalDebtCreated;
        uint112 x;
        uint112 y;
        uint112 z;
    }

    struct Pool {
        State state;
        mapping(address => uint256) liquidities;
        mapping(address => Claims) claims;
        mapping(address => Due[]) dues;
    }

    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param liquidityTo The address of the receiver of liquidity balance.
    /// @param dueTo The addres of the receiver of collateralized debt balance.
    /// @param xIncrease The increase in the X state.
    /// @param yIncrease The increase in the Y state.
    /// @param zIncrease The increase in the Z state.
    /// @param data The data for callback.
    struct MintParam {
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 xIncrease;
        uint112 yIncrease;
        uint112 zIncrease;
        bytes data;
    }

    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param assetTo The address of the receiver of asset ERC20.
    /// @param collateralTo The addres of the receiver of collateral ERC20.
    /// @param liquidityIn The amount of liquidity balance burnt by the msg.sender.
    struct BurnParam {
        uint256 maturity;
        address assetTo;
        address collateralTo;
        uint256 liquidityIn;
    }

    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param bondTo The address of the receiver of bond balance.
    /// @param insuranceTo The addres of the receiver of insurance balance.
    /// @param xIncrease The increase in x state and the amount of asset ERC20 sent.
    /// @param yDecrease The decrease in y state.
    /// @param zDecrease The decrease in z state.
    /// @param data The data for callback.
    struct LendParam {
        uint256 maturity;
        address bondTo;
        address insuranceTo;
        uint112 xIncrease;
        uint112 yDecrease;
        uint112 zDecrease;
        bytes data;
    }

    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param assetTo The address of the receiver of asset ERC20.
    /// @param collateralTo The addres of the receiver of collateral ERC20.
    /// @param claimsIn The amount of bond balance and insurance balance burnt by the msg.sender.
    struct WithdrawParam {
        uint256 maturity;
        address assetTo;
        address collateralTo;
        Claims claimsIn;
    }

    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param assetTo The address of the receiver of asset ERC20.
    /// @param dueTo The address of the receiver of collateralized debt.
    /// @param xDecrease The decrease in x state and amount of asset ERC20 received by assetTo.
    /// @param yIncrease The increase in y state.
    /// @param zIncrease The increase in z state.
    /// @param data The data for callback.
    struct BorrowParam {
        uint256 maturity;
        address assetTo;
        address dueTo;
        uint112 xDecrease;
        uint112 yIncrease;
        uint112 zIncrease;
        bytes data;
    }

    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param to The address of the receiver of collateral ERC20.
    /// @param owner The addres of the owner of collateralized debt.
    /// @param ids The array indexes of collateralized debts.
    /// @param assetsIn The amount of asset ERC20 paid per collateralized debts.
    /// @param collateralsOut The amount of collateral ERC20 withdrawn per collaterlaized debts.
    /// @param data The data for callback.
    struct PayParam {
        uint256 maturity;
        address to;
        address owner;
        uint256[] ids;
        uint112[] assetsIn;
        uint112[] collateralsOut;
        bytes data;
    }

    /* ===== EVENT ===== */

    /// @dev Emits when the state gets updated.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param x The new x state of the pool.
    /// @param y The new y state of the pool.
    /// @param z The new z state of the pool.
    event Sync(uint256 indexed maturity, uint112 x, uint112 y, uint112 z);

    /// @dev Emits when mint function is called.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param sender The address of the caller.
    /// @param liquidityTo The address of the receiver of liquidity balance.
    /// @param dueTo The address of the receiver of collateralized debt balance.
    /// @param assetIn The increase in the X state.
    /// @param liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @param id The array index of the collateralized debt received by dueTo.
    /// @param dueOut The collateralized debt received by dueTo.
    /// @param feeIn The amount of fee asset ERC20 deposited.
    event Mint(
        uint256 maturity,
        address indexed sender,
        address indexed liquidityTo,
        address indexed dueTo,
        uint256 assetIn,
        uint256 liquidityOut,
        uint256 id,
        Due dueOut,
        uint256 feeIn
    );

    /// @dev Emits when burn function is called.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param sender The address of the caller.
    /// @param assetTo The address of the receiver of asset ERC20.
    /// @param collateralTo The addres of the receiver of collateral ERC20.
    /// @param liquidityIn The amount of liquidity balance burnt by the sender.
    /// @param assetOut The amount of asset ERC20 received.
    /// @param collateralOut The amount of collateral ERC20 received.
    /// @param feeOut The amount of fee asset ERC20 received.
    event Burn(
        uint256 maturity,
        address indexed sender,
        address indexed assetTo,
        address indexed collateralTo,
        uint256 liquidityIn,
        uint256 assetOut,
        uint128 collateralOut,
        uint256 feeOut
    );

    /// @dev Emits when lend function is called.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param sender The address of the caller.
    /// @param bondTo The address of the receiver of bond balance.
    /// @param insuranceTo The addres of the receiver of insurance balance.
    /// @param assetIn The increase in X state.
    /// @param claimsOut The amount of bond balance and insurance balance received.
    /// @param feeIn The amount of fee paid by lender.
    /// @param protocolFeeIn The amount of protocol fee paid by lender.
    event Lend(
        uint256 maturity,
        address indexed sender,
        address indexed bondTo,
        address indexed insuranceTo,
        uint256 assetIn,
        Claims claimsOut,
        uint256 feeIn,
        uint256 protocolFeeIn
    );

    /// @dev Emits when withdraw function is called.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param sender The address of the caller.
    /// @param assetTo The address of the receiver of asset ERC20.
    /// @param collateralTo The address of the receiver of collateral ERC20.
    /// @param claimsIn The amount of bond balance and insurance balance burnt by the sender.
    /// @param tokensOut The amount of asset ERC20 and collateral ERC20 received.
    event Withdraw(
        uint256 maturity,
        address indexed sender,
        address indexed assetTo,
        address indexed collateralTo,
        Claims claimsIn,
        Tokens tokensOut
    );

    /// @dev Emits when borrow function is called.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param sender The address of the caller.
    /// @param assetTo The address of the receiver of asset ERC20.
    /// @param dueTo The address of the receiver of collateralized debt.
    /// @param assetOut The amount of asset ERC20 received by assetTo.
    /// @param id The array index of the collateralized debt received by dueTo.
    /// @param dueOut The collateralized debt received by dueTo.
    /// @param feeIn The amount of fee paid by lender.
    /// @param protocolFeeIn The amount of protocol fee paid by lender.
    event Borrow(
        uint256 maturity,
        address indexed sender,
        address indexed assetTo,
        address indexed dueTo,
        uint256 assetOut,
        uint256 id,
        Due dueOut,
        uint256 feeIn,
        uint256 protocolFeeIn
    );

    /// @dev Emits when pay function is called.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param sender The address of the caller.
    /// @param to The address of the receiver of collateral ERC20.
    /// @param owner The address of the owner of collateralized debt.
    /// @param ids The array indexes of collateralized debts.
    /// @param assetsIn The amount of asset ERC20 paid per collateralized debts.
    /// @param collateralsOut The amount of collateral ERC20 withdrawn per collaterelized debts.
    /// @param assetIn The total amount of asset ERC20 paid.
    /// @param collateralOut The total amount of collateral ERC20 received.
    event Pay(
        uint256 maturity,
        address indexed sender,
        address indexed to,
        address indexed owner,
        uint256[] ids,
        uint112[] assetsIn,
        uint112[] collateralsOut,
        uint128 assetIn,
        uint128 collateralOut
    );

    /// @dev Emits when collectProtocolFee function is called
    /// @param sender The address of the caller.
    /// @param to The address of the receiver of asset ERC20.
    /// @param protocolFeeOut The amount of protocol fee asset ERC20 received.
    event CollectProtocolFee(
        address indexed sender,
        address indexed to,
        uint256 protocolFeeOut
    );

    /* ===== VIEW ===== */

    /// @dev Return the address of the factory contract that deployed this contract.
    /// @return The address of the factory contract.
    function factory() external view returns (IFactory);

    /// @dev Return the address of the ERC20 being lent and borrowed.
    /// @return The address of the asset ERC20.
    function asset() external view returns (IERC20);

    /// @dev Return the address of the ERC20 as collateral.
    /// @return The address of the collateral ERC20.
    function collateral() external view returns (IERC20);

    //// @dev Return the fee per second earned by liquidity providers.
    //// @return The transaction fee following the UQ0.40 format.
    function fee() external view returns (uint16);

    /// @dev Return the protocol fee per second earned by the owner.
    /// @return The protocol fee per second following the UQ0.40 format.
    function protocolFee() external view returns (uint16);

    /// @dev Return the fee stored of the Pool given maturity.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @return The fee in asset ERC20 stored in the Pool.
    function feeStored(uint256 maturity) external view returns (uint256);

    /// @dev Return the protocol fee stored.
    /// @return The protocol fee in asset ERC20 stored.
    function protocolFeeStored() external view returns (uint256);

    /// @dev Returns the Constant Product state of a Pool.
    /// @dev The Y state follows the UQ80.32 format.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @return x The x state.
    /// @return y The y state.
    /// @return z The z state.
    function constantProduct(uint256 maturity)
        external
        view
        returns (
            uint112 x,
            uint112 y,
            uint112 z
        );

    /// @dev Returns the asset ERC20 and collateral ERC20 balances of a Pool.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @return The asset ERC20 and collateral ERC20 locked.
    function totalReserves(uint256 maturity) external view returns (Tokens memory);

    /// @dev Returns the total liquidity supply of a Pool.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @return The total liquidity supply.
    function totalLiquidity(uint256 maturity) external view returns (uint256);

    /// @dev Returns the liquidity balance of a user in a Pool.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param owner The address of the user.
    /// @return The liquidity balance.
    function liquidityOf(uint256 maturity, address owner) external view returns (uint256);

    /// @dev Returns the total claims of a Pool.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @return The total claims.
    function totalClaims(uint256 maturity) external view returns (Claims memory);

    /// @dev Returms the claims of a user in a Pool.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param owner The address of the user.
    /// @return The claims balance.
    function claimsOf(uint256 maturity, address owner) external view returns (Claims memory);

    /// @dev Returns the total debt created.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @return The total asset ERC20 debt created.
    function totalDebtCreated(uint256 maturity) external view returns (uint120);

    /// @dev Returns the number of dues owned by owner.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param owner The address of the user.
    function totalDuesOf(uint256 maturity, address owner) external view returns (uint256);

    /// @dev Returns a collateralized debt of a user in a Pool.
    /// @param maturity The unix timestamp maturity of the Pool.
    /// @param owner The address of the user.
    /// @param id The index of the collateralized debt
    /// @return The collateralized debt balance.
    function dueOf(uint256 maturity, address owner, uint256 id) external view returns (Due memory);

    /* ===== UPDATE ===== */

    /// @dev Add liquidity into a Pool by a liquidity provider.
    /// @dev Liquidity providers can be thought as making both lending and borrowing positions.
    /// @dev Must be called by a contract implementing the ITimeswapMintCallback interface.
    /// @param param The mint parameter found in the MintParam struct.
    /// @return assetIn The amount of asset ERC20 deposited.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function mint(MintParam calldata param)
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            Due memory dueOut
        );

    /// @dev Remove liquidity from a Pool by a liquidity provider.
    /// @dev Can only be called after the maturity of the Pool.
    /// @param param The burn parameter found in the BurnParam struct.
    /// @return assetOut The amount of asset ERC20 received.
    /// @return collateralOut The amount of collateral ERC20 received.
    function burn(BurnParam calldata param) 
        external 
        returns (
            uint256 assetOut,
            uint128 collateralOut 
        );

    /// @dev Lend asset ERC20 into the Pool.
    /// @dev Must be called by a contract implementing the ITimeswapLendCallback interface.
    /// @param param The lend parameter found in the LendParam struct.
    /// @return assetIn The amount of asset ERC20 deposited.
    /// @return claimsOut The amount of bond balance and insurance balance received.
    function lend(LendParam calldata param) 
        external 
        returns (
            uint256 assetIn,
            Claims memory claimsOut
        );

    /// @dev Withdraw asset ERC20 and/or collateral ERC20 for lenders.
    /// @dev Can only be called after the maturity of the Pool.
    /// @param param The withdraw parameter found in the WithdrawParam struct.
    /// @return tokensOut The amount of asset ERC20 and collateral ERC20 received.
    function withdraw(WithdrawParam calldata param)
        external 
        returns (
            Tokens memory tokensOut
        );

    /// @dev Borrow asset ERC20 from the Pool.
    /// @dev Must be called by a contract implementing the ITimeswapBorrowCallback interface.
    /// @param param The borrow parameter found in the BorrowParam struct.
    /// @return assetOut The amount of asset ERC20 received.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function borrow(BorrowParam calldata param)
        external 
        returns (
            uint256 assetOut,
            uint256 id, 
            Due memory dueOut
        );

    /// @dev Pay asset ERC20 into the Pool to repay debt for borrowers.
    /// @dev If there are asset paid, must be called by a contract implementing the ITimeswapPayCallback interface.
    /// @param param The pay parameter found in the PayParam struct.
    /// @return assetIn The total amount of asset ERC20 paid.
    /// @return collateralOut The total amount of collateral ERC20 received.
    function pay(PayParam calldata param)
        external 
        returns (
            uint128 assetIn, 
            uint128 collateralOut
        );

    /// @dev Collect the stored protocol fee.
    /// @dev Can only be called by the owner.
    /// @param to The receiver of the protocol fee.
    /// @return protocolFeeOut The total amount of protocol fee asset ERC20 received.
    function collectProtocolFee(address to) external returns (uint256 protocolFeeOut);
}
