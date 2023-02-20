// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/drafts/EIP712Upgradeable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IVerifier.sol';

contract MockTwitterVerifier is Initializable, IVerifier, OwnableUpgradeable, EIP712Upgradeable {
    /**
     * @notice stores the verification contract instance
     */
    IVerification public verification;
    /**
     * @notice Structure for the user data
     */
    struct UserStructData {
        string twitterId;
        string tweetId;
    }

    /**
     * @notice stores the user metadata against their address
     */
    mapping(address => UserStructData) public userData;
    /**
     * @notice stores the user address against twitterId
     */
    mapping(string => address) public twitterIdMap;
    mapping(bytes32 => address) private hashAddressMap;
    /**
     * @notice stores the signer address
     */
    address public signerAddress;

    /**
     * @notice emitted when verification contract address is updated
     * @param verification address of the updated verification contract
     */
    event VerificationUpdated(address indexed verification);
    /**
     * @notice emitted when Signer address is updated
     * @param signerAddress address of the updated verification contract
     */
    event SignerUpdated(address indexed signerAddress);

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    /// @param _verification Verification contract address
    /// @param _signerAddress Address of the signer bot verifying users and signing off-chain messages
    /// @param _name name of the verifier (used in domain seperator)
    /// @param _version version of the verifier (used in domain seperator)
    function initialize(
        address _admin,
        address _verification,
        address _signerAddress,
        string memory _name,
        string memory _version
    ) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        _updateVerification(_verification);
        _updateSignerAddress(_signerAddress);
        __EIP712_init(_name, _version);
    }

    /**
     * @notice used to register user
     * @dev only owner can register users
     * @param _v int v
     * @param _r part signed message hash
     * @param _s part signed message hash
     * @param _timestamp timestamp for the signed message
     * @param _twitterId metadata related to user :  here "twitterId"
     * @param _tweetId metadata related to user :  here "tweetId"
     * @param _isMasterLinked should master address be linked to itself
     */

    function registerSelf(
        bool _isMasterLinked,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        string memory _twitterId,
        string memory _tweetId,
        uint256 _timestamp
    ) external {
        require(bytes(userData[msg.sender].twitterId).length == 0, 'User already exists');
        require(twitterIdMap[_twitterId] == address(0), 'Signed message already used');
        require(block.timestamp < _timestamp + 86400, 'Signed transaction expired');

        bytes32 digest = keccak256(
            abi.encode(
                keccak256('set(string twitterId,string tweetId,address userAddr,uint256 timestamp)'),
                keccak256(bytes(_twitterId)),
                keccak256(bytes(_tweetId)),
                msg.sender,
                _timestamp
            )
        );
        require(hashAddressMap[digest] == address(0), 'Hash Already Used');

        bytes32 hash = _hashTypedDataV4(digest);
        address signer = ECDSA.recover(hash, _v, _r, _s);
        require(signer == signerAddress, 'Invalid signature');

        verification.registerMasterAddress(msg.sender, _isMasterLinked);
        userData[msg.sender] = UserStructData(_twitterId, _tweetId);
        twitterIdMap[_twitterId] = msg.sender;
        hashAddressMap[digest] = msg.sender;
        emit UserRegistered(msg.sender, _isMasterLinked, _twitterId);
    }

    function registerUserViaOwner(
        bool _isMasterLinked,
        address _user,
        string memory _twitterId,
        string memory _tweetId
    ) external onlyOwner {
        bytes32 digest = keccak256(
            abi.encode(
                keccak256('set(string twitterId,string tweetId,address userAddr,uint256 timestamp)'),
                keccak256(bytes(_twitterId)),
                keccak256(bytes(_tweetId)),
                _user,
                block.timestamp
            )
        );

        require(hashAddressMap[digest] == address(0), 'Hash Already Used');

        verification.registerMasterAddress(_user, _isMasterLinked);
        userData[_user] = UserStructData(_twitterId, _tweetId);
        twitterIdMap[_twitterId] = _user;
        hashAddressMap[digest] = _user;
        emit UserRegistered(_user, _isMasterLinked, _twitterId);
    }

    /**
     * @notice used to unregister self
     * @dev users themselves can unregister themself
     */
    function unregisterSelf() external {
        string memory _userdata = userData[msg.sender].twitterId;
        require(bytes(_userdata).length != 0, 'User doesnt exists');
        delete twitterIdMap[_userdata];
        delete userData[msg.sender];
        verification.unregisterMasterAddress(msg.sender, address(this));
        emit UserUnregistered(msg.sender);
    }

    /**
     * @notice used to unregister user
     * @dev owners can unregister users
     */
    function unregisterUser(address _user) external onlyOwner {
        string memory _userdata = userData[_user].twitterId;
        require(bytes(_userdata).length != 0, 'User does not exists');
        delete twitterIdMap[_userdata];
        delete userData[_user];
        verification.unregisterMasterAddress(_user, address(this));
        emit UserUnregistered(_user);
    }

    /**
     * @notice used to update verification contract address
     * @dev only owner can update
     * @param _verification address of the verification contract
     */
    function updateVerification(address _verification) external onlyOwner {
        _updateVerification(_verification);
    }

    function _updateVerification(address _verification) internal {
        verification = IVerification(_verification);
        emit VerificationUpdated(_verification);
    }

    /**
     * @notice used to update signer address
     * @dev only owner can update
     * @param _signerAddress address of the verification contract
     */
    function updateSignerAddress(address _signerAddress) external onlyOwner {
        _updateSignerAddress(_signerAddress);
    }

    function _updateSignerAddress(address _signerAddress) internal {
        signerAddress = _signerAddress;
        emit SignerUpdated(signerAddress);
    }
}
