// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.2;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IYieldSource } from "@pooltogether/yield-source-interface/contracts/IYieldSource.sol";
import { ISavingsContractV2 } from "@mstable/protocol/contracts/interfaces/ISavingsContract.sol";

contract MStableYieldSource is IYieldSource, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ISavingsContractV2 public immutable savings;
    IERC20 public immutable mAsset;

    /// @notice mapping of account addresses to interest-bearing mAsset balances. eg imUSD
    mapping(address => uint256) public imBalances;

    /// @notice Emitted on init
    /// @param savings The ISavingsContractV2 to bind to
    event Initialized(ISavingsContractV2 indexed savings);

    /// @notice Emitted when asset tokens are supplied to sponsor the yield source
    /// @param sponsor The address who sponsored
    /// @param mAssetAmount The amount of deposit token that was sponsored
    event Sponsored(address indexed sponsor, uint256 mAssetAmount);

    /// @notice Emitted when asset tokens are supplied to earn yield
    /// @param from The address who supplied the assets
    /// @param to The new owner of the assets
    /// @param amount The amount of assets supplied
    event Supplied(address indexed from, address indexed to, uint256 amount);

    /// @notice Emitted when asset tokens are redeemed from the yield source
    /// @param from The address who is redeeming
    /// @param requestedAmount The amount that was requested to withdraw
    /// @param actualAmount The actual amount of assets transferred to the address
    event Redeemed(address indexed from, uint256 requestedAmount, uint256 actualAmount);

    /// @notice Approves max spend by the mAsset
    /// @param from The user who triggered approve max
    event ApprovedMax(address indexed from);

    constructor(ISavingsContractV2 _savings) ReentrancyGuard() {
        // As immutable storage variables can not be accessed in the constructor,
        // create in-memory variables that can be used instead.
        IERC20 mAssetMemory = IERC20(_savings.underlying());

        // infinite approve Savings Contract to transfer mAssets from this contract
        mAssetMemory.safeApprove(address(_savings), type(uint256).max);

        // save to immutable storage
        savings = _savings;
        mAsset = mAssetMemory;

        emit Initialized(_savings);
    }

    /// @notice Approves of the max spend amount for the Savings contract.
    function approveMax() public {
        IERC20(savings.underlying()).safeApprove(address(savings), type(uint256).max);

        emit ApprovedMax(msg.sender);
    }

    /// @notice Returns the ERC20 mAsset token used for deposits
    /// @return underlyingMasset Underlying mAsset token address. eg mUSD
    function depositToken() public view override returns (address underlyingMasset) {
        underlyingMasset = address(mAsset);
    }

    /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
    /// @return mAssets The underlying balance of mAsset tokens. eg mUSD
    function balanceOfToken(address addr) external view override returns (uint256 mAssets) {
        uint256 exchangeRate = savings.exchangeRate();
        mAssets = (imBalances[addr] * exchangeRate) / 1e18;
    }

    /// @notice Deposits mAsset tokens to the savings contract.
    /// @param mAssetAmount The amount of mAsset tokens to be deposited. eg mUSD
    function supplyTokenTo(uint256 mAssetAmount, address to) external override nonReentrant {
        mAsset.safeTransferFrom(msg.sender, address(this), mAssetAmount);
        uint256 creditsIssued = savings.depositSavings(mAssetAmount);
        imBalances[to] += creditsIssued;

        emit Supplied(msg.sender, to, mAssetAmount);
    }

    /// @notice Redeems mAsset tokens from the interest-beaing mAsset.
    ///         eg. redeems mUSD from imUSD.
    /// @param mAssetAmount The amount of mAsset tokens requested to be redeemed. eg mUSD
    /// @return mAssetsActual The actual amount of mAsset tokens that were received from the redeem. eg mUSD
    function redeemToken(uint256 mAssetAmount)
        external
        override
        nonReentrant
        returns (uint256 mAssetsActual)
    {   
        uint256 mAssetBalanceBefore = mAsset.balanceOf(address(this));

        uint256 creditsBurned = savings.redeemUnderlying(mAssetAmount);

        imBalances[msg.sender] -= creditsBurned;
        uint256 mAssetBalanceAfter = mAsset.balanceOf(address(this));
        mAssetsActual = mAssetBalanceAfter - mAssetBalanceBefore;

        mAsset.safeTransfer(msg.sender, mAssetsActual);

        emit Redeemed(msg.sender, mAssetAmount, mAssetsActual);
    }
}
