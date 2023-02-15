// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/drafts/EIP712Upgradeable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IVerifier.sol';

contract TwitterVerifier is Initializable, IVerifier, OwnableUpgradeable, EIP712Upgradeable {
    //-------------------------------- Constants start --------------------------------/

    /**
     * @notice stores the verification contract instance
     */
    IVerification public immutable VERIFICATION;

    //-------------------------------- Constants end --------------------------------/

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
    /**
     * @notice stores the user address against tweetId
     */
    mapping(string => address) public usedTweetIds;
    // Stores the hash of the digest against the address of user who used it
    mapping(bytes32 => address) private usedDigests;
    /**
     * @notice stores the signer address
     */
    address public signerAddress;
    /**
     * @notice time for which signature by signer is valid
     */
    uint256 public signValidity;

    /**
     * @notice emitted when Signer address is updated
     * @param signerAddress address of the updated verification contract
     */
    event SignerUpdated(address indexed signerAddress);
    /**
     * @notice emitted when time for which sig is valid is updated
     * @param signValidity time to which validity of sign is updated
     */
    event SignValidityUpdated(uint256 signValidity);

    /**
     * @notice constructor
     * @dev initializes the immutables
     * @param _verification Verification contract address
     **/
    constructor(address _verification) {
        require(_verification != address(0), 'C1');
        VERIFICATION = IVerification(_verification);
    }

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    /// @param _signerAddress Address of the signer bot verifying users and signing off-chain messages
    /// @param _signValidity time for which signature is valid
    /// @param _name name of the verifier (used in domain seperator)
    /// @param _version version of the verifier (used in domain seperator)
    function initialize(
        address _admin,
        address _signerAddress,
        uint256 _signValidity,
        string memory _name,
        string memory _version
    ) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        _updateSignerAddress(_signerAddress);
        _updateSignValidity(_signValidity);
        __EIP712_init(_name, _version);
    }

    /**
     * @notice used to register user
     * @dev Users register themselves using message signed by the admin
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
        require(bytes(userData[msg.sender].twitterId).length == 0, 'TV:RS1');
        require(twitterIdMap[_twitterId] == address(0), 'TV:RS2');
        require(bytes(_twitterId).length != 0, 'TV:RS9');
        require(bytes(_tweetId).length != 0, 'TV:RS8');
        require(usedTweetIds[_tweetId] == address(0), 'TV:RS3');
        require(block.timestamp < _timestamp + signValidity, 'TV:RS4');

        bytes32 digest = keccak256(
            abi.encode(
                keccak256('set(string twitterId,string tweetId,address userAddr,uint256 timestamp)'),
                keccak256(bytes(_twitterId)),
                keccak256(bytes(_tweetId)),
                msg.sender,
                _timestamp
            )
        );
        require(usedDigests[digest] == address(0), 'TV:RS5');

        bytes32 hash = _hashTypedDataV4(digest);
        address signer = ECDSA.recover(hash, _v, _r, _s);

        require(signer != address(0), 'TV:RS6');
        require(signer == signerAddress, 'TV:RS7');

        VERIFICATION.registerMasterAddress(msg.sender, _isMasterLinked);
        userData[msg.sender] = UserStructData(_twitterId, _tweetId);
        twitterIdMap[_twitterId] = msg.sender;
        usedTweetIds[_tweetId] = msg.sender;
        usedDigests[digest] = msg.sender;
        emit UserRegistered(msg.sender, _isMasterLinked, string(abi.encode(_twitterId, _tweetId)));
    }

    /**
     * @notice used to unregister self
     * @dev users themselves can unregister themself
     */
    function unregisterSelf() external {
        _unregisterUser(msg.sender);
    }

    /**
     * @notice used to unregister user
     * @dev owners can unregister users
     */
    function unregisterUser(address _user) external onlyOwner {
        _unregisterUser(_user);
    }

    function _unregisterUser(address _user) private {
        string memory _userdata = userData[_user].twitterId;
        require(bytes(_userdata).length != 0, 'TV:IUU1');
        delete twitterIdMap[_userdata];
        delete userData[_user];
        VERIFICATION.unregisterMasterAddress(_user, address(this));
        emit UserUnregistered(_user);
    }

    /**
     * @notice used to update signer address
     * @dev only owner can update
     * @param _signerAddress address of the verification contract
     */
    function updateSignerAddress(address _signerAddress) external onlyOwner {
        _updateSignerAddress(_signerAddress);
    }

    function _updateSignerAddress(address _signerAddress) private {
        require(_signerAddress != signerAddress, 'TV:IUSA1');
        require(_signerAddress != address(0), 'TV:IUSA2');
        signerAddress = _signerAddress;
        emit SignerUpdated(_signerAddress);
    }

    /**
     * @notice used to update time for which sign is valid
     * @dev only owner can update
     * @param _signValidity time for which sign will be valid
     */
    function updateSignValidity(uint256 _signValidity) external onlyOwner {
        _updateSignValidity(_signValidity);
    }

    function _updateSignValidity(uint256 _signValidity) private {
        require(_signValidity != signValidity, 'TV:IUSV1');
        require(_signValidity != 0, 'TV:IUSV2');
        signValidity = _signValidity;
        emit SignValidityUpdated(_signValidity);
    }

    /**
     * @notice blacklist a digest
     * @dev only owner can update
     * @param _hash digest hash to be blacklisted
     */
    function blackListDigest(bytes32 _hash) external onlyOwner {
        usedDigests[_hash] = address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF);
    }
}
