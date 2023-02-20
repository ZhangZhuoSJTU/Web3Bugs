// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CTokenMock.sol";
import "./CErc20.sol";
import "./ComptrollerInterface.sol";
import "./ComptrollerStorage.sol";

contract ComptrollerMock is ComptrollerStorage, ComptrollerInterface {
    uint public exchangeRate; // current exchange rate as 1**(18 - 8 + Underlying Token Decimals)

    // used for mocks, it will force-fail the next deposit or redeem
    bool public mockFailNextDepositOrRedeem;

    /// @param initialExchangeRate Initial mocked exchange rate, the official default is 0.02
    ///                            with decimal precision calculated as 18 - 8 + Underlying Token Decimals
    constructor(uint initialExchangeRate) {
        exchangeRate = initialExchangeRate;
    }

    /// @notice MOCK ONLY
    function setExchangeRate(uint rate) public {
        exchangeRate = rate;
    }

    /// @notice MOCK ONLY
    function setFailNextDepositOrRedeem(bool fail) public {
        mockFailNextDepositOrRedeem = fail;
    }

    /// @notice Add assets to be included in account liquidity calculation
    /// @param cTokens The list of addresses of the cToken markets to be enabled
    /// @return Success indicator for whether each corresponding market was entered
    function enterMarkets(address[] calldata cTokens) external override returns (uint[] memory) {
        uint len = cTokens.length;
        uint[] memory results = new uint[](len);
        for (uint i = 0; i < len; i++) {
            results[i] = uint(addToMarketInternal(CTokenMock(cTokens[i]), msg.sender));
        }
        return results;
    }

    /// @notice Add the market to the borrower's "assets in" for liquidity calculations
    /// @param cToken The market to enter
    /// @param borrower The address of the account to modify
    /// @return Success indicator for whether the market was entered
    function addToMarketInternal(CTokenMock cToken, address borrower) internal returns (uint) {
        Market storage marketToJoin = markets[address(cToken)];
        if (marketToJoin.accountMembership[borrower] == false) {
            marketToJoin.accountMembership[borrower] = true;
            accountAssets[borrower].push(cToken);
        }
        return 0;
    }

    /// @notice Removes asset from sender's account liquidity calculation
    /// @dev Sender must not have an outstanding borrow balance in the asset,
    ///  or be providing necessary collateral for an outstanding borrow.
    /// @param cTokenAddress The address of the asset to be removed
    /// @return Whether or not the account successfully exited the market
    function exitMarket(address cTokenAddress) external override returns (uint) {
        CTokenMock cToken = CTokenMock(cTokenAddress);
        Market storage marketToExit = markets[address(cToken)];

        /* Set cToken account membership to false */
        delete marketToExit.accountMembership[msg.sender];

        /* Delete cToken from the account’s list of assets */
        // load into memory for faster iteration
        CTokenMock[] memory userAssetList = accountAssets[msg.sender];
        uint len = userAssetList.length;
        uint assetIndex = len;
        for (uint i = 0; i < len; i++) {
            if (userAssetList[i] == cToken) {
                assetIndex = i;
                break;
            }
        }

        // We *must* have found the asset in the list or our redundant data structure is broken
        assert(assetIndex < len);
        delete accountAssets[msg.sender][assetIndex];
        return 0;
    }

    function mintAllowed(
        address cToken,
        address minter,
        uint /*mintAmount*/
    ) external view override returns (uint) {
        if (!isParticipant(cToken, minter)) {
            return 1; // error!
        }
        return 0;
    }

    /// @dev MOCK ONLY.
    /// @return True if user is participant in cToken market
    function isParticipant(address cTokenAddress, address participant) public view returns (bool) {
        Market storage market = markets[cTokenAddress];
        return market.accountMembership[participant];
    }
}
