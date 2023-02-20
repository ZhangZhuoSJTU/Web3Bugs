pragma solidity ^0.8.0;

import "../governance/EmergencyPausable.sol";
import "../utils/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Swap is EmergencyPausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Math for uint256;

    /// @notice An address to receive swap fees. The 0 address prevents fee
    ///         withdrawal.
    address payable public feeRecipient;
    /// @notice divide by the SWAP_FEE_DIVISOR to get the fee ratio, deducted
    ///         from the proceeds of each swap.
    uint256 public swapFee;
    uint256 public constant SWAP_FEE_DIVISOR = 100_000;

    event SwappedTokens(
        address tokenSold,
        address tokenBought,
        uint256 amountSold,
        uint256 amountBought,
        uint256 amountBoughtFee
    );

    event NewSwapFee(
        uint256 newSwapFee
    );

    event NewFeeRecipient(
        address newFeeRecipient
    );

    event FeesSwept(
        address token,
        uint256 amount,
        address recipient
    );

    /// @param owner_ A new contract owner, expected to implement
    ///               TimelockGovernorWithEmergencyGovernance.
    /// @param feeRecipient_ A payable address to receive swap fees. Setting the
    ///        0 address prevents fee withdrawal, and can be set later by
    ///        governance.
    /// @param swapFee_ A fee, which divided by SWAP_FEE_DIVISOR sets the fee
    ///                 ratio charged for each swap.
    constructor(address owner_, address payable feeRecipient_, uint256 swapFee_) {
        require(owner_ != address(0), "Swap::constructor: Owner must not be 0");
        transferOwnership(owner_);
        feeRecipient = feeRecipient_;
        emit NewFeeRecipient(feeRecipient);
        swapFee = swapFee_;
        emit NewSwapFee(swapFee);
    }

    /// @notice Set the fee taken from each swap's proceeds.
    /// @dev Only timelocked governance can set the swap fee.
    /// @param swapFee_ A fee, which divided by SWAP_FEE_DIVISOR sets the fee ratio.
    function setSwapFee(uint256 swapFee_) external onlyTimelock {
        require(swapFee_ < SWAP_FEE_DIVISOR, "Swap::setSwapFee: Swap fee must not exceed 100%");
        swapFee = swapFee_;
        emit NewSwapFee(swapFee);
    }

    /// @notice Set the address permitted to receive swap fees.
    /// @dev Only timelocked governance can set the fee recipient.
    /// @param feeRecipient_ A payable address to receive swap fees. Setting the
    ///        0 address prevents fee withdrawal.
    function setFeeRecipient(address payable feeRecipient_) external onlyTimelock {
        feeRecipient = feeRecipient_;
        emit NewFeeRecipient(feeRecipient);
    }

    /// @notice Swap by filling a 0x quote.
    /// @dev Execute a swap by filling a 0x quote, as provided by the 0x API.
    ///      Charges a governable swap fee that comes out of the bought asset,
    ///      be it token or ETH. Unfortunately, the fee is also charged on any
    ///      refunded ETH from 0x protocol fees due to an implementation oddity.
    ///      This behavior shouldn't impact most users.
    ///
    ///      Learn more about the 0x API and quotes at https://0x.org/docs/api
    /// @param zrxSellTokenAddress The contract address of the token to be sold,
    ///        as returned by the 0x `/swap/v1/quote` API endpoint. If selling
    ///        unwrapped ETH included via msg.value, this should be address(0)
    /// @param amountToSell Amount of token to sell, with the same precision as
    ///        zrxSellTokenAddress. This information is also encoded in zrxData.
    ///        If selling unwrapped ETH via msg.value, this should be 0.
    /// @param zrxBuyTokenAddress The contract address of the token to be bought,
    ///        as returned by the 0x `/swap/v1/quote` API endpoint. To buy
    ///        unwrapped ETH, use `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`
    /// @param minimumAmountReceived The minimum amount expected to be received
    ///        from filling the quote, before the swap fee is deducted, in
    ///        zrxBuyTokenAddress. Reverts if not met
    /// @param zrxAllowanceTarget Contract address that needs to be approved for
    ///        zrxSellTokenAddress, as returned by the 0x `/swap/v1/quote` API
    ///        endpoint. Should be address(0) for purchases uses unwrapped ETH
    /// @param zrxTo Contract to fill the 0x quote, as returned by the 0x
    ///        `/swap/v1/quote` API endpoint
    /// @param zrxData Data encoding the 0x quote, as returned by the 0x
    ///        `/swap/v1/quote` API endpoint
    /// @param deadline Timestamp after which the swap will be reverted.
    function swapByQuote(
        address zrxSellTokenAddress,
        uint256 amountToSell,
        address zrxBuyTokenAddress,
        uint256 minimumAmountReceived,
        address zrxAllowanceTarget,
        address payable zrxTo,
        bytes calldata zrxData,
        uint256 deadline
    ) external payable whenNotPaused nonReentrant {
        require(
            block.timestamp <= deadline,
            "Swap::swapByQuote: Deadline exceeded"
        );
        require(
            !signifiesETHOrZero(zrxSellTokenAddress) || msg.value > 0,
            "Swap::swapByQuote: Unwrapped ETH must be swapped via msg.value"
        );

        // if zrxAllowanceTarget is 0, this is an ETH sale
        if (zrxAllowanceTarget != address(0)) {
            // transfer tokens to this contract
            IERC20(zrxSellTokenAddress).safeTransferFrom(msg.sender, address(this), amountToSell);
            // approve token transfer to 0x contracts
            // TODO (handle approval special cases like USDT, KNC, etc)
            IERC20(zrxSellTokenAddress).safeIncreaseAllowance(zrxAllowanceTarget, amountToSell);
        }

        // execute 0x quote
        (uint256 boughtERC20Amount, uint256 boughtETHAmount) = fillZrxQuote(
            IERC20(zrxBuyTokenAddress),
            zrxTo,
            zrxData,
            msg.value
        );

        require(
            (
                !signifiesETHOrZero(zrxBuyTokenAddress) &&
                boughtERC20Amount >= minimumAmountReceived
            ) ||
            (
                signifiesETHOrZero(zrxBuyTokenAddress) &&
                boughtETHAmount >= minimumAmountReceived
            ),
            "Swap::swapByQuote: Minimum swap proceeds requirement not met"
        );
        if (boughtERC20Amount > 0) {
            // take the swap fee from the ERC20 proceeds and return the rest
            uint256 toTransfer = SWAP_FEE_DIVISOR.sub(swapFee).mul(boughtERC20Amount).div(SWAP_FEE_DIVISOR);
            IERC20(zrxBuyTokenAddress).safeTransfer(msg.sender, toTransfer);
            // return any refunded ETH
            payable(msg.sender).transfer(boughtETHAmount);

            emit SwappedTokens(
                zrxSellTokenAddress,
                zrxBuyTokenAddress,
                amountToSell,
                boughtERC20Amount,
                boughtERC20Amount.sub(toTransfer)
            );
        } else {

            // take the swap fee from the ETH proceeds and return the rest. Note
            // that if any 0x protocol fee is refunded in ETH, it also suffers
            // the swap fee tax
            uint256 toTransfer = SWAP_FEE_DIVISOR.sub(swapFee).mul(boughtETHAmount).div(SWAP_FEE_DIVISOR);
            payable(msg.sender).transfer(toTransfer);
            emit SwappedTokens(
                zrxSellTokenAddress,
                zrxBuyTokenAddress,
                amountToSell,
                boughtETHAmount,
                boughtETHAmount.sub(toTransfer)
            );
        }
        if (zrxAllowanceTarget != address(0)) {
            // remove any dangling token allowance
            IERC20(zrxSellTokenAddress).safeApprove(zrxAllowanceTarget, 0);
        }
    }

    /// @notice Fill a 0x quote as provided by the API, and return any ETH or
    ///         ERC20 proceeds.
    /// @dev Learn more at https://0x.org/docs/api
    /// @param zrxBuyTokenAddress The contract address of the token to be bought,
    ///        as provided by the 0x API. `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`
    ///        signifies the user is buying unwrapped ETH.
    /// @param zrxTo Contract to fill the 0x quote, as provided by the 0x API
    /// @param zrxData Data encoding the 0x quote, as provided by the 0x API
    /// @param ethAmount The amount of ETH required to fill the quote, including
    ///        any ETH being traded as well as protocol fees
    /// @return any positive `zrxBuyTokenAddress` ERC20 balance change, as well
    ///         as any positive ETH balance change
    function fillZrxQuote(
        IERC20 zrxBuyTokenAddress,
        address payable zrxTo,
        bytes calldata zrxData,
        uint256 ethAmount
    ) internal returns (uint256, uint256) {
        uint256 originalERC20Balance = 0;
        if(!signifiesETHOrZero(address(zrxBuyTokenAddress))) {
            originalERC20Balance = zrxBuyTokenAddress.balanceOf(address(this));
        }
        uint256 originalETHBalance = address(this).balance;

        (bool success,) = zrxTo.call{value: ethAmount}(zrxData);
        require(success, "Swap::fillZrxQuote: Failed to fill quote");

        uint256 ethDelta = address(this).balance.subOrZero(originalETHBalance);
        uint256 erc20Delta;
        if(!signifiesETHOrZero(address(zrxBuyTokenAddress))) {
            erc20Delta = zrxBuyTokenAddress.balanceOf(address(this)).subOrZero(originalERC20Balance);
            require(erc20Delta > 0, "Swap::fillZrxQuote: Didn't receive bought token");
        } else {
            require(ethDelta > 0, "Swap::fillZrxQuote: Didn't receive bought ETH");
        }

        return (erc20Delta, ethDelta);
    }

    /// @notice Test whether an address is zero, or the magic address the 0x
    ///         platform uses to signify "unwrapped ETH" rather than an ERC20.
    /// @param tokenAddress An address that might point toward an ERC-20.
    function signifiesETHOrZero(address tokenAddress) internal pure returns (bool) {
        return (
            tokenAddress == address(0) ||
            tokenAddress == address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee)
        );
    }

    /// @notice Sweeps accrued ETH and ERC20 swap fees to the pre-established
    ///         fee recipient address.
    /// @dev Fees are tracked based on the contract's balances, rather than
    ///      using any additional bookkeeping. If there are bugs in swap
    ///      accounting, this function could jeopardize funds.
    /// @param tokens An array of ERC20 contracts to withdraw token fees
    function sweepFees(
        address[] calldata tokens
    ) external nonReentrant {
        require(
            feeRecipient != address(0),
            "Swap::withdrawAccruedFees: feeRecipient is not initialized"
        );
        for (uint8 i = 0; i<tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(tokens[i]).safeTransfer(feeRecipient, balance);
                emit FeesSwept(tokens[i], balance, feeRecipient);
            }
        }
        feeRecipient.transfer(address(this).balance);
        emit FeesSwept(address(0), address(this).balance, feeRecipient);
    }

    fallback() external payable {}
    receive() external payable {}
}
