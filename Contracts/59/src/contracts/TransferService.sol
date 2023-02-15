pragma solidity >=0.6.6;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./interfaces/IMaltDataLab.sol";
import "./Permissions.sol";

import "./interfaces/ITransferVerification.sol";


/// @title Transfer Service
/// @author 0xScotch <scotch@malt.money>
/// @notice A contract that acts like a traffic warden to ensure tranfer verification requests get routed correctly
contract TransferService is Initializable, Permissions {
  address[] public verifierList;
  mapping(address => address) public verifiers;

  event AddVerifier(address indexed source, address verifier);
  event RemoveVerifier(address indexed source, address verifier);

  function initialize(
    address _timelock,
    address initialAdmin
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);
  }

  function verifyTransfer(address from, address to, uint256 amount) public view returns (bool, string memory) {
    if (verifiers[from] != address(0)) {
      (bool valid, string memory reason) = ITransferVerification(verifiers[from]).verifyTransfer(from, to, amount);
      if (!valid) {
        return (false, reason);
      }
    } 

    if (verifiers[to] != address(0)) {
      (bool valid, string memory reason) = ITransferVerification(verifiers[to]).verifyTransfer(from, to, amount);
      if (!valid) {
        return (false, reason);
      }
    } 

    return (true, "");
  }

  function numberOfVerifiers() public view returns(uint256) {
    return verifierList.length;
  }

  /*
   * PRIVILEDGED METHODS
   */
  function addVerifier(address _address, address _verifier) 
    public
    onlyRole(ADMIN_ROLE, "Must have admin role") 
  {
    require(_verifier != address(0), "Cannot use address 0");
    require(_address != address(0), "Cannot use address 0");

    if (verifiers[_address] != address(0)) {
      return;
    }

    verifiers[_address] = _verifier;
    verifierList.push(_address);

    emit AddVerifier(_address, _verifier);
  }

  function removeVerifier(address _address) 
    public
    onlyRole(ADMIN_ROLE, "Must have admin role")  
  {
    require(_address != address(0), "Cannot use address 0");

    if (verifiers[_address] == address(0)) {
      return;
    }

    address verifier = verifiers[_address];
    verifiers[_address] = address(0);

    emit RemoveVerifier(_address, verifier);

    // Loop until the second last element
    for (uint i = 0; i < verifierList.length - 1; i = i + 1) {
      if (verifierList[i] == _address) {
        // Replace the current item with the last and pop the last away.
        verifierList[i] = verifierList[verifierList.length - 1];
        verifierList.pop();
        return;
      }
    }

    // If we made it here then the verifierList being removed is the last item
    verifierList.pop();
  }
}
