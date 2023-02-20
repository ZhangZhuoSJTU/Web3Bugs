/*
    Copyright 2021 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ILendingPool } from "../../../interfaces/external/aave-v2/ILendingPool.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";

/**
 * @title AaveV2
 * @author Set Protocol
 * 
 * Collection of helper functions for interacting with AaveV2 integrations.
 */
library AaveV2 {
    /* ============ External ============ */
    
    /**
     * Get deposit calldata from SetToken
     *
     * Deposits an `_amountNotional` of underlying asset into the reserve, receiving in return overlying aTokens.
     * - E.g. User deposits 100 USDC and gets in return 100 aUSDC
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the underlying asset to deposit
     * @param _amountNotional       The amount to be deposited
     * @param _onBehalfOf           The address that will receive the aTokens, same as msg.sender if the user
     *                              wants to receive them on his own wallet, or a different address if the beneficiary of aTokens
     *                              is a different wallet
     * @param _referralCode         Code used to register the integrator originating the operation, for potential rewards.
     *                              0 if the action is executed directly by the user, without any middle-man
     *
     * @return address              Target contract address
     * @return uint256              Call value
     * @return bytes                Deposit calldata
     */
    function getDepositCalldata(
        ILendingPool _lendingPool,
        address _asset, 
        uint256 _amountNotional,
        address _onBehalfOf,
        uint16 _referralCode
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "deposit(address,uint256,address,uint16)", 
            _asset, 
            _amountNotional, 
            _onBehalfOf,
            _referralCode
        );
        
        return (address(_lendingPool), 0, callData);
    }
    
    /**
     * Invoke deposit on LendingPool from SetToken
     * 
     * Deposits an `_amountNotional` of underlying asset into the reserve, receiving in return overlying aTokens.
     * - E.g. SetToken deposits 100 USDC and gets in return 100 aUSDC
     * @param _setToken             Address of the SetToken
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the underlying asset to deposit
     * @param _amountNotional       The amount to be deposited
     */
    function invokeDeposit(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _amountNotional        
    )
        external
    {
        ( , , bytes memory depositCalldata) = getDepositCalldata(
            _lendingPool,
            _asset,
            _amountNotional, 
            address(_setToken), 
            0
        );
        
        _setToken.invoke(address(_lendingPool), 0, depositCalldata);
    }
    
    /**
     * Get withdraw calldata from SetToken
     * 
     * Withdraws an `_amountNotional` of underlying asset from the reserve, burning the equivalent aTokens owned
     * - E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the underlying asset to withdraw
     * @param _amountNotional       The underlying amount to be withdrawn
     *                              Note: Passing type(uint256).max will withdraw the entire aToken balance
     * @param _receiver             Address that will receive the underlying, same as msg.sender if the user
     *                              wants to receive it on his own wallet, or a different address if the beneficiary is a
     *                              different wallet
     *
     * @return address              Target contract address
     * @return uint256              Call value
     * @return bytes                Withdraw calldata
     */
    function getWithdrawCalldata(
        ILendingPool _lendingPool,
        address _asset, 
        uint256 _amountNotional,
        address _receiver        
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "withdraw(address,uint256,address)", 
            _asset, 
            _amountNotional, 
            _receiver
        );
        
        return (address(_lendingPool), 0, callData);
    }
    
    /**
     * Invoke withdraw on LendingPool from SetToken
     * 
     * Withdraws an `_amountNotional` of underlying asset from the reserve, burning the equivalent aTokens owned
     * - E.g. SetToken has 100 aUSDC, and receives 100 USDC, burning the 100 aUSDC
     *     
     * @param _setToken         Address of the SetToken
     * @param _lendingPool      Address of the LendingPool contract
     * @param _asset            The address of the underlying asset to withdraw
     * @param _amountNotional   The underlying amount to be withdrawn
     *                          Note: Passing type(uint256).max will withdraw the entire aToken balance
     *
     * @return uint256          The final amount withdrawn
     */
    function invokeWithdraw(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _amountNotional        
    )
        external
        returns (uint256)
    {
        ( , , bytes memory withdrawCalldata) = getWithdrawCalldata(
            _lendingPool,
            _asset,
            _amountNotional, 
            address(_setToken)
        );
        
        return abi.decode(_setToken.invoke(address(_lendingPool), 0, withdrawCalldata), (uint256));
    }
    
    /**
     * Get borrow calldata from SetToken
     *
     * Allows users to borrow a specific `_amountNotional` of the reserve underlying `_asset`, provided that 
     * the borrower already deposited enough collateral, or he was given enough allowance by a credit delegator
     * on the corresponding debt token (StableDebtToken or VariableDebtToken)
     *
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the underlying asset to borrow
     * @param _amountNotional       The amount to be borrowed
     * @param _interestRateMode     The interest rate mode at which the user wants to borrow: 1 for Stable, 2 for Variable
     * @param _referralCode         Code used to register the integrator originating the operation, for potential rewards.
     *                              0 if the action is executed directly by the user, without any middle-man
     * @param _onBehalfOf           Address of the user who will receive the debt. Should be the address of the borrower itself
     *                              calling the function if he wants to borrow against his own collateral, or the address of the
     *                              credit delegator if he has been given credit delegation allowance
     *
     * @return address              Target contract address
     * @return uint256              Call value
     * @return bytes                Borrow calldata
     */
    function getBorrowCalldata(
        ILendingPool _lendingPool,
        address _asset, 
        uint256 _amountNotional,
        uint256 _interestRateMode,
        uint16 _referralCode,
        address _onBehalfOf
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "borrow(address,uint256,uint256,uint16,address)", 
            _asset, 
            _amountNotional, 
            _interestRateMode,
            _referralCode,
            _onBehalfOf
        );
        
        return (address(_lendingPool), 0, callData);
    }
    
    /**
     * Invoke borrow on LendingPool from SetToken
     *
     * Allows SetToken to borrow a specific `_amountNotional` of the reserve underlying `_asset`, provided that 
     * the SetToken already deposited enough collateral, or it was given enough allowance by a credit delegator
     * on the corresponding debt token (StableDebtToken or VariableDebtToken)
     * @param _setToken             Address of the SetToken
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the underlying asset to borrow
     * @param _amountNotional       The amount to be borrowed
     * @param _interestRateMode     The interest rate mode at which the user wants to borrow: 1 for Stable, 2 for Variable
     */
    function invokeBorrow(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _amountNotional,
        uint256 _interestRateMode
    )
        external
    {
        ( , , bytes memory borrowCalldata) = getBorrowCalldata(
            _lendingPool,
            _asset,
            _amountNotional,
            _interestRateMode,
            0, 
            address(_setToken)
        );
        
        _setToken.invoke(address(_lendingPool), 0, borrowCalldata);
    }

    /**
     * Get repay calldata from SetToken
     *
     * Repays a borrowed `_amountNotional` on a specific `_asset` reserve, burning the equivalent debt tokens owned
     * - E.g. User repays 100 USDC, burning 100 variable/stable debt tokens of the `onBehalfOf` address
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the borrowed underlying asset previously borrowed
     * @param _amountNotional       The amount to repay
     *                              Note: Passing type(uint256).max will repay the whole debt for `_asset` on the specific `_interestRateMode`
     * @param _interestRateMode     The interest rate mode at of the debt the user wants to repay: 1 for Stable, 2 for Variable
     * @param _onBehalfOf           Address of the user who will get his debt reduced/removed. Should be the address of the
     *                              user calling the function if he wants to reduce/remove his own debt, or the address of any other
     *                              other borrower whose debt should be removed
     *
     * @return address              Target contract address
     * @return uint256              Call value
     * @return bytes                Repay calldata
     */
    function getRepayCalldata(
        ILendingPool _lendingPool,
        address _asset, 
        uint256 _amountNotional,
        uint256 _interestRateMode,        
        address _onBehalfOf
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "repay(address,uint256,uint256,address)", 
            _asset, 
            _amountNotional, 
            _interestRateMode,            
            _onBehalfOf
        );
        
        return (address(_lendingPool), 0, callData);
    }

    /**
     * Invoke repay on LendingPool from SetToken
     *
     * Repays a borrowed `_amountNotional` on a specific `_asset` reserve, burning the equivalent debt tokens owned
     * - E.g. SetToken repays 100 USDC, burning 100 variable/stable debt tokens
     * @param _setToken             Address of the SetToken
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the borrowed underlying asset previously borrowed
     * @param _amountNotional       The amount to repay
     *                              Note: Passing type(uint256).max will repay the whole debt for `_asset` on the specific `_interestRateMode`
     * @param _interestRateMode     The interest rate mode at of the debt the user wants to repay: 1 for Stable, 2 for Variable
     *
     * @return uint256              The final amount repaid
     */
    function invokeRepay(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _amountNotional,
        uint256 _interestRateMode
    )
        external
        returns (uint256)
    {
        ( , , bytes memory repayCalldata) = getRepayCalldata(
            _lendingPool,
            _asset,
            _amountNotional,
            _interestRateMode,
            address(_setToken)
        );
        
        return abi.decode(_setToken.invoke(address(_lendingPool), 0, repayCalldata), (uint256));
    }

    /**
     * Get setUserUseReserveAsCollateral calldata from SetToken
     * 
     * Allows borrower to enable/disable a specific deposited asset as collateral
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the underlying asset deposited
     * @param _useAsCollateral      true` if the user wants to use the deposit as collateral, `false` otherwise
     *
     * @return address              Target contract address
     * @return uint256              Call value
     * @return bytes                SetUserUseReserveAsCollateral calldata
     */
    function getSetUserUseReserveAsCollateralCalldata(
        ILendingPool _lendingPool,
        address _asset,
        bool _useAsCollateral
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "setUserUseReserveAsCollateral(address,bool)", 
            _asset,
            _useAsCollateral
        );
        
        return (address(_lendingPool), 0, callData);
    }

    /**
     * Invoke an asset to be used as collateral on Aave from SetToken
     *
     * Allows SetToken to enable/disable a specific deposited asset as collateral
     * @param _setToken             Address of the SetToken
     * @param _lendingPool          Address of the LendingPool contract
     * @param _asset                The address of the underlying asset deposited
     * @param _useAsCollateral      true` if the user wants to use the deposit as collateral, `false` otherwise
     */
    function invokeSetUserUseReserveAsCollateral(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        bool _useAsCollateral
    )
        external
    {
        ( , , bytes memory callData) = getSetUserUseReserveAsCollateralCalldata(
            _lendingPool,
            _asset,
            _useAsCollateral
        );
        
        _setToken.invoke(address(_lendingPool), 0, callData);
    }
    
    /**
     * Get swapBorrowRate calldata from SetToken
     *
     * Allows a borrower to toggle his debt between stable and variable mode
     * @param _lendingPool      Address of the LendingPool contract
     * @param _asset            The address of the underlying asset borrowed
     * @param _rateMode         The rate mode that the user wants to swap to
     *
     * @return address          Target contract address
     * @return uint256          Call value
     * @return bytes            SwapBorrowRate calldata
     */
    function getSwapBorrowRateModeCalldata(
        ILendingPool _lendingPool,
        address _asset,
        uint256 _rateMode
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "swapBorrowRateMode(address,uint256)", 
            _asset,
            _rateMode
        );
        
        return (address(_lendingPool), 0, callData);
    }

    /**
     * Invoke to swap borrow rate of SetToken
     * 
     * Allows SetToken to toggle it's debt between stable and variable mode
     * @param _setToken         Address of the SetToken
     * @param _lendingPool      Address of the LendingPool contract
     * @param _asset            The address of the underlying asset borrowed
     * @param _rateMode         The rate mode that the user wants to swap to
     */
    function invokeSwapBorrowRateMode(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _rateMode
    )
        external
    {
        ( , , bytes memory callData) = getSwapBorrowRateModeCalldata(
            _lendingPool,
            _asset,
            _rateMode
        );
        
        _setToken.invoke(address(_lendingPool), 0, callData);
    }
}