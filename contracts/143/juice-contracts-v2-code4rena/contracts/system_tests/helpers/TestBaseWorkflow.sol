// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './hevm.sol';
import '../../../lib/ds-test/src/test.sol';

import '../../JBController.sol';
import '../../JBDirectory.sol';
import '../../JBETHPaymentTerminal.sol';
import '../../JBERC20PaymentTerminal.sol';
import '../../JBSingleTokenPaymentTerminalStore.sol';
import '../../JBFundingCycleStore.sol';
import '../../JBOperatorStore.sol';
import '../../JBPrices.sol';
import '../../JBProjects.sol';
import '../../JBSplitsStore.sol';
import '../../JBToken.sol';
import '../../JBTokenStore.sol';

import '../../structs/JBDidPayData.sol';
import '../../structs/JBDidRedeemData.sol';
import '../../structs/JBFee.sol';
import '../../structs/JBFundAccessConstraints.sol';
import '../../structs/JBFundingCycle.sol';
import '../../structs/JBFundingCycleData.sol';
import '../../structs/JBFundingCycleMetadata.sol';
import '../../structs/JBGroupedSplits.sol';
import '../../structs/JBOperatorData.sol';
import '../../structs/JBPayParamsData.sol';
import '../../structs/JBProjectMetadata.sol';
import '../../structs/JBRedeemParamsData.sol';
import '../../structs/JBSplit.sol';

import '../../interfaces/IJBPaymentTerminal.sol';
import '../../interfaces/IJBToken.sol';

import './AccessJBLib.sol';

import '@paulrberg/contracts/math/PRBMath.sol';

