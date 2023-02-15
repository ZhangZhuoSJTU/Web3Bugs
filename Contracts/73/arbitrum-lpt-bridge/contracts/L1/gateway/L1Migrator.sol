// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {L1ArbitrumMessenger} from "./L1ArbitrumMessenger.sol";
import {IL1LPTGateway} from "./IL1LPTGateway.sol";
import {IMigrator} from "../../interfaces/IMigrator.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IBondingManager {
    function isRegisteredTranscoder(address _addr) external view returns (bool);

    function pendingStake(address _addr, uint256 _endRound)
        external
        view
        returns (uint256);

    function pendingFees(address _addr, uint256 _endRound)
        external
        view
        returns (uint256);

    function getDelegator(address _addr)
        external
        view
        returns (
            uint256 bondedAmount,
            uint256 fees,
            address delegateAddress,
            uint256 delegatedAmount,
            uint256 startRound,
            uint256 lastClaimRound,
            uint256 nextUnbondingLockId
        );

    function getDelegatorUnbondingLock(address _addr, uint256 _unbondingLockId)
        external
        view
        returns (uint256 amount, uint256 withdrawRound);
}

interface ITicketBroker {
    struct Sender {
        uint256 deposit;
        uint256 withdrawRound;
    }

    struct ReserveInfo {
        uint256 fundsRemaining;
        uint256 claimedInCurrentRound;
    }

    function getSenderInfo(address _addr)
        external
        view
        returns (Sender memory sender, ReserveInfo memory reserve);
}

interface IBridgeMinter {
    function withdrawETHToL1Migrator() external returns (uint256);

    function withdrawLPTToL1Migrator() external returns (uint256);
}

interface ApproveLike {
    function approve(address _addr, uint256 _amount) external;
}

interface IL2Migrator is IMigrator {
    function finalizeMigrateDelegator(MigrateDelegatorParams memory _params)
        external;

    function finalizeMigrateUnbondingLocks(
        MigrateUnbondingLocksParams memory _params
    ) external;

    function finalizeMigrateSender(MigrateSenderParams memory _params) external;
}

