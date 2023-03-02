const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");

describe("MetaContext", function () {

  let metacontexttest;
  let forwarder;
  let owner;
  let node;
  let user;

  before(async function () {
    await deployments.fixture(['test']);
    [owner, node, user] = await ethers.getSigners();
    const MetaContextTest = await ethers.getContractFactory("MetaContextTest");
    metacontexttest = await MetaContextTest.deploy();
    const Forwarder = await ethers.getContractFactory("Forwarder");
    forwarder = await Forwarder.deploy();
    await metacontexttest.connect(owner).setTrustedForwarder(forwarder.address, true);
  });

  describe("MetaContext", function () {
    it("Should have Forwarder as a trusted forwarder", async function () {
      expect(await metacontexttest.isTrustedForwarder(forwarder.address)).to.equal(true);
    });
    it("Should have correct _msgSender() when not using meta transactions", async function () {
      await metacontexttest.connect(owner).getMsgSender(40);
      expect(await metacontexttest.msgSender()).to.equal(await owner.getAddress());
      expect(await metacontexttest.value()).to.equal(40);
    });
    it("Should have correct _msgData() when not using meta transactions", async function () {
      await metacontexttest.connect(owner).getMsgData();
      expect(await metacontexttest.connect(owner).msgData()).to.equal("0xc8e7ca2e");
    });
    it("Should have correct _msgSender() when using meta transactions", async function () {
      const domain = {
        name: "MinimalForwarder",
        version: "0.0.1",
        chainId: 31337,
        verifyingContract: forwarder.address
      };
      const types = {
        ForwardRequest: [
          {name: 'from', type: 'address' },
          {name: 'to', type: 'address' },
          {name: 'value', type: 'uint256' },
          {name: 'gas', type: 'uint256' },
          {name: 'nonce', type: 'uint256' },
          {name: 'data', type: 'bytes' },
        ]
      };

      let ABI = [
        "function getMsgSender(uint _value)"
      ];
      let interface = new ethers.utils.Interface(ABI);
      const inputData = interface.encodeFunctionData("getMsgSender", [50]);
      const value = {
        from: await user.getAddress(),
        to: metacontexttest.address,
        value: 0,
        gas: 50000,
        nonce: 0,
        data: inputData
      };

      let signature = await user._signTypedData(domain, types, value);
      await forwarder.connect(owner).execute(
        [await user.getAddress(), metacontexttest.address, 0, 50000, 0, inputData],
        signature
      );
      expect(await metacontexttest.msgSender()).to.equal(await user.getAddress());
      expect(await metacontexttest.value()).to.equal(50);
    });

    it("Should have correct _msgData() when using meta transactions", async function () {
      const domain = {
        name: "MinimalForwarder",
        version: "0.0.1",
        chainId: 31337,
        verifyingContract: forwarder.address
      };
      const types = {
        ForwardRequest: [
          {name: 'from', type: 'address' },
          {name: 'to', type: 'address' },
          {name: 'value', type: 'uint256' },
          {name: 'gas', type: 'uint256' },
          {name: 'nonce', type: 'uint256' },
          {name: 'data', type: 'bytes' },
        ]
      };

      let ABI = [
        "function getMsgData()"
      ];
      let interface = new ethers.utils.Interface(ABI);
      const inputData = interface.encodeFunctionData("getMsgData", []);
      const value = {
        from: await user.getAddress(),
        to: metacontexttest.address,
        value: 0,
        gas: 50000,
        nonce: 1,
        data: inputData
      };

      let signature = await user._signTypedData(domain, types, value);
      await forwarder.connect(owner).execute(
        [await user.getAddress(), metacontexttest.address, 0, 50000, 1, inputData],
        signature
      );
      expect(await metacontexttest.msgData()).to.equal(inputData);
    });
  });
});
