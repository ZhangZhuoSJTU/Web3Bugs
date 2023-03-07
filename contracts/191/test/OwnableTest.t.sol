// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.16;

import "forge-std/Test.sol";

import {IOwnableUpgradeable} from "../src/ownable/IOwnableUpgradeable.sol";

import {OwnableUpgradeable} from "../src/ownable/OwnableUpgradeable.sol";

contract OwnedContract is OwnableUpgradeable {
  constructor() initializer {
    __Ownable_init(msg.sender);
  }

  function permissionedDoThing() onlyOwner public returns (bool) {
    return true;
  }
}

contract OwnableTest is Test {
  OwnedContract public ownedContract;
  address defaultOwner;
  function setUp() public {
    defaultOwner = address(0x34);
    vm.prank(defaultOwner);
    ownedContract = new OwnedContract();
  }
  function test_OwnershipSetup() public {
    assertEq(ownedContract.owner(), defaultOwner);
    vm.prank(address(0x34));
    assertTrue(ownedContract.permissionedDoThing());
  }
  function test_GatedOnlyAdmin() public {
    vm.expectRevert(IOwnableUpgradeable.ONLY_OWNER.selector);
    vm.prank(address(0x0));
    ownedContract.permissionedDoThing();
    vm.prank(defaultOwner);
    ownedContract.permissionedDoThing();
  }

  function test_SafeTransferOwnership() public {
    address newOwner = address(0x99);
    assertEq(defaultOwner, ownedContract.owner());
    vm.prank(address(0x9));
    vm.expectRevert(IOwnableUpgradeable.ONLY_OWNER.selector);
    ownedContract.safeTransferOwnership(newOwner);
    vm.prank(defaultOwner);
    ownedContract.safeTransferOwnership(newOwner);
    assertEq(ownedContract.pendingOwner(), newOwner);
    vm.prank(address(0x9));
    vm.expectRevert(IOwnableUpgradeable.ONLY_PENDING_OWNER.selector);
    ownedContract.acceptOwnership();
    vm.prank(newOwner);
    ownedContract.acceptOwnership();
    assertEq(ownedContract.owner(), newOwner);
  }

  function test_CancelsOwnershipTransfer() public {
    address newOwner = address(0x99);
    vm.prank(defaultOwner);
    ownedContract.safeTransferOwnership(newOwner);
    assertEq(ownedContract.pendingOwner(), newOwner);
    assertEq(ownedContract.owner(), defaultOwner);
    vm.prank(defaultOwner);
    ownedContract.cancelOwnershipTransfer();
    assertEq(ownedContract.pendingOwner(), address(0x0));
    assertEq(ownedContract.owner(), defaultOwner);
  }

  function test_ResignOwnership() public {
    vm.prank(defaultOwner);
    ownedContract.resignOwnership();
    assertEq(ownedContract.owner(), address(0));
  }

  function test_TransferOwnershipSimple() public {
    address newOwner = address(0x99);
    assertEq(ownedContract.pendingOwner(), address(0x0));
    assertEq(ownedContract.owner(), defaultOwner);
    vm.prank(defaultOwner);
    ownedContract.transferOwnership(newOwner);
    assertEq(ownedContract.pendingOwner(), address(0x0));
    assertEq(ownedContract.owner(), newOwner);
  }

  function test_NotTransferOwnershipZero() public {
    address newOwner = address(0x99);
    assertEq(ownedContract.pendingOwner(), address(0x0));
    assertEq(ownedContract.owner(), defaultOwner);
    vm.prank(defaultOwner);
    vm.expectRevert(IOwnableUpgradeable.OWNER_CANNOT_BE_ZERO_ADDRESS.selector);
    ownedContract.transferOwnership(address(0));
  }

  function test_PendingThenTransfer() public {
    address newOwner = address(0x99);
    vm.prank(defaultOwner);
    ownedContract.safeTransferOwnership(address(0x123));
    assertEq(ownedContract.pendingOwner(), address(0x123));
    assertEq(ownedContract.owner(), defaultOwner);
    vm.prank(defaultOwner);
    ownedContract.transferOwnership(newOwner);
    assertEq(ownedContract.pendingOwner(), address(0x0));
    assertEq(ownedContract.owner(), newOwner);
  }

}