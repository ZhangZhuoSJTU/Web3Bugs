import { deployContract } from "ethereum-waffle";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { beforeEach, describe, it } from "mocha";
import BasicTokenJSON from "../artifacts/contracts/test/BasicERC20.sol/BasicERC20.json";
import { AssetsRegistry, MockERC20, QuantConfig } from "../typechain";
import { expect, provider } from "./setup";
import {
  deployAssetsRegistry,
  deployQuantConfig,
  mockERC20,
} from "./testUtils";

type AssetProperties = [string, string, string, number];

describe("AssetsRegistry", () => {
  let quantConfig: QuantConfig;
  let assetsRegistry: AssetsRegistry;
  let deployer: Signer;
  let secondAccount: Signer;
  let WETH: MockERC20;
  let BUSD: MockERC20;
  let WETHProperties: AssetProperties;
  let BUSDProperties: AssetProperties;

  beforeEach(async () => {
    [deployer, secondAccount] = provider.getWallets();

    WETH = await mockERC20(deployer, "WETH", "Wrapped Ether");
    BUSD = await mockERC20(deployer, "BUSD", "BUSD Token", 18);

    WETHProperties = [
      WETH.address,
      await WETH.name(),
      await WETH.symbol(),
      await WETH.decimals(),
    ];

    BUSDProperties = [
      BUSD.address,
      await BUSD.name(),
      await BUSD.symbol(),
      await BUSD.decimals(),
    ];

    quantConfig = await deployQuantConfig(deployer, [
      {
        addresses: [await deployer.getAddress()],
        role: "ASSETS_REGISTRY_MANAGER_ROLE",
      },
    ]);

    assetsRegistry = await deployAssetsRegistry(deployer, quantConfig);
  });

  describe("addAsset", () => {
    it("AssetsRegistry managers should be able to add assets to the registry", async () => {
      await assetsRegistry.connect(deployer).addAsset(...WETHProperties);

      expect(await assetsRegistry.assetProperties(WETH.address)).to.eql(
        WETHProperties.slice(1)
      );
    });

    it("Should revert when an unauthorized account tries to add an asset", async () => {
      await expect(
        assetsRegistry.connect(secondAccount).addAsset(...BUSDProperties)
      ).to.be.revertedWith(
        "AssetsRegistry: only asset registry managers can add assets"
      );
    });

    it("Should revert when trying to add a duplicate asset", async () => {
      await assetsRegistry.connect(deployer).addAsset(...WETHProperties);

      await expect(
        assetsRegistry.connect(deployer).addAsset(...WETHProperties)
      ).to.be.revertedWith("AssetsRegistry: asset already added");
    });

    it("Should use passed parameters when tokens don't implement optional ERC20 methods", async () => {
      const basicToken = await deployContract(deployer, BasicTokenJSON);
      await assetsRegistry
        .connect(deployer)
        .addAsset(basicToken.address, "Basic Token", "BASIC", 14);

      expect(await assetsRegistry.assetProperties(basicToken.address)).to.eql([
        "Basic Token",
        "BASIC",
        14,
      ]);
    });

    it("Should emit the AssetAdded event", async () => {
      await expect(assetsRegistry.connect(deployer).addAsset(...BUSDProperties))
        .to.emit(assetsRegistry, "AssetAdded")
        .withArgs(...BUSDProperties);
    });

    it("Should add assets to the registeredAssets array", async () => {
      expect(await assetsRegistry.getAssetsLength()).to.equal(
        ethers.BigNumber.from("0")
      );

      await assetsRegistry.connect(deployer).addAsset(...WETHProperties);

      expect(await assetsRegistry.getAssetsLength()).to.equal(
        ethers.BigNumber.from("1")
      );

      expect(await assetsRegistry.registeredAssets(0)).to.equal(WETH.address);
    });
  });
});
