pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./ERC20Permit.sol";
import "./Permissions.sol";
import "./interfaces/ITransferService.sol";


/// @title Malt V2 Token
/// @author 0xScotch <scotch@malt.money>
/// @notice The ERC20 token contract for Malt V2
contract Malt is ERC20Permit, Initializable, Permissions {
  using SafeMath for uint256;

  ITransferService public transferService;

  constructor(string memory name, string memory ticker) public ERC20Permit(name, ticker) {}

  event SetTransferService(address service);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _transferService,
    address[] calldata minters,
    address[] calldata burners
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);

    transferService = ITransferService(_transferService);

    for (uint256 i = 0; i < minters.length; i = i + 1) {
      _setupRole(MONETARY_MINTER_ROLE, minters[i]);
    }
    for (uint256 i = 0; i < burners.length; i = i + 1) {
      _setupRole(MONETARY_BURNER_ROLE, burners[i]);
    }
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
    (bool success, string memory reason) = transferService.verifyTransfer(from, to, amount);
    require(success, reason);
  }

  function mint(address to, uint256 amount)
    public
    onlyRole(MONETARY_MINTER_ROLE, "Must have monetary minter role")
  {
    _mint(to, amount);
  }

  function burn(address from, uint256 amount)
    public
    onlyRole(MONETARY_BURNER_ROLE, "Must have monetary burner role")
  {
    _burn(from, amount);
  }

  function setTransferService(address _service)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_service != address(0), "Cannot use address 0 as transfer service");
    transferService = ITransferService(_service);
    emit SetTransferService(_service);
  }
}
