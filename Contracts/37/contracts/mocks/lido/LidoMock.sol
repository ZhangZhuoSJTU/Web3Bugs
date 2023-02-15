// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./StETH.sol";

// This is a simplified version of Lido, which maintains API compatibility on:
// - the token interface
// - entering the pool
// - having a buffer for ether to be validated
// - having a reward scheme
// - implements withdrawal (to simulate future conditions)
contract LidoMock is StETH {
    // The current balance on the beacon chain.
    uint256 internal beaconBalance = 0;
    // Pending ether for submissions to the deposit contract
    uint256 internal bufferedEther = 0;
    // Fee in basis points (0 <= fee <= 1000)
    uint256 internal feeBasis = 100;

    uint256 internal constant DEPOSIT_SIZE = 32 ether;
    uint256 internal constant DEFAULT_MAX_DEPOSITS_PER_CALL = 16;

    // used for mocks, it will force-fail the next deposit or redeem
    bool public mockFailNextDepositOrRedeem;

    constructor(
        uint8 decimals,
        string memory name,
        string memory symbol
    ) StETH(decimals, name, symbol) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /// @notice MOCK ONLY
    function setFailNextDepositOrRedeem(bool fail) public {
        mockFailNextDepositOrRedeem = fail;
    }

    /// @notice Send funds to the pool
    /// @dev Users are able to submit their funds by transacting to the fallback function.
    /// Unlike vanilla Eth2.0 Deposit contract, accepting only 32-Ether transactions, Lido
    /// accepts payments of any size. Submitted Ethers are stored in Buffer until someone calls
    /// depositBufferedEther() and pushes them to the ETH2 Deposit contract.
    receive() external payable {
        _submit(address(0));
    }

    /// @notice Send funds to the pool with optional _referral parameter
    /// @dev This function is alternative way to submit funds. Supports optional referral address.
    /// @return Amount of StETH shares generated
    function submit(address _referral) external payable override returns (uint256) {
        return _submit(_referral);
    }

    // Submit pending ether to the deposit contract.
    function depositBufferedEther() external {
        return _depositBufferedEther(DEFAULT_MAX_DEPOSITS_PER_CALL);
    }

    // Submit pending ether to the deposit contract.
    function depositBufferedEther(uint256 _maxDeposits) external {
        return _depositBufferedEther(_maxDeposits);
    }

    // Update balance based on beacon chain.
    // This can be only called by LidoOracle.
    function pushBeacon(uint256 _beaconValidators, uint256 _beaconBalance) external {
        // Update holdings.
        beaconBalance = _beaconBalance;

        // Simplified.
        distributeRewards(_beaconBalance - (_beaconValidators * DEPOSIT_SIZE));
    }

    /// Withdraw holdings.
    ///
    /// @param _amount Amount of StETH to withdraw.
    ///
    /// @dev This is currently unimplemented in upstream, as it is not possible to withdraw
    ///      before The Merge. However we anticipate that to be turned on before EOY 2022.
    function withdraw(
        uint256 _amount,
        bytes32 /*_pubkeyHash*/
    ) external {
        if (mockFailNextDepositOrRedeem) {
            setFailNextDepositOrRedeem(false);
            revert("random mock failure from lido");
        }

        uint256 redeemable = StETH.getPooledEthByShares(_amount);

        // Simplification: only allow withdrawing buffered ether.
        require(redeemable <= bufferedEther, "Can only withdraw up to the buffered ether.");

        // This validates that enough shares are owned by the account.
        _burnShares(msg.sender, _amount);

        payable(msg.sender).transfer(redeemable);
    }

    // Distribute actual rewards in ether.
    function distributeRewards(uint256 _totalRewards) internal {
        uint256 fees = _totalRewards * feeBasis;
        uint256 sharesToMint = (fees * _getTotalShares()) / ((_getTotalPooledEther() * 1000) - fees);
        _mintShares(address(this), sharesToMint);

        // Transfer to insurance fund
        // Transfer to treasury
    }

    // Adds submitted ether to the buffer.
    function _submit(
        address /*_referral*/
    ) internal returns (uint256) {
        if (mockFailNextDepositOrRedeem) {
            setFailNextDepositOrRedeem(false);
            revert("random mock failure from lido");
        }

        address sender = msg.sender;
        uint256 deposit = msg.value;
        require(deposit != 0, "ZERO_DEPOSIT");

        uint256 sharesAmount = StETH.getSharesByPooledEth(deposit);
        if (sharesAmount == 0) {
            // totalControlledEther is 0: either the first-ever deposit or complete slashing
            // assume that shares correspond to Ether 1-to-1
            sharesAmount = deposit;
        }

        _mintShares(sender, sharesAmount);

        // Store for submission
        bufferedEther += deposit;

        return sharesAmount;
    }

    // Deposit buffered ether.
    function _depositBufferedEther(
        uint256 /*_maxDeposits*/
    ) internal {
        // Enough to submit
        if (bufferedEther >= DEPOSIT_SIZE) {
            uint256 numDeposits = bufferedEther / DEPOSIT_SIZE;
            _ETH2Deposit(numDeposits);
            bufferedEther -= numDeposits * DEPOSIT_SIZE;
        }
    }

    // This would call the deposit contract, we just mimic it by burning the values.
    // solhint-disable-next-line func-name-mixedcase
    function _ETH2Deposit(uint256 _numDeposits) internal {
        beaconBalance += _numDeposits * DEPOSIT_SIZE;
        payable(0).transfer(_numDeposits * DEPOSIT_SIZE);
    }

    // totalSupply() of ETH
    function _getTotalPooledEther() internal view override returns (uint256) {
        return beaconBalance + bufferedEther;
    }

    // MOCK only, used for manipulating Interest Rate
    function _setSharesAndEthBalance(uint256 stEthBalance, uint256 ethBalance) public {
        totalShares = stEthBalance;
        beaconBalance = ethBalance;
        bufferedEther = 0;
    }

    /**
     * @return the amount of shares that corresponds to `_ethAmount` protocol-controlled Ether.
     */
    function getSharesByPooledEth(uint256 _ethAmount) public view override returns (uint256) {
        // no deposits yet, return 1:1 rate
        if (_getTotalPooledEther() == 0) {
            return _ethAmount;
        }
        return StETH.getSharesByPooledEth(_ethAmount);
    }

    /**
     * @return the amount of Ether that corresponds to `_sharesAmount` token shares.
     */
    function getPooledEthByShares(uint256 _sharesAmount) public view override returns (uint256) {
        // no deposits yet, return 1:1 rate
        if (_getTotalShares() == 0) {
            return _sharesAmount;
        }
        return StETH.getPooledEthByShares(_sharesAmount);
    }

    // MOCK ONLY
    function _getInterestRate() public view returns (uint256) {
        return getPooledEthByShares(1e18);
    }
}
