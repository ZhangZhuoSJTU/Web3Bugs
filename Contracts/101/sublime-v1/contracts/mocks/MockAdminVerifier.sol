// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/drafts/EIP712Upgradeable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IVerifier.sol';

contract MockAdminVerifier is Initializable, IVerifier, OwnableUpgradeable, EIP712Upgradeable {
    /**
     * @notice stores the verification contract instance
     */
    IVerification public verification;

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
    /// @param _name name of the verifier (used in domain seperator)
    /// @param _version version of the verifier (used in domain seperator)
    function initialize(
        address _admin,
        address _verification,
        string memory _name,
        string memory _version
    ) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        _updateVerification(_verification);
        __EIP712_init(_name, _version);
    }

    /**
     * @notice used to register user
     * @dev only owner can register users
     */

    function registerSelf() external {
        require(!verification.isUser(msg.sender, address(this)), 'User already exists');
        verification.registerMasterAddress(msg.sender, true); // true because we'll always link address here

        emit UserRegistered(msg.sender, true, 'none');
    }

    function registerUserViaOwner(address _user) external onlyOwner {
        require(!verification.isUser(_user, address(this)), 'User already exists');
        verification.registerMasterAddress(_user, true); // true because we'll always link address here

        emit UserRegistered(_user, true, 'none');
    }

    /**
     * @notice used to unregister self
     * @dev users themselves can unregister themself
     */
    function unregisterSelf() external {
        require(verification.isUser(msg.sender, address(this)), 'User does not exist');
        verification.unregisterMasterAddress(msg.sender, address(this));

        emit UserUnregistered(msg.sender);
    }

    /**
     * @notice used to unregister user
     * @dev owners can unregister users
     */
    function unregisterUser(address _user) external onlyOwner {
        require(verification.isUser(_user, address(this)), 'User does not exist');
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
}
