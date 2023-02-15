// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "interfaces/notional/NotionalProxy.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../../proxy/utils/UUPSUpgradeable.sol";

/// @title Note ERC20 Token
/// Fork of Compound Comp token at commit hash
/// https://github.com/compound-finance/compound-protocol/commit/9bcff34a5c9c76d51e51bcb0ca1139588362ef96
contract NoteERC20 is Initializable, UUPSUpgradeable {
    /// @notice EIP-20 token name for this token
    string public constant name = "Notional";

    /// @notice EIP-20 token symbol for this token
    string public constant symbol = "NOTE";

    /// @notice EIP-20 token decimals for this token
    uint8 public constant decimals = 8;

    /// @notice Total number of tokens in circulation (100 million NOTE)
    uint256 public constant totalSupply = 100000000e8;

    /// @notice Notional router address
    NotionalProxy public notionalProxy;

    // Allowance amounts on behalf of others
    mapping(address => mapping(address => uint96)) internal allowances;

    // Official record of token balances for each account
    mapping(address => uint96) internal balances;

    /// @notice A record of each accounts delegate
    mapping(address => address) public delegates;

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint96 votes;
    }

    /// @notice A record of votes checkpoints for each account, by index
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping(address => uint32) public numCheckpoints;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping(address => uint256) public nonces;

    /// @notice Owner address which can upgrade the tokens implementation
    address public owner;

    /// @notice Emitted when the ownership of the contract is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(
        address indexed delegate,
        uint256 previousBalance,
        uint256 newBalance
    );

    /// @notice The standard EIP-20 transfer event
    event Transfer(address indexed from, address indexed to, uint256 amount);

    /// @notice The standard EIP-20 approval event
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    /// @notice Initialize note token with initial grants
    /// @param initialAccounts initial address to grant tokens to
    /// @param initialGrantAmount amount to grant address initially
    function initialize(
        address[] calldata initialAccounts,
        uint96[] calldata initialGrantAmount,
        address owner_
    ) public initializer {
        require(initialGrantAmount.length == initialAccounts.length);

        uint96 totalGrants = 0;
        for (uint256 i = 0; i < initialGrantAmount.length; i++) {
            totalGrants = _add96(totalGrants, initialGrantAmount[i], "");
            require(balances[initialAccounts[i]] == 0, "Duplicate account");
            balances[initialAccounts[i]] = initialGrantAmount[i];

            emit Transfer(address(0), initialAccounts[i], initialGrantAmount[i]);
        }

        require(totalGrants == totalSupply);
        owner = owner_;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function activateNotional(NotionalProxy notionalProxy_) external onlyOwner {
        require(address(notionalProxy) == address(0), "Notional Proxy already initialized");
        Address.isContract(address(notionalProxy_));
        notionalProxy = notionalProxy_;
    }

    /// @dev Transfers ownership of the contract to a new account (`newOwner`).
    /// Can only be called by the current owner.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @dev Only the owner may upgrade the contract
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }

    /// @notice Get the number of tokens `spender` is approved to spend on behalf of `account`
    /// @param account The address of the account holding the funds
    /// @param spender The address of the account spending the funds
    /// @return The number of tokens approved
    function allowance(address account, address spender) external view returns (uint256) {
        return allowances[account][spender];
    }

    /// @notice Approve `spender` to transfer up to `amount` from `src`
    /// @dev This will overwrite the approval amount for `spender`
    ///  and is subject to issues noted [here](https://eips.ethereum.org/EIPS/eip-20#approve)
    ///  emit:Approval
    /// @param spender The address of the account which may transfer tokens
    /// @param rawAmount The number of tokens that are approved (2^256-1 means infinite)
    /// @return Whether or not the approval succeeded
    function approve(address spender, uint256 rawAmount) external returns (bool) {
        uint96 amount;
        if (rawAmount == uint256(-1)) {
            amount = uint96(-1);
        } else {
            amount = _safe96(rawAmount, "Note::approve: amount exceeds 96 bits");
        }

        allowances[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @notice Get the number of tokens held by the `account`
    /// @param account The address of the account to get the balance of
    /// @return The number of tokens held
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    /// @notice Transfer `amount` tokens from `msg.sender` to `dst`
    /// @dev emit:Transfer
    /// @param dst The address of the destination account
    /// @param rawAmount The number of tokens to transfer
    /// @return Whether or not the transfer succeeded
    function transfer(address dst, uint256 rawAmount) external returns (bool) {
        uint96 amount = _safe96(rawAmount, "Note::transfer: amount exceeds 96 bits");
        _transferTokens(msg.sender, dst, amount);
        return true;
    }

    /// @notice Transfer `amount` tokens from `src` to `dst`
    /// @dev emit:Transfer emit:Approval
    /// @param src The address of the source account
    /// @param dst The address of the destination account
    /// @param rawAmount The number of tokens to transfer
    /// @return Whether or not the transfer succeeded
    function transferFrom(
        address src,
        address dst,
        uint256 rawAmount
    ) external returns (bool) {
        // Short circuit transfer execution and return true. It may be the case that external
        // logic tries to execute a zero transfer but don't emit events here.
        if (rawAmount == 0) {
            // Emit a zero transfer event for ERC20 token compatibility
            emit Transfer(src, dst, 0);
            return true;
        }

        address spender = msg.sender;
        uint96 spenderAllowance = allowances[src][spender];
        uint96 amount = _safe96(rawAmount, "Note::approve: amount exceeds 96 bits");

        if (spender != src && spenderAllowance != uint96(-1)) {
            uint96 newAllowance =
                _sub96(
                    spenderAllowance,
                    amount,
                    "Note::transferFrom: transfer amount exceeds spender allowance"
                );
            allowances[src][spender] = newAllowance;

            emit Approval(src, spender, newAllowance);
        }

        _transferTokens(src, dst, amount);
        return true;
    }

    /// @notice Delegate votes from `msg.sender` to `delegatee`
    /// @param delegatee The address to delegate votes to
    /// @dev emit:DelegatesChanged
    function delegate(address delegatee) public {
        _delegate(msg.sender, delegatee);
    }

    /// @notice Delegates votes from signatory to `delegatee`
    /// @dev emit:DelegatesChanged
    /// @param delegatee The address to delegate votes to
    /// @param nonce The contract state required to match the signature
    /// @param expiry The time at which to expire the signature
    /// @param v The recovery byte of the signature
    /// @param r Half of the ECDSA signature pair
    /// @param s Half of the ECDSA signature pair
    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        bytes32 domainSeparator =
            keccak256(
                abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), _getChainId(), address(this))
            );
        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        // ECDSA will check if address is zero inside
        address signatory = ECDSA.recover(digest, v, r, s);
        require(nonce == nonces[signatory]++, "Note::delegateBySig: invalid nonce");
        require(block.timestamp <= expiry, "Note::delegateBySig: signature expired");
        _delegate(signatory, delegatee);
    }

    /// @notice Gets the current votes balance for `account`
    /// @param account The address to get votes balance
    /// @return The number of current votes for `account`
    function getCurrentVotes(address account) external view returns (uint96) {
        uint32 nCheckpoints = numCheckpoints[account];
        uint96 currentVotes = nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
        return
            _add96(
                currentVotes,
                getUnclaimedVotes(account),
                "Note::getCurrentVotes: uint96 overflow"
            );
    }

    /// @notice Determine the prior number of votes for an account as of a block number
    /// @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
    /// @param account The address of the account to check
    /// @param blockNumber The block number to get the vote balance at
    /// @return The number of votes the account had as of the given block
    function getPriorVotes(address account, uint256 blockNumber) public view returns (uint96) {
        require(blockNumber < block.number, "Note::getPriorVotes: not yet determined");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return _add96(
                checkpoints[account][nCheckpoints - 1].votes,
                getUnclaimedVotes(account),
                "Note::getPriorVotes: uint96 overflow"
            );
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return
                    _add96(
                        cp.votes,
                        getUnclaimedVotes(account),
                        "Note::getPriorVotes: uint96 overflow"
                    );
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }

        return
            _add96(
                checkpoints[account][lower].votes,
                getUnclaimedVotes(account),
                "Note::getPriorVotes: uint96 overflow"
            );
    }

    /// @notice Notional counts unclaimed incentives as part of a users' voting power. There is no
    /// need to checkpoint these values because they cannot be transferred or delegated.
    /// @param account the address of the Notional account to check
    /// @return Total number of unclaimed tokens accrued on the Notional account
    function getUnclaimedVotes(address account) public view returns (uint96) {
        // If the notional proxy is not set then there are no unclaimed votes
        if (address(notionalProxy) == address(0)) return 0;

        uint256 votes = notionalProxy.nTokenGetClaimableIncentives(account, block.timestamp);
        require(votes <= type(uint96).max);
        return uint96(votes);
    }

    /// @dev Changes delegates from one address to another
    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint96 delegatorBalance = balances[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    /// @dev Transfers tokens and inherits the delegate from the destination address
    function _transferTokens(
        address src,
        address dst,
        uint96 amount
    ) internal {
        require(src != address(0), "Note::_transferTokens: cannot transfer from the zero address");
        require(dst != address(0), "Note::_transferTokens: cannot transfer to the zero address");

        balances[src] = _sub96(
            balances[src],
            amount,
            "Note::_transferTokens: transfer amount exceeds balance"
        );
        balances[dst] = _add96(
            balances[dst],
            amount,
            "Note::_transferTokens: transfer amount overflows"
        );
        emit Transfer(src, dst, amount);

        _moveDelegates(delegates[src], delegates[dst], amount);
    }

    /// @dev Transfers delegates and writes a checkpoint for `getPriorVotes` to use
    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint96 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint96 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint96 srcRepNew =
                    _sub96(srcRepOld, amount, "Note::_moveVotes: vote amount underflow");
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint96 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint96 dstRepNew =
                    _add96(dstRepOld, amount, "Note::_moveVotes: vote amount overflows");
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    /// @dev Writes checkpoints for `getPriorVotes`, this is somewhat inefficient as it uses
    /// 20000 gas per transfer of delegated tokens. The goal is prevent voters from borrowing
    /// a large number of votes for a short period to vote for or against a proposal. It's unclear
    /// if there is a better model than this one here. Using only a single checkpoint means that
    /// a delegate could be the victim of a denial of service attack where an attacker continually
    /// transfers tokens to them to prevent them from voting.
    function _writeCheckpoint(
        address delegatee,
        uint32 nCheckpoints,
        uint96 oldVotes,
        uint96 newVotes
    ) internal {
        uint32 blockNumber =
            _safe32(block.number, "Note::_writeCheckpoint: block number exceeds 32 bits");

        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function _safe32(uint256 n, string memory errorMessage) private pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function _safe96(uint256 n, string memory errorMessage) private pure returns (uint96) {
        require(n < 2**96, errorMessage);
        return uint96(n);
    }

    function _add96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) private pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function _sub96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) private pure returns (uint96) {
        require(b <= a, errorMessage);
        return a - b;
    }

    function _getChainId() private pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
