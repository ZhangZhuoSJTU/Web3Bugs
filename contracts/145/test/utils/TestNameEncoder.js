const TestNameEncoder = artifacts.require("TestNameEncoder.sol");
const { namehash, solidityKeccak256 } = require("ethers/lib/utils");
const { dns } = require("../test-utils");

contract("UniversalResolver", function(accounts) {
  let testNameEncoder;

  beforeEach(async () => {
    testNameEncoder = await TestNameEncoder.new();
  });

  describe("encodeName()", () => {
    it("should encode a name", async () => {
      const result = await testNameEncoder.encodeName("foo.eth");
      expect(result["0"]).to.equal(dns.hexEncodeName("foo.eth"));
      expect(result["1"]).to.equal(namehash("foo.eth"));
    });

    it("should encode an empty name", async () => {
      const result = await testNameEncoder.encodeName("");
      expect(result["0"]).to.equal(dns.hexEncodeName(""));
      expect(result["1"]).to.equal(namehash(""));
    });

    it("should encode a long name", async () => {
      const result = await testNameEncoder.encodeName(
        "something.else.test.eth"
      );
      expect(result["0"]).to.equal(
        dns.hexEncodeName("something.else.test.eth")
      );
      expect(result["1"]).to.equal(namehash("something.else.test.eth"));
    });
  });
});
