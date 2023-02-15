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

import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { ICErc20 } from "../../../interfaces/external/ICErc20.sol";
import { IComptroller } from "../../../interfaces/external/IComptroller.sol";

/**
 * @title Compound
 * @author Set Protocol
 *
 * Collection of helper functions for interacting with Compound integrations
 */
library Compound {
    /* ============ External ============ */

    /**
     * Get enter markets calldata from SetToken
     */
    function getEnterMarketsCalldata(
        ICErc20 _cToken,
        IComptroller _comptroller
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        address[] memory marketsToEnter = new address[](1);
        marketsToEnter[0] = address(_cToken);

        // Compound's enter market function signature is: enterMarkets(address[] _cTokens)
        bytes memory callData = abi.encodeWithSignature("enterMarkets(address[])", marketsToEnter);

        return (address(_comptroller), 0, callData);
    }

    /**
     * Invoke enter markets from SetToken
     */
    function invokeEnterMarkets(ISetToken _setToken, ICErc20 _cToken, IComptroller _comptroller) external {
        ( , , bytes memory enterMarketsCalldata) = getEnterMarketsCalldata(_cToken, _comptroller);

        uint256[] memory returnValues = abi.decode(_setToken.invoke(address(_comptroller), 0, enterMarketsCalldata), (uint256[]));
        require(returnValues[0] == 0, "Entering failed");
    }

    /**
     * Get exit market calldata from SetToken
     */
    function getExitMarketCalldata(
        ICErc20 _cToken,
        IComptroller _comptroller
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        // Compound's exit market function signature is: exitMarket(address _cToken)
        bytes memory callData = abi.encodeWithSignature("exitMarket(address)", address(_cToken));

        return (address(_comptroller), 0, callData);
    }

    /**
     * Invoke exit market from SetToken
     */
    function invokeExitMarket(ISetToken _setToken, ICErc20 _cToken, IComptroller _comptroller) external {
        ( , , bytes memory exitMarketCalldata) = getExitMarketCalldata(_cToken, _comptroller);
        require(
            abi.decode(_setToken.invoke(address(_comptroller), 0, exitMarketCalldata), (uint256)) == 0,
            "Exiting failed"
        );
    }

    /**
     * Get mint cEther calldata from SetToken
     */
    function getMintCEtherCalldata(
       ICErc20 _cEther,
       uint256 _mintNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        // Compound's mint cEther function signature is: mint(). No return, reverts on error.
        bytes memory callData = abi.encodeWithSignature("mint()");

        return (address(_cEther), _mintNotional, callData);
    }

    /**
     * Invoke mint cEther from the SetToken
     */
    function invokeMintCEther(ISetToken _setToken, ICErc20 _cEther, uint256 _mintNotional) external {
        ( , , bytes memory mintCEtherCalldata) = getMintCEtherCalldata(_cEther, _mintNotional);

        _setToken.invoke(address(_cEther), _mintNotional, mintCEtherCalldata);
    }

    /**
     * Get mint cToken calldata from SetToken
     */
    function getMintCTokenCalldata(
       ICErc20 _cToken,
       uint256 _mintNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        // Compound's mint cToken function signature is: mint(uint256 _mintAmount). Returns 0 if success
        bytes memory callData = abi.encodeWithSignature("mint(uint256)", _mintNotional);

        return (address(_cToken), _mintNotional, callData);
    }

    /**
     * Invoke mint from the SetToken. Mints the specified cToken from the underlying of the specified notional quantity
     */
    function invokeMintCToken(ISetToken _setToken, ICErc20 _cToken, uint256 _mintNotional) external {
        ( , , bytes memory mintCTokenCalldata) = getMintCTokenCalldata(_cToken, _mintNotional);

        require(
            abi.decode(_setToken.invoke(address(_cToken), 0, mintCTokenCalldata), (uint256)) == 0,
            "Mint failed"
        );
    }

    /**
     * Get redeem underlying calldata
     */
    function getRedeemUnderlyingCalldata(
       ICErc20 _cToken,
       uint256 _redeemNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        // Compound's redeem function signature is: redeemUnderlying(uint256 _underlyingAmount)
        bytes memory callData = abi.encodeWithSignature("redeemUnderlying(uint256)", _redeemNotional);

        return (address(_cToken), _redeemNotional, callData);
    }

    /**
     * Invoke redeem underlying from the SetToken
     */
    function invokeRedeemUnderlying(ISetToken _setToken, ICErc20 _cToken, uint256 _redeemNotional) external {
        ( , , bytes memory redeemUnderlyingCalldata) = getRedeemUnderlyingCalldata(_cToken, _redeemNotional);

        require(
            abi.decode(_setToken.invoke(address(_cToken), 0, redeemUnderlyingCalldata), (uint256)) == 0,
            "Redeem underlying failed"
        );
    }

    /**
     * Get redeem calldata
     */
    function getRedeemCalldata(
       ICErc20 _cToken,
       uint256 _redeemNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature("redeem(uint256)", _redeemNotional);

        return (address(_cToken), _redeemNotional, callData);
    }


    /**
     * Invoke redeem from the SetToken
     */
    function invokeRedeem(ISetToken _setToken, ICErc20 _cToken, uint256 _redeemNotional) external {
        ( , , bytes memory redeemCalldata) = getRedeemCalldata(_cToken, _redeemNotional);

        require(
            abi.decode(_setToken.invoke(address(_cToken), 0, redeemCalldata), (uint256)) == 0,
            "Redeem failed"
        );
    }

    /**
     * Get repay borrow calldata
     */
    function getRepayBorrowCEtherCalldata(
       ICErc20 _cToken,
       uint256 _repayNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        // Compound's repay ETH function signature is: repayBorrow(). No return, revert on fail
        bytes memory callData = abi.encodeWithSignature("repayBorrow()");

        return (address(_cToken), _repayNotional, callData);
    }

    /**
     * Invoke repay cEther from the SetToken
     */
    function invokeRepayBorrowCEther(ISetToken _setToken, ICErc20 _cEther, uint256 _repayNotional) external {
        ( , , bytes memory repayBorrowCalldata) = getRepayBorrowCEtherCalldata(_cEther, _repayNotional);
        _setToken.invoke(address(_cEther), _repayNotional, repayBorrowCalldata);
    }

    /**
     * Get repay borrow calldata
     */
    function getRepayBorrowCTokenCalldata(
       ICErc20 _cToken,
       uint256 _repayNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        // Compound's repay asset function signature is: repayBorrow(uint256 _repayAmount)
        bytes memory callData = abi.encodeWithSignature("repayBorrow(uint256)", _repayNotional);

        return (address(_cToken), _repayNotional, callData);
    }

    /**
     * Invoke repay cToken from the SetToken
     */
    function invokeRepayBorrowCToken(ISetToken _setToken, ICErc20 _cToken, uint256 _repayNotional) external {
        ( , , bytes memory repayBorrowCalldata) = getRepayBorrowCTokenCalldata(_cToken, _repayNotional);
        require(
            abi.decode(_setToken.invoke(address(_cToken), 0, repayBorrowCalldata), (uint256)) == 0,
            "Repay failed"
        );
    }

    /**
     * Get borrow calldata
     */
    function getBorrowCalldata(
       ICErc20 _cToken,
       uint256 _notionalBorrowQuantity
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        // Compound's borrow function signature is: borrow(uint256 _borrowAmount). Note: Notional borrow quantity is in units of underlying asset
        bytes memory callData = abi.encodeWithSignature("borrow(uint256)", _notionalBorrowQuantity);

        return (address(_cToken), 0, callData);
    }

    /**
     * Invoke the SetToken to interact with the specified cToken to borrow the cToken's underlying of the specified borrowQuantity.
     */
    function invokeBorrow(ISetToken _setToken, ICErc20 _cToken, uint256 _notionalBorrowQuantity) external {
        ( , , bytes memory borrowCalldata) = getBorrowCalldata(_cToken, _notionalBorrowQuantity);
        require(
            abi.decode(_setToken.invoke(address(_cToken), 0, borrowCalldata), (uint256)) == 0,
            "Borrow failed"
        );
    }
}
