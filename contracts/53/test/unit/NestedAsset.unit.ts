import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { NestedAsset, NestedAsset__factory } from "../../typechain";
import { BigNumber } from "ethers";

describe("NestedAsset", () => {
    let NestedAsset: NestedAsset__factory, asset: NestedAsset;
    let factory: SignerWithAddress,
        otherFactory: SignerWithAddress,
        alice: SignerWithAddress,
        bob: SignerWithAddress,
        feeToSetter: SignerWithAddress,
        feeTo: SignerWithAddress;
    const metadataUri = "ipfs://bafybeiam5u4xc5527tv6ghlwamd6azfthmcuoa6uwnbbvqbtsyne4p7khq/metadata.json";

    before(async () => {
        NestedAsset = await ethers.getContractFactory("NestedAsset");

        const signers = await ethers.getSigners();
        // All transaction will be sent from the factory unless explicity specified
        factory = signers[0];
        alice = signers[1];
        bob = signers[2];
        otherFactory = signers[3];
        feeToSetter = signers[4];
        feeTo = signers[5];
    });

    beforeEach(async () => {
        asset = await NestedAsset.deploy();
        await asset.setFactory(factory.address);
        await asset.deployed();
    });

    describe("#mint", () => {
        describe("when creating NFTs from scratch", async () => {
            it("should create ERC-721 tokens with relevant tokenIds", async () => {
                await asset.mint(alice.address, 0);
                await asset.mint(alice.address, 0);
                await asset.mint(bob.address, 0);
                expect(await asset.balanceOf(alice.address)).to.equal("2");
                expect(await asset.balanceOf(bob.address)).to.equal("1");
                expect(await asset.tokenOfOwnerByIndex(alice.address, 0)).to.equal("1");
                expect(await asset.tokenOfOwnerByIndex(alice.address, 1)).to.equal("2");
                expect(await asset.tokenOfOwnerByIndex(bob.address, 0)).to.equal("3");
            });
        });

        describe("when replicating NFTs", async () => {
            it("should create ERC-721s and store the original asset used for replication", async () => {
                await asset.mint(alice.address, 0);
                await asset.mint(alice.address, 1);
                await asset.mint(bob.address, 2);
                expect(await asset.originalAsset(1)).to.equal(0);
                expect(await asset.originalAsset(2)).to.equal(1);
                expect(await asset.originalAsset(3)).to.equal(1);
            });

            it("should revert if replicate id doesnt exist", async () => {
                await expect(asset.mint(alice.address, 1)).to.be.revertedWith(
                    "NestedAsset::mint: Invalid replicated token ID",
                );
                await expect(asset.mint(alice.address, 10)).to.be.revertedWith(
                    "NestedAsset::mint: Invalid replicated token ID",
                );
            });
        });

        it("should revert if the caller is not the factory", async () => {
            // Alice tries to mint a token for herself and bypass the factory
            await expect(asset.connect(alice).mint(alice.address, 0)).to.be.revertedWith(
                "NestedAsset: FORBIDDEN_NOT_FACTORY",
            );
        });
    });

    describe("#tokenURI", () => {
        it("should display NFT metadata", async () => {
            await asset.mintWithMetadata(alice.address, metadataUri, 0);
            const tokenId = await asset.tokenOfOwnerByIndex(alice.address, 0);
            expect(await asset.tokenURI(tokenId)).to.equal(metadataUri);
        });

        it("reverts if the token does not exist", async () => {
            await expect(asset.tokenURI(1)).to.be.revertedWith("URI query for nonexistent token");
        });
    });

    describe("#burn", () => {
        it("should burn the user's ERC-721 token", async () => {
            await asset.mint(alice.address, 0);
            expect(await asset.balanceOf(alice.address)).to.equal("1");
            await asset.burn(alice.address, 1);
            expect(await asset.balanceOf(alice.address)).to.equal("0");
            expect(await asset.lastOwnerBeforeBurn(1)).to.eq(alice.address);
        });

        it("should delete", async () => {
            await asset.mint(alice.address, 0);
            expect(await asset.balanceOf(alice.address)).to.equal("1");
            await asset.burn(alice.address, 1);
            expect(await asset.balanceOf(alice.address)).to.equal("0");
            expect(await asset.lastOwnerBeforeBurn(1)).to.eq(alice.address);
        });

        it("should revert when burning non existing token", async () => {
            await expect(asset.burn(alice.address, 1)).to.be.revertedWith("ERC721: owner query for nonexistent token");
        });

        it("should revert if the caller is not the factory", async () => {
            // Alice tries to burn the token herself and bypass the factory
            await expect(asset.connect(alice).burn(alice.address, 1)).to.be.revertedWith(
                "NestedAsset: FORBIDDEN_NOT_FACTORY",
            );
        });

        it("should revert when burning someone else's token", async () => {
            await asset.mint(bob.address, 0);

            // Alice asked to burn Bob's token
            await expect(asset.burn(alice.address, 1)).to.be.revertedWith("NestedAsset: FORBIDDEN_NOT_OWNER");
        });
    });

    describe("#backfillTokenURI", () => {
        beforeEach(async () => {
            await asset.mint(bob.address, 0);
        });

        it("should revert the URI is already set", async () => {
            await asset.backfillTokenURI(1, bob.address, "ipfs://tokenURI");
            await expect(asset.backfillTokenURI(1, bob.address, "ipfs://newTokenURI")).to.be.revertedWith(
                "NestedAsset: TOKEN_URI_IMMUTABLE",
            );
        });

        it("should revert if the caller is not the factory", async () => {
            await expect(asset.connect(bob).backfillTokenURI(1, bob.address, "ipfs://newTokenURI")).to.be.revertedWith(
                "NestedAsset: FORBIDDEN_NOT_FACTORY",
            );
        });

        it("should revert if the token does not belong to the owner", async () => {
            await expect(asset.backfillTokenURI(1, alice.address, "ipfs://newTokenURI")).to.be.revertedWith(
                "NestedAsset: FORBIDDEN_NOT_OWNER",
            );
        });

        it("sets the token uri", async () => {
            await asset.backfillTokenURI(1, bob.address, "ipfs://newTokenURI");
            expect(await asset.tokenURI(1)).to.eq("ipfs://newTokenURI");
        });
    });

    describe("#originalOwner", () => {
        beforeEach(async () => {
            await asset.mint(alice.address, 0);
            await asset.mint(bob.address, 1);
        });

        it("returns the owner address of the original asset", async () => {
            expect(await asset.originalOwner(1)).to.eq("0x0000000000000000000000000000000000000000");
            expect(await asset.originalOwner(2)).to.eq(alice.address);
        });

        it("returns the owner address of the original burnt asset", async () => {
            await asset.burn(alice.address, 1);
            expect(await asset.originalOwner(2)).to.eq(alice.address);
        });
    });

    describe("#setFactory", () => {
        it("sets the new factory", async () => {
            await expect(asset.setFactory(otherFactory.address))
                .to.emit(asset, "FactoryAdded")
                .withArgs(otherFactory.address);
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(true);
        });

        it("reverts if unauthorized", async () => {
            await expect(asset.connect(alice).setFactory(otherFactory.address)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(false);
        });

        it("reverts if the address is invalid", async () => {
            await expect(asset.setFactory("0x0000000000000000000000000000000000000000")).to.be.revertedWith(
                "NestedAsset: INVALID_ADDRESS",
            );
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(false);
        });
    });

    describe("#removeFactory", () => {
        it("remove a factory", async () => {
            await asset.setFactory(otherFactory.address);
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(true);
            await expect(asset.removeFactory(otherFactory.address))
                .to.emit(asset, "FactoryRemoved")
                .withArgs(otherFactory.address);
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(false);
        });

        it("reverts if unauthorized", async () => {
            await asset.setFactory(otherFactory.address);
            await expect(asset.connect(alice).removeFactory(otherFactory.address)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
            expect(await asset.supportedFactories(otherFactory.address)).to.equal(true);
        });

        it("reverts if already not supported", async () => {
            await expect(asset.removeFactory(otherFactory.address)).to.be.revertedWith(
                "NestedAsset: ALREADY_NOT_SUPPORTED",
            );

            await expect(asset.removeFactory(ethers.constants.AddressZero)).to.be.revertedWith(
                "NestedAsset: ALREADY_NOT_SUPPORTED",
            );
        });
    });
});
