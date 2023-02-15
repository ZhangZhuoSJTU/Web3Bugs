// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.7;

import "../Identity.sol";
import "../interfaces/IERC20.sol";

contract QuickAccManager {
	// Note: nonces are scoped by identity rather than by accHash - the reason for this is that there's no reason to scope them by accHash,
	// we merely need them for replay protection
	mapping (address => uint) nonces;
	mapping (bytes32 => uint) scheduled;

	bytes4 immutable CANCEL_PREFIX = 0xc47c3100;

	// Events
	// we only need those for timelocked stuff so we can show scheduled txns to the user; the oens that get executed immediately do not need logs
	event LogScheduled(bytes32 indexed txnHash, bytes32 indexed accHash, address indexed signer, uint nonce, uint time, Identity.Transaction[] txns);
	event LogCancelled(bytes32 indexed txnHash, bytes32 indexed accHash, address indexed signer, uint time);
	event LogExecScheduled(bytes32 indexed txnHash, bytes32 indexed accHash, uint time);

	// EIP 2612
	bytes32 public DOMAIN_SEPARATOR;
	constructor() {
		DOMAIN_SEPARATOR = keccak256(
			abi.encode(
				keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
				// @TODO: maybe we should use a more user friendly name here?
				keccak256(bytes('QuickAccManager')),
				keccak256(bytes('1')),
				block.chainid,
				address(this)
			)
		);
	}

	struct QuickAccount {
		uint timelock;
		address one;
		address two;
		// We decided to not allow certain options here such as ability to skip the second sig for send(), but leaving this a struct rather than a tuple
		// for clarity and to ensure it's future proof
	}
	struct DualSig {
		bool isBothSigned;
		bytes one;
		bytes two;
	}

	// NOTE: a single accHash can control multiple identities, as long as those identities set it's hash in privileges[address(this)]
	// this is by design

	// isBothSigned is hashed in so that we don't allow signatures from two-sig txns to be reused for single sig txns,
	// ...potentially frontrunning a normal two-sig transaction and making it wait
	// WARNING: if the signature of this is changed, we have to change IdentityFactory
	function send(Identity identity, QuickAccount calldata acc, DualSig calldata sigs, Identity.Transaction[] calldata txns) external {
		bytes32 accHash = keccak256(abi.encode(acc));
		require(identity.privileges(address(this)) == accHash, 'WRONG_ACC_OR_NO_PRIV');
		uint initialNonce = nonces[address(identity)];
		// Security: we must also hash in the hash of the QuickAccount, otherwise the sig of one key can be reused across multiple accs
		bytes32 hash = keccak256(abi.encode(
			address(this),
			block.chainid,
			accHash,
			nonces[address(identity)]++,
			txns,
			sigs.isBothSigned
		));
		if (sigs.isBothSigned) {
			require(acc.one == SignatureValidator.recoverAddr(hash, sigs.one), 'SIG_ONE');
			require(acc.two == SignatureValidator.recoverAddr(hash, sigs.two), 'SIG_TWO');
			identity.executeBySender(txns);
		} else {
			address signer = SignatureValidator.recoverAddr(hash, sigs.one);
			require(acc.one == signer || acc.two == signer, 'SIG');
			// no need to check whether `scheduled[hash]` is already set here cause of the incrementing nonce
			scheduled[hash] = block.timestamp + acc.timelock;
			emit LogScheduled(hash, accHash, signer, initialNonce, block.timestamp, txns);
		}
	}

	function cancel(Identity identity, QuickAccount calldata acc, uint nonce, bytes calldata sig, Identity.Transaction[] calldata txns) external {
		bytes32 accHash = keccak256(abi.encode(acc));
		require(identity.privileges(address(this)) == accHash, 'WRONG_ACC_OR_NO_PRIV');

		bytes32 hash = keccak256(abi.encode(CANCEL_PREFIX, address(this), block.chainid, accHash, nonce, txns, false));
		address signer = SignatureValidator.recoverAddr(hash, sig);
		require(signer == acc.one || signer == acc.two, 'INVALID_SIGNATURE');

		// @NOTE: should we allow cancelling even when it's matured? probably not, otherwise there's a minor grief
		// opportunity: someone wants to cancel post-maturity, and you front them with execScheduled
		bytes32 hashTx = keccak256(abi.encode(address(this), block.chainid, accHash, nonce, txns));
		require(scheduled[hashTx] != 0 && block.timestamp < scheduled[hashTx], 'TOO_LATE');
		delete scheduled[hashTx];

		emit LogCancelled(hashTx, accHash, signer, block.timestamp);
	}

	function execScheduled(Identity identity, bytes32 accHash, uint nonce, Identity.Transaction[] calldata txns) external {
		require(identity.privileges(address(this)) == accHash, 'WRONG_ACC_OR_NO_PRIV');

		bytes32 hash = keccak256(abi.encode(address(this), block.chainid, accHash, nonce, txns, false));
		require(scheduled[hash] != 0 && block.timestamp >= scheduled[hash], 'NOT_TIME');
		delete scheduled[hash];
		identity.executeBySender(txns);

		emit LogExecScheduled(hash, accHash, block.timestamp);
	}

	// EIP 1271 implementation
	// see https://eips.ethereum.org/EIPS/eip-1271
	function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
		(address payable id, uint timelock, bytes memory sig1, bytes memory sig2) = abi.decode(signature, (address, uint, bytes, bytes));
		bytes32 accHash = keccak256(abi.encode(QuickAccount({
			timelock: timelock,
			one: SignatureValidator.recoverAddr(hash, sig1),
			two: SignatureValidator.recoverAddr(hash, sig2)
		})));
		if (Identity(id).privileges(address(this)) == accHash) {
			// bytes4(keccak256("isValidSignature(bytes32,bytes)")
			return 0x1626ba7e;
		} else {
			return 0xffffffff;
		}
	}

	// EIP 712 methods
	// all of the following are 2/2 only
	bytes32 private TRANSFER_TYPEHASH = keccak256('Transfer(address tokenAddr,address to,uint256 value,uint256 fee,uint256 nonce)');
	struct Transfer { address token; address to; uint amount; uint fee; }
	// WARNING: if the signature of this is changed, we have to change IdentityFactory
	function sendTransfer(Identity identity, QuickAccount calldata acc, bytes calldata sigOne, bytes calldata sigTwo, Transfer calldata t) external {
		require(identity.privileges(address(this)) == keccak256(abi.encode(acc)), 'WRONG_ACC_OR_NO_PRIV');

		bytes32 hash = keccak256(abi.encodePacked(
			'\x19\x01',
			DOMAIN_SEPARATOR,
			keccak256(abi.encode(TRANSFER_TYPEHASH, t.token, t.to, t.amount, t.fee, nonces[address(identity)]++))
		));
		require(acc.one == SignatureValidator.recoverAddr(hash, sigOne), 'SIG_ONE');
		require(acc.two == SignatureValidator.recoverAddr(hash, sigTwo), 'SIG_TWO');
		Identity.Transaction[] memory txns = new Identity.Transaction[](2);
		txns[0].to = t.token;
		txns[0].data = abi.encodeWithSelector(IERC20.transfer.selector, t.to, t.amount);
		txns[1].to = t.token;
		txns[1].data = abi.encodeWithSelector(IERC20.transfer.selector, msg.sender, t.fee);
		identity.executeBySender(txns);
	}

	// Reference for arrays: https://github.com/sportx-bet/smart-contracts/blob/e36965a0c4748bf73ae15ed3cab5660c9cf722e1/contracts/impl/trading/EIP712FillHasher.sol
	// and https://eips.ethereum.org/EIPS/eip-712
	// and for signTypedData_v4: https://gist.github.com/danfinlay/750ce1e165a75e1c3387ec38cf452b71
	struct Txn { string description; address to; uint value; bytes data; }
	bytes32 private TXNS_TYPEHASH = keccak256('Txn(string description,address to,uint256 value,bytes data)');
	bytes32 private BUNDLE_TYPEHASH = keccak256('Bundle(uint256 nonce,Txn[] transactions)');
	// WARNING: if the signature of this is changed, we have to change IdentityFactory
	function sendTxns(Identity identity, QuickAccount calldata acc, bytes calldata sigOne, bytes calldata sigTwo, Txn[] calldata txns) external {
		require(identity.privileges(address(this)) == keccak256(abi.encode(acc)), 'WRONG_ACC_OR_NO_PRIV');

		// hashing + prepping args
		bytes32[] memory txnBytes = new bytes32[](txns.length);
		Identity.Transaction[] memory identityTxns = new Identity.Transaction[](txns.length);
		for (uint256 i = 0; i < txns.length; i++) {
			txnBytes[i] = keccak256(abi.encode(TXNS_TYPEHASH, txns[i].description, txns[i].to, txns[i].value, txns[i].data));
			identityTxns[i].to = txns[i].to;
			identityTxns[i].value = txns[i].value;
			identityTxns[i].data = txns[i].data;
		}
		bytes32 txnsHash = keccak256(abi.encodePacked(txnBytes));
		bytes32 hash = keccak256(abi.encodePacked(
			'\x19\x01',
			DOMAIN_SEPARATOR,
			keccak256(abi.encode(BUNDLE_TYPEHASH, nonces[address(identity)]++, txnsHash))
		));
		require(acc.one == SignatureValidator.recoverAddr(hash, sigOne), 'SIG_ONE');
		require(acc.two == SignatureValidator.recoverAddr(hash, sigTwo), 'SIG_TWO');
		identity.executeBySender(identityTxns);
	}

}