// Base contract for Juicebox system tests.
//
// Provides common functionality, such as deploying contracts on test setup.
contract TestBaseWorkflow is DSTest {
  //*********************************************************************//
  // --------------------- private stored properties ------------------- //
  //*********************************************************************//

  // Multisig address used for testing.
  address private _multisig = address(123);

  address private _beneficiary = address(69420);

  // EVM Cheat codes - test addresses via prank and startPrank in hevm
  Hevm public evm = Hevm(HEVM_ADDRESS);

  // JBOperatorStore
  JBOperatorStore private _jbOperatorStore;
  // JBProjects
  JBProjects private _jbProjects;
  // JBPrices
  JBPrices private _jbPrices;
  // JBDirectory
  JBDirectory private _jbDirectory;
  // JBFundingCycleStore
  JBFundingCycleStore private _jbFundingCycleStore;
  // JBToken
  JBToken private _jbToken;
  // JBTokenStore
  JBTokenStore private _jbTokenStore;
  // JBSplitsStore
  JBSplitsStore private _jbSplitsStore;
  // JBController
  JBController private _jbController;
  // JBETHPaymentTerminalStore
  JBSingleTokenPaymentTerminalStore private _jbPaymentTerminalStore;
  // JBETHPaymentTerminal
  JBETHPaymentTerminal private _jbETHPaymentTerminal;
  // JBERC20PaymentTerminal
  JBERC20PaymentTerminal private _jbERC20PaymentTerminal;
  // AccessJBLib
  AccessJBLib private _accessJBLib;

  //*********************************************************************//
  // ------------------------- internal views -------------------------- //
  //*********************************************************************//

  function multisig() internal view returns (address) {
    return _multisig;
  }

  function beneficiary() internal view returns (address) {
    return _beneficiary;
  }

  function jbOperatorStore() internal view returns (JBOperatorStore) {
    return _jbOperatorStore;
  }

  function jbProjects() internal view returns (JBProjects) {
    return _jbProjects;
  }

  function jbPrices() internal view returns (JBPrices) {
    return _jbPrices;
  }

  function jbDirectory() internal view returns (JBDirectory) {
    return _jbDirectory;
  }

  function jbFundingCycleStore() internal view returns (JBFundingCycleStore) {
    return _jbFundingCycleStore;
  }

  function jbTokenStore() internal view returns (JBTokenStore) {
    return _jbTokenStore;
  }

  function jbSplitsStore() internal view returns (JBSplitsStore) {
    return _jbSplitsStore;
  }

  function jbController() internal view returns (JBController) {
    return _jbController;
  }

  function jbPaymentTerminalStore() internal view returns (JBSingleTokenPaymentTerminalStore) {
    return _jbPaymentTerminalStore;
  }

  function jbETHPaymentTerminal() internal view returns (JBETHPaymentTerminal) {
    return _jbETHPaymentTerminal;
  }

  function jbERC20PaymentTerminal() internal view returns (JBERC20PaymentTerminal) {
    return _jbERC20PaymentTerminal;
  }

  function jbToken() internal view returns (JBToken) {
    return _jbToken;
  }

  function jbLibraries() internal view returns (AccessJBLib) {
    return _accessJBLib;
  }

  //*********************************************************************//
  // --------------------------- test setup ---------------------------- //
  //*********************************************************************//

  // Deploys and initializes contracts for testing.
  function setUp() public virtual {
    // Labels
    evm.label(_multisig, 'projectOwner');
    evm.label(_beneficiary, 'beneficiary');

    // JBOperatorStore
    _jbOperatorStore = new JBOperatorStore();
    evm.label(address(_jbOperatorStore), 'JBOperatorStore');

    // JBProjects
    _jbProjects = new JBProjects(_jbOperatorStore);
    evm.label(address(_jbProjects), 'JBProjects');

    // JBPrices
    _jbPrices = new JBPrices(_multisig);
    evm.label(address(_jbPrices), 'JBPrices');

    address contractAtNoncePlusOne = addressFrom(address(this), 5);

    // JBFundingCycleStore
    _jbFundingCycleStore = new JBFundingCycleStore(IJBDirectory(contractAtNoncePlusOne));
    evm.label(address(_jbFundingCycleStore), 'JBFundingCycleStore');

    // JBDirectory
    _jbDirectory = new JBDirectory(_jbOperatorStore, _jbProjects, _jbFundingCycleStore, _multisig);
    evm.label(address(_jbDirectory), 'JBDirectory');

    // JBTokenStore
    _jbTokenStore = new JBTokenStore(_jbOperatorStore, _jbProjects, _jbDirectory);
    evm.label(address(_jbTokenStore), 'JBTokenStore');

    // JBSplitsStore
    _jbSplitsStore = new JBSplitsStore(_jbOperatorStore, _jbProjects, _jbDirectory);
    evm.label(address(_jbSplitsStore), 'JBSplitsStore');

    // JBController
    _jbController = new JBController(
      _jbOperatorStore,
      _jbProjects,
      _jbDirectory,
      _jbFundingCycleStore,
      _jbTokenStore,
      _jbSplitsStore
    );
    evm.label(address(_jbController), 'JBController');

    evm.prank(_multisig);
    _jbDirectory.setIsAllowedToSetFirstController(address(_jbController), true);

    // JBETHPaymentTerminalStore
    _jbPaymentTerminalStore = new JBSingleTokenPaymentTerminalStore(
      _jbDirectory,
      _jbFundingCycleStore,
      _jbPrices
    );
    evm.label(address(_jbPaymentTerminalStore), 'JBSingleTokenPaymentTerminalStore');

    // AccessJBLib
    _accessJBLib = new AccessJBLib();

    // JBETHPaymentTerminal
    _jbETHPaymentTerminal = new JBETHPaymentTerminal(
      _accessJBLib.ETH(),
      _jbOperatorStore,
      _jbProjects,
      _jbDirectory,
      _jbSplitsStore,
      _jbPrices,
      _jbPaymentTerminalStore,
      _multisig
    );
    evm.label(address(_jbETHPaymentTerminal), 'JBETHPaymentTerminal');

    evm.prank(_multisig);
    _jbToken = new JBToken('MyToken', 'MT');

    evm.prank(_multisig);
    _jbToken.mint(0, _multisig, 100 * 10**18);

    // JBERC20PaymentTerminal
    _jbERC20PaymentTerminal = new JBERC20PaymentTerminal(
      _jbToken,
      _accessJBLib.ETH(), // currency
      _accessJBLib.ETH(), // base weight currency
      1, // JBSplitsGroupe
      _jbOperatorStore,
      _jbProjects,
      _jbDirectory,
      _jbSplitsStore,
      _jbPrices,
      _jbPaymentTerminalStore,
      _multisig
    );
    evm.label(address(_jbERC20PaymentTerminal), 'JBERC20PaymentTerminal');
  }

  //https://ethereum.stackexchange.com/questions/24248/how-to-calculate-an-ethereum-contracts-address-during-its-creation-using-the-so
  function addressFrom(address _origin, uint256 _nonce) internal pure returns (address _address) {
    bytes memory data;
    if (_nonce == 0x00) data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), _origin, bytes1(0x80));
    else if (_nonce <= 0x7f)
      data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), _origin, uint8(_nonce));
    else if (_nonce <= 0xff)
      data = abi.encodePacked(bytes1(0xd7), bytes1(0x94), _origin, bytes1(0x81), uint8(_nonce));
    else if (_nonce <= 0xffff)
      data = abi.encodePacked(bytes1(0xd8), bytes1(0x94), _origin, bytes1(0x82), uint16(_nonce));
    else if (_nonce <= 0xffffff)
      data = abi.encodePacked(bytes1(0xd9), bytes1(0x94), _origin, bytes1(0x83), uint24(_nonce));
    else data = abi.encodePacked(bytes1(0xda), bytes1(0x94), _origin, bytes1(0x84), uint32(_nonce));
    bytes32 hash = keccak256(data);
    assembly {
      mstore(0, hash)
      _address := mload(0)
    }
  }
}
