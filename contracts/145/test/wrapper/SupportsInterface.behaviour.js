// Based on https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.1.0/test/token/ERC1155/ERC1155.behaviour.js
// Copyright (c) 2016-2020 zOS Global Limited

const { makeInterfaceId } = require('@openzeppelin/test-helpers')

const { expect } = require('chai')

const INTERFACES = {
  ERC165: ['supportsInterface(bytes4)'],
  ERC721: [
    'balanceOf(address)',
    'ownerOf(uint256)',
    'approve(address,uint256)',
    'getApproved(uint256)',
    'setApprovalForAll(address,bool)',
    'isApprovedForAll(address,address)',
    'transferFrom(address,address,uint256)',
    'safeTransferFrom(address,address,uint256)',
    'safeTransferFrom(address,address,uint256,bytes)',
  ],
  ERC721Enumerable: [
    'totalSupply()',
    'tokenOfOwnerByIndex(address,uint256)',
    'tokenByIndex(uint256)',
  ],
  ERC721Metadata: ['name()', 'symbol()', 'tokenURI(uint256)'],
  ERC1155: [
    'balanceOf(address,uint256)',
    'balanceOfBatch(address[],uint256[])',
    'setApprovalForAll(address,bool)',
    'isApprovedForAll(address,address)',
    'safeTransferFrom(address,address,uint256,uint256,bytes)',
    'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
  ],
  ERC1155Receiver: [
    'onERC1155Received(address,address,uint256,uint256,bytes)',
    'onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)',
  ],
  AccessControl: [
    'hasRole(bytes32,address)',
    'getRoleAdmin(bytes32)',
    'grantRole(bytes32,address)',
    'revokeRole(bytes32,address)',
    'renounceRole(bytes32,address)',
  ],
  AccessControlEnumerable: [
    'getRoleMember(bytes32,uint256)',
    'getRoleMemberCount(bytes32)',
  ],
  INameWrapper: [
    'ens()',
    'registrar()',
    'metadataService()',
    'names(bytes32)',
    'wrap(bytes,address,address)',
    'wrapETH2LD(string,address,uint32,uint64,address)',
    'registerAndWrapETH2LD(string,address,uint256,address,uint32,uint64)',
    'renew(uint256,uint256,uint64)',
    'unwrap(bytes32,bytes32,address)',
    'unwrapETH2LD(bytes32,address,address)',
    'setFuses(bytes32,uint32)',
    'setChildFuses(bytes32,bytes32,uint32,uint64)',
    'setSubnodeRecord(bytes32,string,address,address,uint64,uint32,uint64)',
    'setRecord(bytes32,address,address,uint64)',
    'setSubnodeOwner(bytes32,string,address,uint32,uint64)',
    'isTokenOwnerOrApproved(bytes32,address)',
    'setResolver(bytes32,address)',
    'setTTL(bytes32,uint64)',
    'ownerOf(uint256)',
    'getFuses(bytes32)',
    'allFusesBurned(bytes32,uint32)',
  ],
}

const INTERFACE_IDS = {}
const FN_SIGNATURES = {}
for (const k of Object.getOwnPropertyNames(INTERFACES)) {
  INTERFACE_IDS[k] = makeInterfaceId.ERC165(INTERFACES[k])
  for (const fnName of INTERFACES[k]) {
    // the interface id of a single function is equivalent to its function signature
    FN_SIGNATURES[fnName] = makeInterfaceId.ERC165([fnName])
  }
}

function shouldSupportInterfaces(contractUnderTest, interfaces = []) {
  describe('Contract interface', function() {
    beforeEach(function() {
      this.contractUnderTest = contractUnderTest()
    })

    for (const k of interfaces) {
      const interfaceId = INTERFACE_IDS[k]
      describe(k, function() {
        describe("ERC165's supportsInterface(bytes4)", function() {
          it('uses less than 30k gas [skip-on-coverage]', async function() {
            expect(
              await this.contractUnderTest.estimateGas.supportsInterface(
                interfaceId
              )
            ).to.be.lte(30000)
          })

          it('claims support', async function() {
            expect(
              await this.contractUnderTest.supportsInterface(interfaceId)
            ).to.equal(true)
          })
        })

        for (const fnName of INTERFACES[k]) {
          const fnSig = FN_SIGNATURES[fnName]
          describe(fnName, function() {
            it('has to be implemented', function() {
              expect(
                this.contractUnderTest.interface.getFunction(fnSig)
              ).to.not.throw
            })
          })
        }
      })
    }

    it('does not implement the forbidden interface', async function() {
      expect(
        await this.contractUnderTest.supportsInterface('0xffffffff')
      ).to.equal(false)
    })
  })
}

module.exports = {
  shouldSupportInterfaces,
}
