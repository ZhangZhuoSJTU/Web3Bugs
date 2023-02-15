// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import '../interfaces/IVerification.sol';

/// @title Contract that handles linking identity of user to address
contract Verification is Initializable, IVerification, OwnableUpgradeable {
    struct LinkedAddress {
        address masterAddress;
        uint256 activatesAt;
    }

    /// @notice Delay in seconds after which addresses are activated once registered or linked
    uint256 public activationDelay;

    /// @notice Tells whether a given verifier is valid
    /// @dev Mapping that stores valid verifiers as added by admin. verifier -> true/false
    /// @return boolean that represents if the specified verifier is valid
    mapping(address => bool) public verifiers;

    /// @notice Maps masterAddress with the verifier that was used to verify it and the time when master address is active
    /// @dev Mapping is from masterAddress -> verifier -> activationTime
    /// @return Verifier used to verify the given master address
    mapping(address => mapping(address => uint256)) public masterAddresses;

    /// @notice Maps linkedAddresses with the master address and activation time
    /// @dev Mapping is linkedAddress -> (MasterAddress, activationTimestamp)
    /// @return Returns the master address and activation time for the linkedAddress
    mapping(address => LinkedAddress) public linkedAddresses;

    /// @notice Maps address to link with the master addres
    /// @dev Mapping is linkedAddress -> MasterAddress -> isPending
    /// @return Returns if linkedAddress has a pending request from master address
    mapping(address => mapping(address => bool)) public pendingLinkAddresses;

    /// @notice Prevents anyone other than a valid verifier from calling a function
    modifier onlyVerifier() {
        require(verifiers[msg.sender], 'Invalid verifier');
        _;
    }

    /// @notice Initializes the variables of the contract
    /// @dev Contract follows proxy pattern and this function is used to initialize the variables for the contract in the proxy
    /// @param _admin Admin of the verification contract who can add verifiers and remove masterAddresses deemed invalid
    /// @param _activationDelay Delay in seconds after which addresses are registered or linked
    function initialize(address _admin, uint256 _activationDelay) external initializer {
        super.__Ownable_init();
        super.transferOwnership(_admin);
        _updateActivationDelay(_activationDelay);
    }

    /// @notice owner can update activation delay
    /// @param _activationDelay updated value of activation delay for registered/linking addresses in seconds
    function updateActivationDelay(uint256 _activationDelay) external onlyOwner {
        _updateActivationDelay(_activationDelay);
    }

    function _updateActivationDelay(uint256 _activationDelay) internal {
        activationDelay = _activationDelay;
        emit ActivationDelayUpdated(_activationDelay);
    }

    /// @notice owner can add new verifier
    /// @dev Verifier can add master address or remove addresses added by it
    /// @param _verifier Address of the verifier contract
    function addVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), 'V:AV-Verifier cant be 0 address');
        require(!verifiers[_verifier], 'V:AV-Verifier exists');
        verifiers[_verifier] = true;
        emit VerifierAdded(_verifier);
    }

    /// @notice owner can remove exisiting verifier
    /// @dev Verifier can add master address or remove addresses added by it
    /// @param _verifier Address of the verifier contract
    function removeVerifier(address _verifier) external onlyOwner {
        require(verifiers[_verifier], 'V:AV-Verifier doesnt exist');
        delete verifiers[_verifier];
        emit VerifierRemoved(_verifier);
    }

    /// @notice Only verifier can add register master address
    /// @dev Multiple accounts can be linked to master address to act on behalf. Master address can be registered by multiple verifiers
    /// @param _masterAddress address which is registered as verified
    /// @param _isMasterLinked boolean which specifies if the masterAddress has to be added as a linked address
    ///                         _isMasterLinked is used to support users who want to keep the master address as a cold wallet for security
    function registerMasterAddress(address _masterAddress, bool _isMasterLinked) external override onlyVerifier {
        require(masterAddresses[_masterAddress][msg.sender] == 0, 'V:RMA-Already registered');
        uint256 _masterAddressActivatesAt = block.timestamp + activationDelay;
        masterAddresses[_masterAddress][msg.sender] = _masterAddressActivatesAt;
        emit UserRegistered(_masterAddress, msg.sender, _masterAddressActivatesAt);

        if (_isMasterLinked) {
            _linkAddress(_masterAddress, _masterAddress);
        }
    }

    /// @notice Master address can be unregistered by registered verifier or owner
    /// @dev unregistering master address doesn't affect linked addreses mapping to master address, though they would not be verified by this verifier anymore
    /// @param _masterAddress address which is being unregistered
    /// @param _verifier verifier address from which master address is unregistered
    function unregisterMasterAddress(address _masterAddress, address _verifier) external override {
        if (msg.sender != super.owner()) {
            require(masterAddresses[_masterAddress][msg.sender] != 0 && msg.sender == _verifier, 'V:UMA-Invalid verifier');
        }
        delete masterAddresses[_masterAddress][_verifier];
        emit UserUnregistered(_masterAddress, _verifier, msg.sender);
    }

    function _linkAddress(address _linked, address _master) internal {
        uint256 _linkedAddressActivatesAt = block.timestamp + activationDelay;
        linkedAddresses[_linked] = LinkedAddress(_master, _linkedAddressActivatesAt);
        emit AddressLinked(_linked, _master, _linkedAddressActivatesAt);
    }

    /// @notice Used by master address to request linking another address to it
    /// @dev only master address can initiate linking of another address
    /// @param _linkedAddress address which is to be linked
    function requestAddressLinking(address _linkedAddress) external {
        require(linkedAddresses[_linkedAddress].masterAddress == address(0), 'V:LA-Address already linked');
        pendingLinkAddresses[_linkedAddress][msg.sender] = true;
        emit AddressLinkingRequested(_linkedAddress, msg.sender);
    }

    /// @notice Used by master address to cancel request linking another address to it
    /// @param _linkedAddress address which is to be linked
    function cancelAddressLinkingRequest(address _linkedAddress) external {
        require(pendingLinkAddresses[_linkedAddress][msg.sender], 'V:CALR-No pending request');
        delete pendingLinkAddresses[_linkedAddress][msg.sender];
        emit AddressLinkingRequestCancelled(_linkedAddress, msg.sender);
    }

    /// @notice Link an address with a master address
    /// @dev Master address to which the address is being linked need not be verified
    ///     link address can only accept the request made by a master address, but can't initiate a linking request
    /// @param _masterAddress master address to link to
    function linkAddress(address _masterAddress) external {
        require(linkedAddresses[msg.sender].masterAddress == address(0), 'V:LA-Address already linked');
        require(pendingLinkAddresses[msg.sender][_masterAddress], 'V:LA-No pending request');
        _linkAddress(msg.sender, _masterAddress);
    }

    /// @notice Unlink address with master address
    /// @dev a single address can be linked to only one master address
    /// @param _linkedAddress Address that is being unlinked
    function unlinkAddress(address _linkedAddress) external {
        address _linkedTo = linkedAddresses[_linkedAddress].masterAddress;
        require(_linkedTo != address(0), 'V:UA-Address not linked');
        require(_linkedTo == msg.sender, 'V:UA-Not linked to sender');
        delete linkedAddresses[_linkedAddress];
        emit AddressUnlinked(_linkedAddress, _linkedTo);
    }

    /// @notice User to verify if an address is linked to a master address that is registered with verifier
    /// @dev view function
    /// @param _user address which has to be checked if mapped against a verified master address
    /// @param _verifier verifier with which master address has to be verified
    /// @return if the user is linke dto a registered master address
    function isUser(address _user, address _verifier) external view override returns (bool) {
        LinkedAddress memory _linkedAddress = linkedAddresses[_user];
        uint256 _masterActivatesAt = masterAddresses[_linkedAddress.masterAddress][_verifier];
        if (
            _linkedAddress.masterAddress == address(0) ||
            _linkedAddress.activatesAt > block.timestamp ||
            _masterActivatesAt == 0 ||
            _masterActivatesAt > block.timestamp
        ) {
            return false;
        }
        return true;
    }
}
