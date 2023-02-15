// SPDX-FileCopyrightText: 2020 Lido <info@lido.fi>

// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

/**
 * @title Liquid staking pool
 *
 * For the high-level description of the pool operation please refer to the paper.
 * Pool manages withdrawal keys and fees. It receives ether submitted by users on the ETH 1 side
 * and stakes it via the deposit_contract.sol contract. It doesn't hold ether on it's balance,
 * only a small portion (buffer) of it.
 * It also mints new tokens for rewards generated at the ETH 2.0 side.
 */
interface ILido {
    /**
     * @dev From ISTETH interface, because "Interfaces cannot inherit".
     */
    function totalSupply() external view returns (uint256);

    function getTotalShares() external view returns (uint256);

    /**
     * @notice Stop pool routine operations
     */
    function stop() external;

    /**
     * @notice Resume pool routine operations
     */
    function resume() external;

    event Stopped();
    event Resumed();

    /**
     * @notice Set fee rate to `_feeBasisPoints` basis points. The fees are accrued when oracles report staking results
     * @param _feeBasisPoints Fee rate, in basis points
     */
    function setFee(uint16 _feeBasisPoints) external;

    /**
     * @notice Set fee distribution: `_treasuryFeeBasisPoints` basis points go to the treasury, `_insuranceFeeBasisPoints` basis points go to the insurance fund, `_operatorsFeeBasisPoints` basis points go to node operators. The sum has to be 10 000.
     */
    function setFeeDistribution(
        uint16 _treasuryFeeBasisPoints,
        uint16 _insuranceFeeBasisPoints,
        uint16 _operatorsFeeBasisPoints
    ) external;

    /**
     * @notice Returns staking rewards fee rate
     */
    function getFee() external view returns (uint16 feeBasisPoints);

    /**
     * @notice Returns fee distribution proportion
     */
    function getFeeDistribution()
        external
        view
        returns (
            uint16 treasuryFeeBasisPoints,
            uint16 insuranceFeeBasisPoints,
            uint16 operatorsFeeBasisPoints
        );

    event FeeSet(uint16 feeBasisPoints);

    event FeeDistributionSet(
        uint16 treasuryFeeBasisPoints,
        uint16 insuranceFeeBasisPoints,
        uint16 operatorsFeeBasisPoints
    );

    /**
     * @notice Set credentials to withdraw ETH on ETH 2.0 side after the phase 2 is launched to `_withdrawalCredentials`
     * @dev Note that setWithdrawalCredentials discards all unused signing keys as the signatures are invalidated.
     * @param _withdrawalCredentials hash of withdrawal multisignature key as accepted by
     *        the deposit_contract.deposit function
     */
    function setWithdrawalCredentials(bytes32 _withdrawalCredentials) external;

    /**
     * @notice Returns current credentials to withdraw ETH on ETH 2.0 side after the phase 2 is launched
     */
    function getWithdrawalCredentials() external view returns (bytes memory);

    event WithdrawalCredentialsSet(bytes32 withdrawalCredentials);

    /**
     * @notice Ether on the ETH 2.0 side reported by the oracle
     * @param _epoch Epoch id
     * @param _eth2balance Balance in wei on the ETH 2.0 side
     */
    function pushBeacon(uint256 _epoch, uint256 _eth2balance) external;

    // User functions

    /**
     * @notice Adds eth to the pool
     * @return StETH Amount of StETH generated
     */
    function submit(address _referral) external payable returns (uint256 StETH);

    // Records a deposit made by a user
    event Submitted(address indexed sender, uint256 amount, address referral);

    // The `_amount` of ether was sent to the deposit_contract.deposit function.
    event Unbuffered(uint256 amount);

    /**
     * @notice Issues withdrawal request. Large withdrawals will be processed only after the phase 2 launch.
     * @param _amount Amount of StETH to burn
     * @param _pubkeyHash Receiving address
     */
    function withdraw(uint256 _amount, bytes32 _pubkeyHash) external;

    // Requested withdrawal of `etherAmount` to `pubkeyHash` on the ETH 2.0 side, `tokenAmount` burned by `sender`,
    // `sentFromBuffer` was sent on the current Ethereum side.
    event Withdrawal(
        address indexed sender,
        uint256 tokenAmount,
        uint256 sentFromBuffer,
        bytes32 indexed pubkeyHash,
        uint256 etherAmount
    );

    // Info functions

    /**
     * @notice Gets the amount of Ether controlled by the system
     */
    function getTotalPooledEther() external view returns (uint256);

    /**
     * @notice Gets the amount of Ether temporary buffered on this contract balance
     */
    function getBufferedEther() external view returns (uint256);

    /**
     * @notice Returns the key values related to Beacon-side
     * @return depositedValidators - number of deposited validators
     * @return beaconValidators - number of Lido's validators visible in the Beacon state, reported by oracles
     * @return beaconBalance - total amount of Beacon-side Ether (sum of all the balances of Lido validators)
     */
    function getBeaconStat()
        external
        view
        returns (
            uint256 depositedValidators,
            uint256 beaconValidators,
            uint256 beaconBalance
        );
}
