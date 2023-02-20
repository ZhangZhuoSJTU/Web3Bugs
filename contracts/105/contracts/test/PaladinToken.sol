// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../open-zeppelin/ERC20.sol";
import "../open-zeppelin/AccessControl.sol";
import "../open-zeppelin/utils/Math.sol";
import "../open-zeppelin/utils/ECDSA.sol";

/** @title Paladin Token contract  */
/// @author Paladin
contract PaladinToken is ERC20, AccessControl {
    /** @notice The identifier for admin role */
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
    /** @notice The identifier for transfer-allwoed role */
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER");

    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    bytes32 private constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    struct Checkpoint {
        uint32 fromBlock;
        uint224 votes;
    }

    struct DelegateCheckpoint {
        uint32 fromBlock;
        address delegate;
    }

    // Storage :

    /** @notice boolean allowing transfer for all users */
    bool public transfersAllowed = false;

    mapping(address => address) public delegates;

    mapping(address => Checkpoint[]) public checkpoints;

    mapping(address => DelegateCheckpoint[]) public delegateCheckpoints;

    mapping(address => uint256) public nonces;

    // Events :

    /** @notice Emitted when transfer toggle is switched */
    event TransfersAllowed(bool transfersAllowed);

    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    event DelegateVotesChanged(
        address indexed delegate,
        uint256 previousBalance,
        uint256 newBalance
    );

    // Modifiers :

    /** @dev Allows only ADMIN role to call the function */
    modifier onlyAdmin() {
        require(
            hasRole(ADMIN_ROLE, msg.sender),
            "PaladinToken: caller not admin"
        );
        _;
    }

    /** @dev Allows only caller with the TRANSFER role to execute transfer */
    modifier onlyTransferer(address from) {
        require(
            transfersAllowed || hasRole(TRANSFER_ROLE, msg.sender),
            "PaladinToken: caller cannot transfer"
        );
        _;
    }

    constructor(
        uint256 initialSupply,
        address admin,
        address recipient
    ) ERC20("Paladin Token", "PAL") {
        _setupRole(TRANSFER_ROLE, admin);
        _setupRole(TRANSFER_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, admin);
        _setRoleAdmin(TRANSFER_ROLE, ADMIN_ROLE);

        _mint(recipient, initialSupply);
    }

    /** @dev Hook called before any transfer */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override onlyTransferer(from) {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        _moveDelegates(delegates[from], delegates[to], amount);
    }

    function delegate(address delegatee) external virtual {
        return _delegate(_msgSender(), delegatee);
    }

    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual {
        require(block.timestamp <= expiry, "PaladinToken: signature expired");

        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name())), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ecrecover(digest, v, r, s);
        
        require(signer != address(0), "PaladinToken: invalid signature");
        require(nonce == nonces[signer], "PaladinToken: invalid nonce");
        nonces[signer]++;
        return _delegate(signer, delegatee);
    }

    function numCheckpoints(address account)
        external
        view
        virtual
        returns (uint256)
    {
        return checkpoints[account].length;
    }

    function getCurrentVotes(address account) external view returns (uint256) {
        uint256 nbCheckpoints = checkpoints[account].length;
        return
            nbCheckpoints == 0
                ? 0
                : checkpoints[account][nbCheckpoints - 1].votes;
    }

    function getPastVotes(address account, uint256 blockNumber)
        external
        view
        returns (uint256)
    {
        require(
            blockNumber < block.number,
            "PaladinToken: invalid blockNumber"
        );

        // no checkpoints written
        uint256 nbCheckpoints = checkpoints[account].length;
        if (nbCheckpoints == 0) return 0;

        // last checkpoint check
        if (checkpoints[account][nbCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nbCheckpoints - 1].votes;
        }

        // no checkpoint old enough
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint256 high = nbCheckpoints - 1; // last checkpoint already checked
        uint256 low = 0;
        uint256 mid;
        while (low < high) {
            mid = Math.average(low, high);
            if (checkpoints[account][mid].fromBlock == blockNumber) {
                return checkpoints[account][mid].votes;
            }
            if (checkpoints[account][mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high == 0 ? 0 : checkpoints[account][high - 1].votes;
    }

    function getPastDelegate(address account, uint256 blockNumber)
        external
        view
        returns (address)
    {
        require(
            blockNumber < block.number,
            "PaladinToken: invalid blockNumber"
        );

        // no checkpoints written
        uint256 nbCheckpoints = delegateCheckpoints[account].length;
        if (nbCheckpoints == 0) return address(0);

        // last checkpoint check
        if (delegateCheckpoints[account][nbCheckpoints - 1].fromBlock <= blockNumber) {
            return delegateCheckpoints[account][nbCheckpoints - 1].delegate;
        }

        // no checkpoint old enough
        if (delegateCheckpoints[account][0].fromBlock > blockNumber) {
            return address(0);
        }

        uint256 high = nbCheckpoints - 1; // last checkpoint already checked
        uint256 low = 0;
        uint256 mid;
        while (low < high) {
            mid = Math.average(low, high);
            if (delegateCheckpoints[account][mid].fromBlock == blockNumber) {
                return delegateCheckpoints[account][mid].delegate;
            }
            if (delegateCheckpoints[account][mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high == 0 ? address(0) : delegateCheckpoints[account][high - 1].delegate;
    }

    function _delegate(address delegator, address delegatee) internal {
        address oldDelegatee = delegates[delegator];
        uint256 delegatorBalance = balanceOf(delegator);
        delegates[delegator] = delegatee;

        delegateCheckpoints[delegator].push(DelegateCheckpoint(safe32(block.number), delegatee));

        emit DelegateChanged(delegator, oldDelegatee, delegatee);

        _moveDelegates(oldDelegatee, delegatee, delegatorBalance);
    }

    function _moveDelegates(
        address from,
        address to,
        uint256 amount
    ) internal {
        if (from != to && amount > 0) {
            if (from != address(0)) {
                uint256 nbCheckpoints = checkpoints[from].length;
                uint256 oldVotes = nbCheckpoints == 0 ? 0 : checkpoints[from][nbCheckpoints - 1].votes;
                uint256 newVotes = oldVotes - amount;
                _writeCheckpoint(from, newVotes);
                emit DelegateVotesChanged(from, oldVotes, newVotes);
            }

            if (to != address(0)) {
                uint256 nbCheckpoints = checkpoints[to].length;
                uint256 oldVotes = nbCheckpoints == 0 ? 0 : checkpoints[to][nbCheckpoints - 1].votes;
                uint256 newVotes = oldVotes + amount;
                _writeCheckpoint(to, newVotes);
                emit DelegateVotesChanged(to, oldVotes, newVotes);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint256 newVotes
    ) internal {
        uint pos = checkpoints[delegatee].length;

        if (pos > 0 && checkpoints[delegatee][pos - 1].fromBlock == block.number) {
            checkpoints[delegatee][pos - 1].votes = safe224(newVotes);
        } else {
            uint32 blockNumber = safe32(block.number);
            checkpoints[delegatee].push(Checkpoint(blockNumber, safe224(newVotes)));
        }
    }

    function safe32(uint n) internal pure returns (uint32) {
        require(n <= type(uint32).max, "PaladinToken : block number exceed 32 bits");
        return uint32(n);
    }

    function safe224(uint n) internal pure returns (uint224) {
        require(n <= type(uint224).max, "PaladinToken : amount exceed 224 bits");
        return uint224(n);
    }

    function getChainId() internal view returns (uint) {
        uint256 chainId;
        assembly { chainId := chainid() }
        return chainId;
    }



    // Admin methods :

    /**
     * @notice Allow/Block transfer for all users
     * @dev Change transfersAllowed flag
     * @param _transfersAllowed bool : true to allow Transfer, false to block
     */
    function setTransfersAllowed(bool _transfersAllowed) external onlyAdmin {
        transfersAllowed = _transfersAllowed;
        emit TransfersAllowed(transfersAllowed);
    }
}
