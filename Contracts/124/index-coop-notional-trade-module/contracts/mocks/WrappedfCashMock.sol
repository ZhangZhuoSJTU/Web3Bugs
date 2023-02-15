/*
    Copyright 2022 Set Labs Inc.

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
pragma experimental "ABIEncoderV2";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TokenType, IWrappedfCash } from "../interfaces/IWrappedFCash.sol";

// mock class using BasicToken
contract WrappedfCashMock is ERC20, IWrappedfCash {

    uint256 private fCashId;
    uint40 private maturity;
    bool private matured;
    uint16 private currencyId;
    uint8 private marketIndex;
    IERC20 private underlyingToken;
    int256 private underlyingPrecision;
    IERC20 private assetToken;
    int256 private assetPrecision;
    TokenType private tokenType;

    IERC20 private weth;

    bool private revertDecodedID;

    uint256 public redeemTokenReturned;
    uint256 public mintTokenSpent;

    address internal constant ETH_ADDRESS = address(0);

    constructor (IERC20 _assetToken, IERC20 _underlyingToken, IERC20 _weth) public ERC20("FCashMock", "FCM") {
        assetToken = _assetToken;
        underlyingToken = _underlyingToken;
        weth = _weth;
    }

    function initialize(uint16 _currencyId, uint40 _maturity) external override {
        currencyId = _currencyId;
        maturity = _maturity;
    }

    /// @notice Mints wrapped fCash ERC20 tokens
    function mintViaAsset(
        uint256 depositAmountExternal,
        uint88 fCashAmount,
        address receiver,
        uint32 /* minImpliedRate */
    ) external override{
        uint256 assetTokenAmount = mintTokenSpent == 0 ? depositAmountExternal : mintTokenSpent;
        require(assetToken.transferFrom(msg.sender, address(this), assetTokenAmount), "WrappedfCashMock: Transfer failed");
        _mint(receiver, fCashAmount);
    }

    function mintViaUnderlying(
        uint256 depositAmountExternal,
        uint88 fCashAmount,
        address receiver,
        uint32 /* minImpliedRate */
    ) external override{
        uint256 underlyingTokenAmount = mintTokenSpent == 0 ? depositAmountExternal : mintTokenSpent;
        bool transferSuccess;
        if(address(underlyingToken) == ETH_ADDRESS) {
            transferSuccess = weth.transferFrom(msg.sender, address(this), underlyingTokenAmount);
        } else {
            transferSuccess = underlyingToken.transferFrom(msg.sender, address(this), underlyingTokenAmount);
        }
        require(transferSuccess, "WrappedfCashMock: Transfer failed");
        _mint(receiver, fCashAmount);
    }


    function redeemToAsset(
        uint256 amount,
        address receiver,
        uint32 /* maxImpliedRate */
    ) external override {
        _burn(msg.sender, amount);
        uint256 assetTokenAmount = redeemTokenReturned == 0 ? amount : redeemTokenReturned;
        require(assetToken.transfer(receiver, assetTokenAmount), "WrappedfCashMock: Transfer failed");
    }

    function redeemToUnderlying(
        uint256 amount,
        address receiver,
        uint32 /* maxImpliedRate */
    ) external override {
        _burn(msg.sender, amount);
        uint256 underlyingTokenAmount = redeemTokenReturned == 0 ? amount : redeemTokenReturned;
        if(address(underlyingToken) == ETH_ADDRESS) {
            weth.transfer(receiver, underlyingTokenAmount);
        } else {
            underlyingToken.transfer(receiver, underlyingTokenAmount);
        }
    }

    /// @notice Returns the underlying fCash ID of the token
    function getfCashId() external override view returns (uint256) {
        return fCashId;
    }

    /// @notice True if the fCash has matured, assets mature exactly on the block time
    function hasMatured() external override view returns (bool) {
        return matured;
    }

    /// @notice Returns the components of the fCash idd
    function getDecodedID() external override view returns (uint16, uint40) {
        require(!revertDecodedID, "Test revertion DecodedID");
        return (currencyId, maturity);
    }

    /// @notice Returns the current market index for this fCash asset. If this returns
    /// zero that means it is idiosyncratic and cannot be traded.
    function getMarketIndex() external override view returns (uint8) {
        return marketIndex;
    }

    /// @notice Returns the token and precision of the token that this token settles
    /// to. For example, fUSDC will return the USDC token address and 1e6. The zero
    /// address will represent ETH.
    function getUnderlyingToken() public override view returns (IERC20, int256) {
        return (underlyingToken, underlyingPrecision);
    }

    /// @notice Returns the asset token which the fCash settles to. This will be an interest
    /// bearing token like a cToken or aToken.
    function getAssetToken() public override view returns (IERC20, int256, TokenType) {
        return (assetToken, assetPrecision, tokenType);
    }

    function setMatured(bool _matured) external{
        matured = _matured;
    }

    function setRedeemTokenReturned(uint256 _redeemTokenReturned) external{
        redeemTokenReturned = _redeemTokenReturned;
    }

    function setMintTokenSpent(uint256 _mintTokenSpent) external{
        mintTokenSpent = _mintTokenSpent;
    }

    function setRevertDecodedID(bool _revertDecodedID) external{
        revertDecodedID = _revertDecodedID;
    }

    function getToken(bool useUnderlying) public view override returns (IERC20 token, bool isETH) {
        if (useUnderlying) {
            (token, /* */) = getUnderlyingToken();
        } else {
            (token, /* */, /* */) = getAssetToken();
        }
        isETH = address(token) == ETH_ADDRESS;
    }


}