contract L1Migrator is
    L1ArbitrumMessenger,
    IMigrator,
    EIP712,
    AccessControl,
    Pausable
{
    address public immutable bondingManagerAddr;
    address public immutable ticketBrokerAddr;
    address public immutable bridgeMinterAddr;
    address public immutable tokenAddr;
    address public immutable l1LPTGatewayAddr;
    address public immutable l2MigratorAddr;

    event MigrateDelegatorInitiated(
        uint256 indexed seqNo,
        MigrateDelegatorParams params
    );

    event MigrateUnbondingLocksInitiated(
        uint256 indexed seqNo,
        MigrateUnbondingLocksParams params
    );

    event MigrateSenderInitiated(
        uint256 indexed seqNo,
        MigrateSenderParams params
    );

    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    bytes32 private constant MIGRATE_DELEGATOR_TYPE_HASH =
        keccak256("MigrateDelegator(address l1Addr,address l2Addr)");

    bytes32 private constant MIGRATE_UNBONDING_LOCKS_TYPE_HASH =
        keccak256(
            "MigrateUnbondingLocks(address l1Addr,address l2Addr,uint256[] unbondingLockIds)"
        );

    bytes32 private constant MIGRATE_SENDER_TYPE_HASH =
        keccak256("MigrateSender(address l1Addr,address l2Addr)");

    constructor(
        address _inbox,
        address _bondingManagerAddr,
        address _ticketBrokerAddr,
        address _bridgeMinterAddr,
        address _tokenAddr,
        address _l1LPTGatewayAddr,
        address _l2MigratorAddr
    ) L1ArbitrumMessenger(_inbox) EIP712("Livepeer L1Migrator", "1") {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setRoleAdmin(GOVERNOR_ROLE, DEFAULT_ADMIN_ROLE);

        bondingManagerAddr = _bondingManagerAddr;
        ticketBrokerAddr = _ticketBrokerAddr;
        bridgeMinterAddr = _bridgeMinterAddr;
        tokenAddr = _tokenAddr;
        l1LPTGatewayAddr = _l1LPTGatewayAddr;
        l2MigratorAddr = _l2MigratorAddr;

        _pause();
    }

    /**
     * @notice Executes a L2 call to L2Migrator to migrate transcoder/delegator state from the L1 BondingManager.
     * @dev The term "delegator" here can refer to both a transcoder (self-delegated delegator) and delegator.
     * @param _l1Addr Address migrating from L1
     * @param _l2Addr Address to use on L2
     * @param _sig Optional EIP-712 signature over a payload that includes _l1Addr and _l2Addr
     * @param _maxGas Gas limit for L2 execution
     * @param _gasPriceBid Gas price bid for L2 execution
     * @param _maxSubmissionCost Max ETH to pay for retryable ticket base submission fee
     */
    function migrateDelegator(
        address _l1Addr,
        address _l2Addr,
        bytes memory _sig,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost
    ) external payable whenNotPaused {
        // Authorization
        // Either msg.sender == _l1Addr OR signer for _sig == _l1Addr
        requireValidMigration(
            _l1Addr,
            _l2Addr,
            keccak256(
                abi.encode(MIGRATE_DELEGATOR_TYPE_HASH, _l1Addr, _l2Addr)
            ),
            _sig
        );

        (
            bytes memory data,
            MigrateDelegatorParams memory params
        ) = getMigrateDelegatorParams(_l1Addr, _l2Addr);

        // We do not prevent migration replays here to minimize L1 gas costs
        // The L2Migrator is responsible for rejecting migration replays

        uint256 seqNo = sendTxToL2(
            l2MigratorAddr,
            _l2Addr, // Refunds to the L2 address
            _maxSubmissionCost,
            _maxGas,
            _gasPriceBid,
            data
        );

        emit MigrateDelegatorInitiated(seqNo, params);
    }

    /**
     * @notice Executes a L2 call to L2Migrator to migrate unbonding locks state from the L1 BondingManager.
     * @param _l1Addr Address migrating from L1
     * @param _l2Addr Address to use on L2
     * @param _unbondingLockIds IDs of unbonding locks in the L1 BondingManager to migrate
     * @param _sig Optional EIP-712 signature over a payload that includes _l1Addr, _l2Addr and _unbondingLockIds
     * @param _maxGas Gas limit for L2 execution
     * @param _gasPriceBid Gas price bid for L2 execution
     * @param _maxSubmissionCost Max ETH to pay for retryable ticket base submission fee
     */
    function migrateUnbondingLocks(
        address _l1Addr,
        address _l2Addr,
        uint256[] calldata _unbondingLockIds,
        bytes memory _sig,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost
    ) external payable whenNotPaused {
        // Authorization
        // Either msg.sender == _l1Addr OR signer for _sig == _l1Addr
        requireValidMigration(
            _l1Addr,
            _l2Addr,
            keccak256(
                abi.encode(
                    MIGRATE_UNBONDING_LOCKS_TYPE_HASH,
                    _l1Addr,
                    _l2Addr,
                    keccak256(abi.encodePacked(_unbondingLockIds))
                )
            ),
            _sig
        );

        (
            bytes memory data,
            MigrateUnbondingLocksParams memory params
        ) = getMigrateUnbondingLocksParams(_l1Addr, _l2Addr, _unbondingLockIds);

        // We do not prevent migration replays here to minimize L1 gas costs
        // The L2Migrator is responsible for rejecting migration replays

        uint256 seqNo = sendTxToL2(
            l2MigratorAddr,
            _l2Addr, // Refund to the L2 address
            _maxSubmissionCost,
            _maxGas,
            _gasPriceBid,
            data
        );

        emit MigrateUnbondingLocksInitiated(seqNo, params);
    }

    /**
     * @notice Executes a L2 call to L2Migrator to migrate sender deposit/reserve state from the L1 TicketBroker.
     * @param _l1Addr Address migrating from L1
     * @param _l2Addr Address to use on L2
     * @param _sig Optional EIP-712 signature over a payload that includes _l1Addr and _l2Addr
     * @param _maxGas Gas limit for L2 execution
     * @param _gasPriceBid Gas price bid for L2 execution
     * @param _maxSubmissionCost Max ETH to pay for retryable ticket base submission fee
     */
    function migrateSender(
        address _l1Addr,
        address _l2Addr,
        bytes memory _sig,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost
    ) external payable whenNotPaused {
        // Authorization
        // Either msg.sender == _l1Addr OR signer for _sig == _l1Addr
        requireValidMigration(
            _l1Addr,
            _l2Addr,
            keccak256(abi.encode(MIGRATE_SENDER_TYPE_HASH, _l1Addr, _l2Addr)),
            _sig
        );

        (
            bytes memory data,
            MigrateSenderParams memory params
        ) = getMigrateSenderParams(_l1Addr, _l2Addr);

        // We do not prevent migration replays here to minimize L1 gas costs
        // The L2Migrator is responsible for rejecting migration replays

        uint256 seqNo = sendTxToL2(
            l2MigratorAddr,
            _l2Addr, // Refund to the L2 address
            _maxSubmissionCost,
            _maxGas,
            _gasPriceBid,
            data
        );

        emit MigrateSenderInitiated(seqNo, params);
    }

    /**
     * @notice Executes a L2 call to send ETH from the L1BridgeMinter to the L2Migrator.
     * @dev Anyone can call this function.
     * @param _maxGas Gas limit for L2 execution
     * @param _gasPriceBid Gas price bid for L2 execution
     * @param _maxSubmissionCost Max ETH to pay for retryable ticket base submission fee
     */
    function migrateETH(
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost
    ) external payable whenNotPaused {
        uint256 amount = IBridgeMinter(bridgeMinterAddr)
            .withdrawETHToL1Migrator();

        // Any ETH refunded to the L2 alias of this contract can be used for
        // other cross-chain txs sent by this contract.
        // The retryable ticket created will not be cancellable since this contract
        // currently does not support cross-chain txs to call ArbRetryableTx.cancel().
        // Regarding the comment below on this contract receiving refunds:
        // msg.sender also cannot be the address to receive refunds as beneficiary because otherwise
        // msg.sender could cancel the ticket before it is executed on L2 to receive the L2 call value.
        sendTxToL2(
            l2MigratorAddr,
            address(this), // L2 alias of this contract will receive refunds
            msg.value,
            amount,
            _maxSubmissionCost,
            _maxGas,
            _gasPriceBid,
            ""
        );
    }

    /**
     * @notice Executes a L2 call to send LPT from the L1BridgeMinter to the L2Migrator.
     * @dev Anyone can call this function.
     * @param _maxGas Gas limit for L2 execution
     * @param _gasPriceBid Gas price bid for L2 execution
     * @param _maxSubmissionCost Max ETH to pay for retryable ticket base submission fee
     */
    function migrateLPT(
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost
    ) external payable whenNotPaused {
        uint256 amount = IBridgeMinter(bridgeMinterAddr)
            .withdrawLPTToL1Migrator();

        // Approve L1LPTGateway to pull tokens
        ApproveLike(tokenAddr).approve(l1LPTGatewayAddr, amount);
        // Trigger cross-chain transfer with L1LPTGateway which will pull and escrow tokens
        // Forward msg.value to outboundTransfer() to be used for cross-chain tx
        IL1LPTGateway(l1LPTGatewayAddr).outboundTransfer{value: msg.value}(
            tokenAddr,
            l2MigratorAddr,
            amount,
            _maxGas,
            _gasPriceBid,
            abi.encode(_maxSubmissionCost, "")
        );
    }

    /**
     * @notice Pause the contract
     * @dev Only callable by addresses with governor role
     */
    function pause() external onlyRole(GOVERNOR_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the contract
     * @dev Only callable by addresses with governor role
     */
    function unpause() external onlyRole(GOVERNOR_ROLE) {
        _unpause();
    }

    /**
     * @notice Return L2 calldata and MigrateDelegatorParams to use for a L2 call on L2Migrator
     * @param _l1Addr Address migrating from L1
     * @param _l2Addr Address to use on L2
     * @return data L2 calldata for finalizeMigrateDelegator() in L2Migrator
     * @return params MigrateDelegatorParams to use for finalizeMigrateDelegator() in L2Migrator
     */
    function getMigrateDelegatorParams(address _l1Addr, address _l2Addr)
        public
        view
        returns (bytes memory data, MigrateDelegatorParams memory params)
    {
        IBondingManager bondingManager = IBondingManager(bondingManagerAddr);

        // pendingStake() ignores the _endRound arg
        uint256 stake = bondingManager.pendingStake(_l1Addr, 0);
        // pendingFees() ignores the _endRound arg
        uint256 fees = bondingManager.pendingFees(_l1Addr, 0);
        (
            ,
            ,
            address delegateAddress,
            uint256 delegatedAmount,
            ,
            ,

        ) = bondingManager.getDelegator(_l1Addr);

        // Construct params and L2 calldata for finalizeMigrateDelegator() on L2Migrator
        params = MigrateDelegatorParams({
            l1Addr: _l1Addr,
            l2Addr: _l2Addr,
            stake: stake,
            delegatedStake: delegatedAmount,
            fees: fees,
            delegate: delegateAddress
        });

        data = abi.encodeWithSelector(
            IL2Migrator.finalizeMigrateDelegator.selector,
            params
        );
    }

    /**
     * @notice Return L2 calldata and MigrateSenderParams to use for a L2 call on L2Migrator
     * @param _l1Addr Address migrating from L1
     * @param _l2Addr Address to use on L2
     * @return data L2 calldata for finalizeMigrateSender() in L2Migrator
     * @return params MigrateSenderParams to use for finalizeMigrateSender() in L2Migrator
     */
    function getMigrateSenderParams(address _l1Addr, address _l2Addr)
        public
        view
        returns (bytes memory data, MigrateSenderParams memory params)
    {
        ITicketBroker ticketBroker = ITicketBroker(ticketBrokerAddr);

        (
            ITicketBroker.Sender memory sender,
            ITicketBroker.ReserveInfo memory reserveInfo
        ) = ticketBroker.getSenderInfo(_l1Addr);

        // Construct params and L2 calldata for finalizeMigrateSender() on L2Migrator
        params = MigrateSenderParams({
            l1Addr: _l1Addr,
            l2Addr: _l2Addr,
            deposit: sender.deposit,
            reserve: reserveInfo.fundsRemaining
        });

        data = abi.encodeWithSelector(
            IL2Migrator.finalizeMigrateSender.selector,
            params
        );
    }

    /**
     * @notice Return L2 calldata and MigrateUnbondingLocksParams to use for a L2 call on L2Migrator
     * @param _l1Addr Address migrating from L1
     * @param _l2Addr Address to use on L2
     * @param _unbondingLockIds IDs of unbonding locks in L1 BondingManager to migrate
     * @return data L2 calldata for finalizeMigrateUnbondingLocks() in L2Migrator
     * @return params MigrateUnbondingLocksParams to use for finalizeMigrateUnbondingLocks() in L2Migrator
     */
    function getMigrateUnbondingLocksParams(
        address _l1Addr,
        address _l2Addr,
        uint256[] memory _unbondingLockIds
    )
        public
        view
        returns (bytes memory data, MigrateUnbondingLocksParams memory params)
    {
        IBondingManager bondingManager = IBondingManager(bondingManagerAddr);

        uint256 total = 0;
        for (uint256 i = 0; i < _unbondingLockIds.length; i++) {
            (uint256 amount, ) = bondingManager.getDelegatorUnbondingLock(
                _l1Addr,
                _unbondingLockIds[i]
            );

            total += amount;
        }

        (, , address delegateAddress, , , , ) = bondingManager.getDelegator(
            _l1Addr
        );

        // Construct params and L2 calldata for finalizeMigrateUnbondingLocks() on L2Migrator
        params = MigrateUnbondingLocksParams({
            l1Addr: _l1Addr,
            l2Addr: _l2Addr,
            total: total,
            unbondingLockIds: _unbondingLockIds,
            delegate: delegateAddress
        });

        data = abi.encodeWithSelector(
            IL2Migrator.finalizeMigrateUnbondingLocks.selector,
            params
        );
    }

    function requireValidMigration(
        address _l1Addr,
        address _l2Addr,
        bytes32 _structHash,
        bytes memory _sig
    ) internal view {
        require(
            _l2Addr != address(0),
            "L1Migrator#requireValidMigration: INVALID_L2_ADDR"
        );
        require(
            msg.sender == _l1Addr ||
                recoverSigner(_structHash, _sig) == _l1Addr,
            "L1Migrator#requireValidMigration: FAIL_AUTH"
        );
    }

    function recoverSigner(bytes32 _structHash, bytes memory _sig)
        internal
        view
        returns (address)
    {
        if (_sig.length == 0) {
            return address(0);
        }

        bytes32 hash = _hashTypedDataV4(_structHash);
        return ECDSA.recover(hash, _sig);
    }
}
