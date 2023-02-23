// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ICollateral.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerableUpgradeable.sol";

contract Collateral is ICollateral, ERC20PermitUpgradeable, SafeAccessControlEnumerableUpgradeable, ReentrancyGuardUpgradeable {
  IERC20 private immutable baseToken;
  uint256 private immutable baseTokenDenominator;
  address private manager;
  uint256 private depositFee;
  uint256 private withdrawFee;
  ICollateralHook private depositHook;
  ICollateralHook private withdrawHook;
  ICollateralHook private managerWithdrawHook;

  uint256 public constant FEE_DENOMINATOR = 1000000;
  uint256 public constant FEE_LIMIT = 100000;
  bytes32 public constant MANAGER_WITHDRAW_ROLE = keccak256("Collateral_managerWithdraw(uint256)");
  bytes32 public constant SET_MANAGER_ROLE = keccak256("Collateral_setManager(address)");
  bytes32 public constant SET_DEPOSIT_FEE_ROLE = keccak256("Collateral_setDepositFee(uint256)");
  bytes32 public constant SET_WITHDRAW_FEE_ROLE = keccak256("Collateral_setWithdrawFee(uint256)");
  bytes32 public constant SET_DEPOSIT_HOOK_ROLE = keccak256("Collateral_setDepositHook(ICollateralHook)");
  bytes32 public constant SET_WITHDRAW_HOOK_ROLE = keccak256("Collateral_setWithdrawHook(ICollateralHook)");
  bytes32 public constant SET_MANAGER_WITHDRAW_HOOK_ROLE = keccak256("Collateral_setManagerWithdrawHook(ICollateralHook)");

  constructor(IERC20 _newBaseToken, uint256 _newBaseTokenDecimals) {
    baseToken = _newBaseToken;
    baseTokenDenominator = 10**_newBaseTokenDecimals;
  }

  function initialize(string memory _name, string memory _symbol) public initializer {
    __SafeAccessControlEnumerable_init();
    __ERC20_init(_name, _symbol);
    __ERC20Permit_init(_name);
  }

  /**
   * @dev If hook not set, fees remain within the contract as extra reserves
   * (withdrawable by manager). Converts amount after fee from base token
   * units to collateral token units.
   */
  function deposit(address _recipient, uint256 _amount) external override nonReentrant returns (uint256) {
    uint256 _fee = (_amount * depositFee) / FEE_DENOMINATOR;
    if (depositFee > 0) { require(_fee > 0, "fee = 0"); }
    else { require(_amount > 0, "amount = 0"); }
    baseToken.transferFrom(msg.sender, address(this), _amount);
    uint256 _amountAfterFee = _amount - _fee;
    if (address(depositHook) != address(0)) {
      baseToken.approve(address(depositHook), _fee);
      depositHook.hook(_recipient, _amount, _amountAfterFee);
      baseToken.approve(address(depositHook), 0);
    }
    /// Converts amount after fee from base token units to collateral token units.
    uint256 _collateralMintAmount = (_amountAfterFee * 1e18) / baseTokenDenominator;
    _mint(_recipient, _collateralMintAmount);
    emit Deposit(_recipient, _amountAfterFee, _fee);
    return _collateralMintAmount;
  }

  /// @dev Converts amount from collateral token units to base token units.
  function withdraw(uint256 _amount) external override nonReentrant {
    uint256 _baseTokenAmount = (_amount * baseTokenDenominator) / 1e18;
    uint256 _fee = (_baseTokenAmount * withdrawFee) / FEE_DENOMINATOR;
    if (withdrawFee > 0) { require(_fee > 0, "fee = 0"); }
    else { require(_baseTokenAmount > 0, "amount = 0"); }
    _burn(msg.sender, _amount);
    uint256 _baseTokenAmountAfterFee = _baseTokenAmount - _fee;
    if (address(withdrawHook) != address(0)) {
      baseToken.approve(address(withdrawHook), _fee);
      withdrawHook.hook(msg.sender, _baseTokenAmount, _baseTokenAmountAfterFee);
      baseToken.approve(address(withdrawHook), 0);
    }
    baseToken.transfer(msg.sender, _baseTokenAmountAfterFee);
    emit Withdraw(msg.sender, _baseTokenAmountAfterFee, _fee);
  }

  function managerWithdraw(uint256 _amount) external override onlyRole(MANAGER_WITHDRAW_ROLE) nonReentrant {
    if (address(managerWithdrawHook) != address(0)) managerWithdrawHook.hook(msg.sender, _amount, _amount);
    baseToken.transfer(manager, _amount);
  }

  function setManager(address _newManager) external override onlyRole(SET_MANAGER_ROLE) {
    manager = _newManager;
    emit ManagerChange(_newManager);
  }

  function setDepositFee(uint256 _newDepositFee) external override onlyRole(SET_DEPOSIT_FEE_ROLE) {
    require(_newDepositFee <= FEE_LIMIT, "exceeds fee limit");
    depositFee = _newDepositFee;
    emit DepositFeeChange(_newDepositFee);
  }

  function setWithdrawFee(uint256 _newWithdrawFee) external override onlyRole(SET_WITHDRAW_FEE_ROLE) {
    require(_newWithdrawFee <= FEE_LIMIT, "exceeds fee limit");
    withdrawFee = _newWithdrawFee;
    emit WithdrawFeeChange(_newWithdrawFee);
  }

  function setDepositHook(ICollateralHook _newDepositHook) external override onlyRole(SET_DEPOSIT_HOOK_ROLE) {
    depositHook = _newDepositHook;
    emit DepositHookChange(address(_newDepositHook));
  }

  function setWithdrawHook(ICollateralHook _newWithdrawHook) external override onlyRole(SET_WITHDRAW_HOOK_ROLE) {
    withdrawHook = _newWithdrawHook;
    emit WithdrawHookChange(address(_newWithdrawHook));
  }

  function setManagerWithdrawHook(ICollateralHook _newManagerWithdrawHook) external override onlyRole(SET_MANAGER_WITHDRAW_HOOK_ROLE) {
    managerWithdrawHook = _newManagerWithdrawHook;
    emit ManagerWithdrawHookChange(address(_newManagerWithdrawHook));
  }

  function getBaseToken() external view override returns (IERC20) { return baseToken; }

  function getManager() external view override returns (address) { return manager; }

  function getDepositFee() external view override returns (uint256) { return depositFee; }

  function getWithdrawFee() external view override returns (uint256) { return withdrawFee; }

  function getDepositHook() external view override returns (ICollateralHook) { return depositHook; }

  function getWithdrawHook() external view override returns (ICollateralHook) { return withdrawHook; }

  function getManagerWithdrawHook() external view override returns (ICollateralHook) { return managerWithdrawHook; }

  function getReserve() external view override returns (uint256) { return baseToken.balanceOf(address(this)); }
}
