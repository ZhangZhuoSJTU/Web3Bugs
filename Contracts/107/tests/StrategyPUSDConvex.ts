import { JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network, upgrades } from "hardhat";
import {
  Controller,
  FungibleAssetVaultForDAO,
  IBaseRewardPool,
  IBooster,
  ICurve,
  IERC20,
  ISwapRouter,
  IUniswapV2Router,
  JPEG,
  StableCoin,
  StrategyPUSDConvex,
  TestERC20,
  WETH,
  YVault,
} from "../types";
import { units, ZERO_ADDRESS } from "./utils";

const { expect } = chai;

chai.use(solidity);

const strategist_role =
  "0x17a8e30262c1f919c33056d877a3c22b95c2f5e4dac44683c1c2323cd79fbdb0";
const whitelisted_role =
  "0x8429d542926e6695b59ac6fbdcd9b37e8b1aeb757afab06ab60b1bb5878c3b49";
const minter_role =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

//this is the only contract that requires mainnet forking to test,
//unfortunately we can't use hardhat_reset as that breaks solidity-coverage
describe("StrategyPUSDConvex", () => {
  let owner: SignerWithAddress;
  let strategy: StrategyPUSDConvex, yVault: YVault, controller: Controller;
  let sushiRouter: IUniswapV2Router, uniswapV3Router: ISwapRouter;
  let usdcVault: FungibleAssetVaultForDAO;
  let curve: ICurve, booster: IBooster;
  let spellRewardPool : IBaseRewardPool,
    cvxRewardPool: IBaseRewardPool,
    crvRewardPool: IBaseRewardPool,
    jpegRewardPool: IBaseRewardPool
  let want: TestERC20,
    jpeg: JPEG,
    cvx: IERC20,
    crv: IERC20,
    spell: IERC20,
    pusd: StableCoin,
    weth: WETH,
    usdc: IERC20;
  let cvxSigner: JsonRpcSigner,
    crvSigner: JsonRpcSigner,
    spellSigner: JsonRpcSigner,
    usdcSigner: JsonRpcSigner;

  let snapshot: string;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];

    snapshot = (await network.provider.request({
      method: "evm_snapshot",
      params: [],
    })) as string;

    const JPEG = await ethers.getContractFactory("JPEG");
    jpeg = await JPEG.deploy(units(0));
    await jpeg.deployed();
    await jpeg.grantRole(minter_role, owner.address);

    const Controller = await ethers.getContractFactory("Controller");
    controller = await Controller.deploy(jpeg.address, owner.address);
    await controller.deployed();
    await controller.grantRole(strategist_role, owner.address);

    const Stablecoin = await ethers.getContractFactory("StableCoin");
    pusd = await Stablecoin.deploy();
    await pusd.deployed();

    weth = <WETH>(
      await ethers.getContractAt(
        "WETH",
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        owner
      )
    );
    cvx = <IERC20>(
      await ethers.getContractAt(
        "IERC20",
        "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b",
        owner
      )
    );
    crv = <IERC20>(
      await ethers.getContractAt(
        "IERC20",
        "0xD533a949740bb3306d119CC777fa900bA034cd52",
        owner
      )
    );
    spell = <IERC20>(
      await ethers.getContractAt(
        "IERC20",
        "0x090185f2135308bad17527004364ebcc2d37e5f6",
        owner
      )
    );
    usdc = <IERC20>(
      await ethers.getContractAt(
        "IERC20",
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        owner
      )
    );

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x0aca67fa70b142a3b9bf2ed89a81b40ff85dacdc"],
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x7a16ff8270133f063aab6c9977183d9e72835428"],
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2"],
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0"],
    });

    cvxSigner = ethers.provider.getSigner(
      "0x0aca67fa70b142a3b9bf2ed89a81b40ff85dacdc"
    );
    crvSigner = ethers.provider.getSigner(
      "0x7a16ff8270133f063aab6c9977183d9e72835428"
    );
    spellSigner = ethers.provider.getSigner(
      "0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2"
    );
    usdcSigner = ethers.provider.getSigner(
      "0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0"
    );

    const ERC20 = await ethers.getContractFactory("TestERC20");

    want = await ERC20.deploy("WANT", "WANT");
    const mim = await ERC20.deploy("MIM", "MIM");
    const usdt = await ERC20.deploy("USDT", "USDT");

    await want.deployed();

    const YVault = await ethers.getContractFactory("YVault");
    yVault = await YVault.deploy(want.address, controller.address, {
      numerator: 100,
      denominator: 100,
    });
    await yVault.deployed();
    await yVault.setFarmingPool(owner.address);

    const MockOracle = await ethers.getContractFactory("MockV3Aggregator");
    const oracle = await MockOracle.deploy(8, 1e8);
    await oracle.deployed();

    const AssetVault = await ethers.getContractFactory(
      "FungibleAssetVaultForDAO"
    );
    usdcVault = <FungibleAssetVaultForDAO>(
      await upgrades.deployProxy(AssetVault, [
        usdc.address,
        pusd.address,
        oracle.address,
        [100, 100],
      ])
    );
    await usdcVault.deployed();
    await usdcVault.grantRole(whitelisted_role, owner.address);
    await pusd.grantRole(minter_role, usdcVault.address);

    const RewardPool = await ethers.getContractFactory("MockRewardPool");
    spellRewardPool = await RewardPool.deploy(
      want.address,
      spell.address,
      []
    );
    await spellRewardPool.deployed();

    cvxRewardPool = await RewardPool.deploy(
      want.address,
      cvx.address,
      []
    );

    jpegRewardPool = await RewardPool.deploy(
      want.address,
      jpeg.address,
      []
    );

    crvRewardPool = await RewardPool.deploy(
      want.address,
      crv.address,
      [spellRewardPool.address, cvxRewardPool.address, jpegRewardPool.address]
    );

    const Booster = await ethers.getContractFactory("MockBooster");
    booster = await Booster.deploy(want.address, crvRewardPool.address);
    await booster.deployed();

    const Curve = await ethers.getContractFactory("MockCurve");
    curve = await Curve.deploy(want.address, [
      usdc.address,
      pusd.address,
      mim.address,
      usdt.address,
    ]);
    await curve.deployed();

    sushiRouter = <IUniswapV2Router>(
      await ethers.getContractAt(
        "IUniswapV2Router",
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        owner
      )
    );
    uniswapV3Router = <ISwapRouter>(
      await ethers.getContractAt(
        "ISwapRouter",
        "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        owner
      )
    );

    const Strategy = await ethers.getContractFactory("StrategyPUSDConvex");
    strategy = await Strategy.deploy(
      want.address,
      jpeg.address,
      pusd.address,
      weth.address,
      usdc.address,
      {
        uniswapV2: sushiRouter.address,
        uniswapV3: uniswapV3Router.address,
      },
      {
        curve: curve.address,
        usdcIndex: 0,
        pusdIndex: 1,
      },
      {
        booster: booster.address,
        baseRewardPool: crvRewardPool.address,
        pid: 1,
      },
      {
        rewardTokens: [spell.address, crv.address, cvx.address],
        controller: controller.address,
        usdcVault: usdcVault.address,
      },
      {
        numerator: 20,
        denominator: 100,
      }
    );
    await strategy.deployed();
    await strategy.grantRole(strategist_role, owner.address);
    await usdcVault.grantRole(whitelisted_role, strategy.address);

    await controller.approveStrategy(want.address, strategy.address);
    await controller.setStrategy(want.address, strategy.address);
  });

  afterEach(async () => {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("should return the correct name", async () => {
    expect(await strategy.getName()).to.equal("StrategyPUSDConvex");
  });

  it("should return the correct JPEG balance", async () => {
    await jpeg.mint(strategy.address, units(500));
    await jpeg.mint(jpegRewardPool.address, units(500));

    expect(await strategy.balanceOfJPEG()).to.equal(units(1000));
  });

  it("should allow the DAO to change controller", async () => {
    await expect(strategy.setController(ZERO_ADDRESS)).to.be.revertedWith(
      "INVALID_CONTROLLER"
    );

    await strategy.setController(owner.address);
    const { controller } = await strategy.strategyConfig();
    expect(controller).to.equal(owner.address);
  });

  it("should allow the DAO to change usdc vault", async () => {
    await expect(strategy.setUSDCVault(ZERO_ADDRESS)).to.be.revertedWith(
      "INVALID_USDC_VAULT"
    );

    await strategy.setUSDCVault(owner.address);
    const { usdcVault } = await strategy.strategyConfig();
    expect(usdcVault).to.equal(owner.address);
  });

  it("should deposit want on convex", async () => {
    await want.mint(strategy.address, units(500));
    await strategy.deposit();

    expect(await want.balanceOf(crvRewardPool.address)).to.equal(units(500));
  });

  it("should allow the controller to withdraw JPEG", async () => {
    await jpeg.mint(strategy.address, units(500));
    await jpeg.mint(jpegRewardPool.address, units(500));

    await controller.setVault(want.address, yVault.address);

    await yVault.withdrawJPEG();
    expect(await jpeg.balanceOf(owner.address)).to.equal(units(1000));
  });

  it("should allow the controller to withdraw non strategy tokens", async () => {
    await expect(strategy["withdraw(address)"](cvx.address)).to.be.revertedWith(
      "NOT_CONTROLLER"
    );

    await expect(
      controller.inCaseStrategyTokensGetStuck(strategy.address, want.address)
    ).to.be.revertedWith("want");
    await expect(
      controller.inCaseStrategyTokensGetStuck(strategy.address, usdc.address)
    ).to.be.revertedWith("usdc");
    await expect(
      controller.inCaseStrategyTokensGetStuck(strategy.address, pusd.address)
    ).to.be.revertedWith("pusd");
    await expect(
      controller.inCaseStrategyTokensGetStuck(strategy.address, weth.address)
    ).to.be.revertedWith("weth");
    await expect(
      controller.inCaseStrategyTokensGetStuck(strategy.address, jpeg.address)
    ).to.be.revertedWith("jpeg");

    await cvx.connect(cvxSigner).transfer(strategy.address, units(500));
    await controller.inCaseStrategyTokensGetStuck(
      strategy.address,
      cvx.address
    );

    expect(await cvx.balanceOf(controller.address)).to.equal(units(500));
  });

  it("should allow the controller to withdraw want", async () => {
    await controller.setVault(want.address, yVault.address);
    await want.mint(owner.address, units(500));
    await want.approve(yVault.address, units(500));

    await yVault.deposit(units(500));
    //earn calls the controller's earn which calls the strategy's deposit function
    await yVault.earn();
    expect(await want.balanceOf(crvRewardPool.address)).to.equal(units(500));

    await want.mint(strategy.address, units(500));

    await yVault.withdraw(units(250));
    expect(await want.balanceOf(owner.address)).to.equal(units(500));

    await yVault.withdrawAll();
    expect(await want.balanceOf(owner.address)).to.equal(units(1000));
  });

  it("should allow the controller to call withdrawAll", async () => {
    await want.mint(owner.address, units(500));
    await want.approve(yVault.address, units(500));

    await yVault.depositAll();
    //earn calls the controller's earn which calls the strategy's deposit function
    await yVault.earn();

    await expect(controller.withdrawAll(want.address)).to.be.revertedWith(
      "ZERO_VAULT"
    );

    await controller.setVault(want.address, yVault.address);
    await controller.withdrawAll(want.address);

    expect(await want.balanceOf(yVault.address)).to.equal(units(500));
  });

  it("should add liquidity with pusd when harvest is called and curve has less pusd than usdc", async () => {
    await expect(strategy.harvest(0)).to.be.revertedWith("NOOP");

    await spell.connect(spellSigner).transfer(spellRewardPool.address, units(500));
    await cvx.connect(cvxSigner).transfer(cvxRewardPool.address, units(500));

    await want.mint(curve.address, units(500));
    await usdc.connect(usdcSigner).transfer(curve.address, 500e6);
    await usdc.connect(usdcSigner).transfer(owner.address, 400e6);

    await usdc.approve(usdcVault.address, 400e6);
    await usdcVault.deposit(400e6);
    await usdcVault.borrow(units(400));
    await pusd.transfer(curve.address, units(400));

    await strategy.harvest(0);

    //subtract balance deposited by owner to borrow pusd
    const vaultAdditionalUSDCBalance = (
      await usdc.balanceOf(usdcVault.address)
    ).sub(400e6);
    expect(vaultAdditionalUSDCBalance).to.be.gt(0);

    const swappedUSDCTotal = vaultAdditionalUSDCBalance.mul(100).div(80);

    expect(await usdc.balanceOf(owner.address)).to.equal(
      swappedUSDCTotal.sub(vaultAdditionalUSDCBalance)
    );
    expect(await pusd.balanceOf(curve.address)).to.equal(
      vaultAdditionalUSDCBalance.mul(10 ** 12).add(units(400))
    );

    await expect(usdcVault.borrow(1)).to.be.revertedWith("insufficient_credit");

    const poolBalance = await strategy.balanceOfPool();
    expect(poolBalance).to.equal(units(500));
    expect(await want.balanceOf(crvRewardPool.address)).to.equal(poolBalance);
  });

  it("should add liquidity with usdc when harvest is called and curve has less usdc than pusd", async () => {
    await expect(strategy.harvest(0)).to.be.revertedWith("NOOP");

    await spell.connect(spellSigner).transfer(spellRewardPool.address, units(500));
    await cvx.connect(cvxSigner).transfer(cvxRewardPool.address, units(500));

    await want.mint(curve.address, units(500));
    await usdc.connect(usdcSigner).transfer(curve.address, 400e6);
    await usdc.connect(usdcSigner).transfer(owner.address, 500e6);

    await usdc.approve(usdcVault.address, 500e6);
    await usdcVault.deposit(500e6);
    await usdcVault.borrow(units(500));
    await pusd.transfer(curve.address, units(500));

    await strategy.harvest(0);

    //subtract usdc balance deposited in curve prior to the liquidity add
    const curveAdditionalUSDCBalance = (
      await usdc.balanceOf(curve.address)
    ).sub(400e6);
    expect(curveAdditionalUSDCBalance).to.be.gt(0);

    const swappedUSDCTotal = curveAdditionalUSDCBalance.mul(100).div(80);

    expect(await usdc.balanceOf(owner.address)).to.equal(
      swappedUSDCTotal.sub(curveAdditionalUSDCBalance)
    );

    const poolBalance = await strategy.balanceOfPool();
    expect(poolBalance).to.equal(units(500));
    expect(await want.balanceOf(crvRewardPool.address)).to.equal(poolBalance);
  });

  it("should revert on deploy with bad arguments", async () => {
    const Strategy = await ethers.getContractFactory("StrategyPUSDConvex");

    await expect(
      Strategy.deploy(
        ZERO_ADDRESS,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_WANT");

    await expect(
      Strategy.deploy(
        want.address,
        ZERO_ADDRESS,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_JPEG");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        ZERO_ADDRESS,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_PUSD");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        ZERO_ADDRESS,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_WETH");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        ZERO_ADDRESS,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_USDC");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: ZERO_ADDRESS,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_UNISWAP_V2");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: ZERO_ADDRESS,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_UNISWAP_V3");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: ZERO_ADDRESS,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_CURVE");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 0,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_CURVE_INDEXES");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 4,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_USDC_CURVE_INDEX");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 4,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_PUSD_CURVE_INDEX");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: ZERO_ADDRESS,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_CONVEX_BOOSTER");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: ZERO_ADDRESS,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_CONVEX_BASE_REWARD_POOL");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, ZERO_ADDRESS, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_REWARD_TOKEN");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: ZERO_ADDRESS,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_CONTROLLER");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: ZERO_ADDRESS,
        },
        {
          numerator: 20,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_USDC_VAULT");

    await expect(
      Strategy.deploy(
        want.address,
        jpeg.address,
        pusd.address,
        weth.address,
        usdc.address,
        {
          uniswapV2: sushiRouter.address,
          uniswapV3: uniswapV3Router.address,
        },
        {
          curve: curve.address,
          usdcIndex: 0,
          pusdIndex: 1,
        },
        {
          booster: booster.address,
          baseRewardPool: crvRewardPool.address,
          pid: 1,
        },
        {
          rewardTokens: [spell.address, crv.address, cvx.address],
          controller: controller.address,
          usdcVault: usdcVault.address,
        },
        {
          numerator: 104,
          denominator: 100,
        }
      )
    ).to.be.revertedWith("INVALID_RATE");
  });
});
