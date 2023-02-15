// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./IZeroExOperator.sol";
import "./ZeroExStorage.sol";
import "../../libraries/ExchangeHelpers.sol";
import "../../interfaces/IOperatorSelector.sol";

/// @title The 0x protocol operator to execute swap with the aggregator
contract ZeroExOperator is IZeroExOperator, IOperatorSelector {
    /// @dev Deploy with the storage contract
    constructor(address swapTarget) {
        address zeroxExStorage = Create2.deploy(0, bytes32("nested.zeroex.operator"), type(ZeroExStorage).creationCode);
        ZeroExStorage(zeroxExStorage).updatesSwapTarget(swapTarget);
        ZeroExStorage(zeroxExStorage).transferOwnership(msg.sender);
    }

    /// @inheritdoc IZeroExOperator
    function commitAndRevert(
        address self,
        IERC20 sellToken,
        IERC20 buyToken,
        bytes4 swapSelector,
        bytes calldata swapCallData
    ) external payable override returns (uint256[] memory amounts, address[] memory tokens) {
        amounts = new uint256[](2);
        tokens = new address[](2);
        uint256 buyBalanceBeforePurchase = buyToken.balanceOf(address(this));
        uint256 sellBalanceBeforePurchase = sellToken.balanceOf(address(this));

        bool success = ExchangeHelpers.fillQuote(
            sellToken,
            ZeroExStorage(storageAddress(self)).swapTarget(),
            bytes.concat(swapSelector, swapCallData[32:])
        );
        require(success, "ZeroExOperator::commitAndRevert: 0x swap failed");

        uint256 amountBought = buyToken.balanceOf(address(this)) - buyBalanceBeforePurchase;
        uint256 amountSold = sellBalanceBeforePurchase - sellToken.balanceOf(address(this));
        assert(amountBought > 0);
        assert(amountSold > 0);

        // Output amounts
        amounts[0] = amountBought;
        amounts[1] = amountSold;
        // Output token
        tokens[0] = address(buyToken);
        tokens[1] = address(sellToken);
    }

    /// @notice Return the operator storage address
    /// @param own the operator address to build the storage address in delegatecall
    function storageAddress(address own) public pure returns (address) {
        bytes32 _data = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                own,
                bytes32("nested.zeroex.operator"),
                keccak256(type(ZeroExStorage).creationCode)
            )
        );
        return address(uint160(uint256(_data)));
    }

    /// @inheritdoc IOperatorSelector
    function getCommitSelector() external pure override returns (bytes4) {
        return this.commitAndRevert.selector;
    }

    /// @inheritdoc IOperatorSelector
    function getRevertSelector() external pure override returns (bytes4) {
        return this.commitAndRevert.selector;
    }
}
