const { expect } = require("chai");
const { deployments, ethers } = require("hardhat");

describe("govnft", function () {

  let govnft;

  let owner;
  let node;
  let user;

  let GovNFT;
  let StableToken;
  let Forwarder;

  let forwarder;
  let stabletoken;

  let Endpoint;
  let endpoint;

  before(async function () {
    await deployments.fixture(['test']);
    [owner, node, user] = await ethers.getSigners();
    GovNFT = await deployments.get("GovNFT");
    govnft = await ethers.getContractAt("GovNFT", GovNFT.address);
    Forwarder = await deployments.get("Forwarder");
    forwarder = await ethers.getContractAt("Forwarder", Forwarder.address);
    Endpoint = await deployments.get("MockEndpoint");
    endpoint = await ethers.getContractAt("LZEndpointMock", Endpoint.address);
    await endpoint.connect(owner).setDestLzEndpoint(GovNFT.address, Endpoint.address);
    StableToken = await deployments.get("StableToken");
    stabletoken = await ethers.getContractAt("StableToken", StableToken.address);
    await stabletoken.connect(owner).setMinter(owner.getAddress(), true);
    await stabletoken.connect(owner).mintFor(owner.getAddress(), 1000000);
    await govnft.connect(owner).setTrustedAddress(31337, GovNFT.address, true);
  });

  describe("Setters", function () {
    it("Setting new gas value", async function () {
      await govnft.connect(owner).setGas(200000);
      expect(await govnft.gas()).to.equal(200000);
      await govnft.connect(owner).setEndpoint(Endpoint.address);
      expect(await govnft.endpoint()).to.equal(Endpoint.address);
      await expect(govnft.connect(owner).setEndpoint(ethers.constants.AddressZero)).to.be.revertedWith("ZeroAddress");
    });
  });
  describe("Reward system related functions", function () {
    it("Listing an already listed token should revert", async function () {
      await expect(govnft.connect(owner).addAsset(StableToken.address)).to.be.revertedWith("Already added");
    });   
    it("Distributing tokens without NFT supply should simply return", async function () {
      await govnft.connect(owner).distribute(StableToken.address, 1000);
      expect(await stabletoken.balanceOf(owner.getAddress())).to.equal(1000000);
    });
    it("Minting NFTs should increase total supply and return currect balanceIds", async function () {
      await govnft.connect(owner).mint();
      await govnft.connect(owner).mint();
      expect(await govnft.totalSupply()).to.equal(2);
      let result = await govnft.balanceIds(owner.address);
      let ids = [];
      for(let i=0; i<result.length; i++) {
        ids.push(result[i].toString());
      }
      expect(ids.toString()).to.equal(['1', '2'].toString());
    });
    it("Distributing an unapproved token should simply return", async function () {
      await govnft.connect(owner).distribute(StableToken.address, 1000);
      expect(await stabletoken.balanceOf(owner.getAddress())).to.equal(1000000);
    });
    it("Distributing tokens should increase pending rewards by expected amount", async function () {
      await stabletoken.connect(owner).approve(GovNFT.address, 1000000);
      await govnft.connect(owner).distribute(StableToken.address, 1000);
      expect(await stabletoken.balanceOf(owner.getAddress())).to.equal(999000);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1000);
    });
    it("Transferring NFTs should not affect pending rewards", async function () {
      await govnft.connect(owner).transferFrom(owner.getAddress(), user.getAddress(), 1);
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(1);
      expect(await govnft.balanceOf(user.getAddress())).to.equal(1);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1000);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(0);
    });
    it("Distributing tokens with multiple NFT holders should increase pending rewards by expected amount", async function () {
      await govnft.connect(owner).distribute(StableToken.address, 1000);
      expect(await stabletoken.balanceOf(owner.getAddress())).to.equal(998000);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(500);
    });
    it("Minting NFTs should not affect pending rewards", async function () {
      await govnft.connect(owner).mint();
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(500);
    });
    it("Delisting an asset should not affect pending rewards", async function () {
      await govnft.connect(owner).setAllowedAsset(StableToken.address, false);
      expect(await govnft.allowedAsset(StableToken.address)).to.equal(false);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(500);
    });
    it("Transferring an NFT with pending delisted rewards should not affect pending rewards", async function () {
      await govnft.connect(owner).safeTransferMany(user.getAddress(), [2,3]);
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(0);
      expect(await govnft.balanceOf(user.getAddress())).to.equal(3);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(500);
    });
    it("Transferring an NFT via approval should not affect pending rewards", async function () {
      await govnft.connect(user).approveMany(owner.getAddress(), [1,2,3]);
      await govnft.connect(owner).safeTransferFromMany(user.getAddress(), owner.getAddress(), [1,2,3]);
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(3);
      expect(await govnft.balanceOf(user.getAddress())).to.equal(0);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(500);
    });
    it("Transferring and approving unowned NFTs in any way should revert", async function () {
      await expect(govnft.connect(user).approveMany(owner.getAddress(), [1,2,3])).to.be.revertedWith("ERC721: approval to current owner");
      await expect(govnft.connect(user).approveMany(node.getAddress(), [1,2,3])).to.be.revertedWith("ERC721: approve caller is not token owner or approved for all");
      await expect(govnft.connect(owner).safeTransferFromMany(user.getAddress(), owner.getAddress(), [1,2,3])).to.be.revertedWith("!Owner");
      await expect(govnft.connect(user).safeTransferMany(owner.getAddress(), [1,2,3])).to.be.revertedWith("!Owner");
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(3);
      expect(await govnft.balanceOf(user.getAddress())).to.equal(0);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(500);
    });
    it("Bridging NFTs should not affect pending rewards", async function () {
      await govnft.connect(owner).crossChain(31337, GovNFT.address, user.getAddress(), [3]);
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(2);
      expect(await govnft.balanceOf(user.getAddress())).to.equal(1);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(500);
    });
    it("Claiming pending rewards should transfer claimer expected rewards", async function () {
      await govnft.connect(user).claim(StableToken.address);
      expect(await stabletoken.balanceOf(user.getAddress())).to.equal(500);
    });
    it("Claiming pending rewards should set pending rewards back to zero only for claimer", async function () {
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(0);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
    });
    it("Transferring NFTs after claiming should not affect pending rewards", async function () {
      await govnft.connect(owner).safeTransferFromMany(owner.getAddress(), user.getAddress(), [1,2]);
      await govnft.connect(user).transferFrom(user.getAddress(), owner.getAddress(), 3);
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(1);
      expect(await govnft.balanceOf(user.getAddress())).to.equal(2);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(1500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(0);
      await govnft.connect(owner).claim(StableToken.address);
      expect(await stabletoken.balanceOf(owner.getAddress())).to.equal(999500);
      await govnft.connect(user).crossChain(31337, GovNFT.address, owner.getAddress(), [1]);
      await govnft.connect(owner).mint();
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(3);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(0);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(0);
    });
    it("Distributing after claiming should work as intended", async function () {
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(3);
      expect(await govnft.balanceOf(user.getAddress())).to.equal(1);
      await stabletoken.connect(user).approve(GovNFT.address, 500);
      await govnft.connect(owner).setAllowedAsset(StableToken.address, true);
      expect(await govnft.allowedAsset(StableToken.address)).to.equal(true);
      await govnft.connect(user).distribute(StableToken.address, 500);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(125);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(375);
      await govnft.connect(owner).claim(StableToken.address);
      await govnft.connect(owner).transferFrom(owner.getAddress(), user.getAddress(), 4);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(125);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(0);
      await govnft.connect(user).claim(StableToken.address);
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(0);
      await govnft.connect(owner).mint();
      expect(await govnft.pending(user.getAddress(), StableToken.address)).to.equal(0);
      expect(await govnft.pending(owner.getAddress(), StableToken.address)).to.equal(0);
    });
    describe("Minting should be hard-capped at 10,000 NFTs", async function () {
      // Split up to avoid a timeout and an annoying wait time without seeing progress
      for (let i=0; i<33; i++) {
        it("Minting NFTs", async function () {
          await govnft.connect(owner).mintMany(300);
        });
      }
      it("Minting NFTs II", async function () {
        await govnft.connect(owner).mintMany(95);
      });
      it("Minting NFT 10001 should revert", async function () {
        await expect(govnft.connect(owner).mint()).to.be.revertedWith("Exceeds supply");
      });
    });
  });
  describe("Crosschain related functions", function () {
    it("Estimating oracle fee", async function () {
      await endpoint.connect(owner).setEstimatedFees(1000, 0);
      expect(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["uint","uint"],
        await govnft.estimateFees(
          31337,
          GovNFT.address,
          ethers.constants.AddressZero,
          false,
          ethers.constants.AddressZero
        )
      ))).to.equal(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint","uint"], [20000,0]))
      );
    });
    it("Bridging without paying the bridging fee should revert", async function () {
      await expect(govnft.connect(owner).crossChain(31337, GovNFT.address, user.getAddress(), [1,3,5])).to.be.revertedWith("Must send enough value to cover messageFee");
    });
    it("Bridging someone else's NFTs should revert", async function () {
      await expect(govnft.connect(owner).crossChain(31337, GovNFT.address, user.getAddress(), [2])).to.be.revertedWith("Not the owner");
    });
    it("Bridging should bridge the correct IDs to the expected target address", async function () {
      await govnft.connect(owner).crossChain(31337, GovNFT.address, user.getAddress(), [1,3,5], {value: 200000});
      expect(await govnft.balanceOf(owner.getAddress())).to.equal(9995);
      expect(await govnft.balanceOf(user.getAddress())).to.equal(5);
    });
    it("Non-endpoint address calling lzReceive should revert", async function () {
      await expect(govnft.connect(owner).lzReceive(31337, GovNFT.address, 0, ethers.constants.AddressZero)).to.be.revertedWith("!Endpoint");
    });
    it("User calling _bridgeMint should revert", async function () {
      await expect(govnft.connect(user)._bridgeMint(user.address, 10000)).to.be.revertedWith("NotBridge");
    });
    it("Owner calling _bridgeMint should work", async function () {
      await govnft.connect(owner)._bridgeMint(user.address, 0);
    });
    it("Owner calling _bridgeMint should with ID > 10000 should revert", async function () {
      await expect(govnft.connect(owner)._bridgeMint(user.address, 10001)).to.be.revertedWith("BadID");
    });
    it("Bridging should revert if target address isn't set as trusted", async function () {
      await govnft.connect(owner).setTrustedAddress(31337, GovNFT.address, false);
      await expect(govnft.connect(owner).crossChain(31337, GovNFT.address, user.getAddress(), [1000], {value: 200000})).to.be.revertedWith("!Trusted");
    });
  });
  describe("BaseURI related functions", function () {
    it("User setting baseURI should revert", async function () {
      await expect(govnft.connect(user).setBaseURI("ipfs://abc.xyz/")).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Owner setting baseURI should set URI", async function () {
      await govnft.connect(owner).setBaseURI("ipfs://abc.xyz/");
      expect(await govnft.baseURI()).to.equal("ipfs://abc.xyz/");
    });
    it("TokenURI should use new baseURI", async function () {
      expect(await govnft.tokenURI(1)).to.equal("ipfs://abc.xyz/1");
      expect(await govnft.tokenURI(2)).to.equal("ipfs://abc.xyz/2");
    });
  });
});
