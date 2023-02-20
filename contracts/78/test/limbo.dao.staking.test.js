const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");

const requireCondition = (condition, message) => {
  if (!condition) throw message;
};
describe("DAO staking", function () {
  let owner, secondPerson, proposalFactory, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao,
    GovernableStubFactory,
    sushiSwapFactory,
    uniswapFactory,
    flashGovernance;
  const zero = "0x0000000000000000000000000000000000000000";
  beforeEach(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();
    const UniswapFactoryFactory = await ethers.getContractFactory(
      "UniswapFactory"
    );
    const UniswapPairFactory = await ethers.getContractFactory("UniswapPair");

    sushiSwapFactory = await UniswapFactoryFactory.deploy();
    uniswapFactory = await UniswapFactoryFactory.deploy();
    requireCondition(sushiSwapFactory.address !== uniswapFactory.address);

    daiEYESLP = await UniswapPairFactory.deploy(
      sushiSwapFactory.address,
      "Univ2",
      "Uv2"
    );
    linkEYESLP = await UniswapPairFactory.deploy(
      sushiSwapFactory.address,
      "Univ2",
      "Uv2"
    );
    sushiEYESLP = await UniswapPairFactory.deploy(
      sushiSwapFactory.address,
      "Univ2",
      "Uv2"
    );
    daiSushiSLP = await UniswapPairFactory.deploy(
      sushiSwapFactory.address,
      "Univ2",
      "Uv2"
    );

    daiEYEULP = await UniswapPairFactory.deploy(
      uniswapFactory.address,
      "Univ2",
      "Uv2"
    );
    linkEYEULP = await UniswapPairFactory.deploy(
      uniswapFactory.address,
      "Univ2",
      "Uv2"
    );
    sushiEYEULP = await UniswapPairFactory.deploy(
      uniswapFactory.address,
      "Univ2",
      "Uv2"
    );
    daiSushiULP = await UniswapPairFactory.deploy(
      uniswapFactory.address,
      "Univ2",
      "Uv2"
    );

    const TokenFactory = await ethers.getContractFactory("MockToken");
    dai = await TokenFactory.deploy(
      "dai",
      "dai",
      [
        daiEYESLP.address,
        daiSushiSLP.address,
        daiEYEULP.address,
        daiSushiULP.address,
      ],
      [120, 400, 500, 66]
    );
    eye = await TokenFactory.deploy(
      "eye",
      "eye",
      [
        daiEYESLP.address,
        linkEYESLP.address,
        sushiEYESLP.address,
        daiEYEULP.address,
        linkEYEULP.address,
        sushiEYEULP.address,
      ],
      [112, 332, 554, 33, 22, 121]
    );
    link = await TokenFactory.deploy(
      "link",
      "link",
      [linkEYESLP.address, linkEYEULP.address],
      [1123, 9]
    );
    sushi = await TokenFactory.deploy(
      "sushi",
      "sushi",
      [
        sushiEYESLP.address,
        daiSushiSLP.address,
        sushiEYEULP.address,
        daiSushiULP.address,
      ],
      [3322, 5543, 22, 112]
    );

    const TransferHelperFactory = await ethers.getContractFactory(
      "TransferHelper"
    );
    const daoFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        TransferHelper: (await TransferHelperFactory.deploy()).address,
      },
    });

    dao = await daoFactory.deploy();

    const flashGovernanceFactory = await ethers.getContractFactory(
      "FlashGovernanceArbiter"
    );
    flashGovernance = await flashGovernanceFactory.deploy(dao.address);

    GovernableStubFactory = await ethers.getContractFactory("GovernableStub");
    const limbo = await GovernableStubFactory.deploy(dao.address);
    const flan = await GovernableStubFactory.deploy(dao.address);

    await dao.seed(
      limbo.address,
      flan.address,
      eye.address,
      proposalFactory.address,
      sushiSwapFactory.address,
      uniswapFactory.address,
      flashGovernance.address,
      9,
      [daiEYESLP.address, linkEYESLP.address, sushiEYESLP.address],
      [daiEYEULP.address, linkEYEULP.address, sushiEYEULP.address]
    );

    const allAssets = [
      daiEYESLP,
      linkEYESLP,
      sushiEYESLP,
      daiSushiSLP,
      daiEYEULP,
      linkEYEULP,
      sushiEYEULP,
      daiSushiULP,
      eye,
    ];
    for (let i = 0; i < allAssets.length; i++) {
      await allAssets[i].approve(
        dao.address,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
    }
  });

  const advanceTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds]); //6 hours
    await network.provider.send("evm_mine");
  };
  const ONE = BigInt("1000000000000000000");
  const NAUGHT_POINT_ONE = ONE / 10n;

  const bigIntify = (num) => {
    return BigInt(num.toString());
  };
  
  it("only eye or approved assets can be staked", async function () {
    await dao.makeLive();
    await expect(
      dao.setEYEBasedAssetStake(100, 400, 20, daiSushiSLP.address)
    ).to.be.revertedWith("LimboDAO: illegal asset");
    await expect(
      dao.setEYEBasedAssetStake(100, 400, 20, daiSushiULP.address)
    ).to.be.revertedWith("LimboDAO: illegal asset");
  });

  it("Only live staking", async function () {
    await expect(
      dao.setEYEBasedAssetStake(100, 400, 20, sushiEYEULP.address)
    ).to.be.revertedWith("LimboDAO: DAO is not live.");
  });

  it("Staking Eye sets fate per day to root EYE ", async function () {
    const cloutBefore = await dao.stakedUserAssetWeight(
      owner.address,
      eye.address
    );
    expect(cloutBefore[0].toString()).to.equal("0");
    expect(cloutBefore[1].toString()).to.equal("0");
    await dao.makeLive();

    const userBalanceBefore = await eye.balanceOf(owner.address);
    const balanceOfDAObefore = await eye.balanceOf(dao.address);
    await dao.setEYEBasedAssetStake(100, 100, 10, eye.address);
    const balanceOfDAOAfter = await eye.balanceOf(dao.address);
    const userBalanceAfter = await eye.balanceOf(owner.address);

    expect(balanceOfDAOAfter.sub(balanceOfDAObefore).toString()).to.equal(
      "100"
    );
    expect(userBalanceBefore.sub(userBalanceAfter).toString()).to.equal("100");

    const cloutAfter = await dao.stakedUserAssetWeight(
      owner.address,
      eye.address
    );
    expect(cloutAfter[0].toString()).to.equal("10");
    expect(cloutAfter[1].toString()).to.equal("100");
  });

  it("Staking Eye and wait increases fate correctly", async function () {
    await dao.makeLive();

    await dao.setEYEBasedAssetStake(10000, 10000, 100, eye.address);

    await advanceTime(21600); // 6 hours

    await dao.incrementFateFor(owner.address);
    let fateState = await dao.fateState(owner.address);
    expect(fateState[1].toString()).to.equal("25");

    await dao.setEYEBasedAssetStake(400, 400, 20, eye.address);

    await advanceTime(172800); //2 days
    await dao.incrementFateFor(owner.address);
    fateState = await dao.fateState(owner.address);
    expect(fateState[0].toString()).to.equal("20");
    expect(fateState[1].toString()).to.equal("65");

    await dao.setEYEBasedAssetStake(62500, 62500, 250, eye.address);

    await advanceTime(28800); //8 hours
    await dao.incrementFateFor(owner.address);
    fateState = await dao.fateState(owner.address);
    expect(fateState[1].toString()).to.equal("148");
  });

  it("Staking LP set growth to 2 root eye balance", async function () {
    await dao.makeLive();
    const finalEyeBalance = NAUGHT_POINT_ONE * BigInt(56);
    const finalAssetBalance = 5n * ONE;
    const lpBalanceBefore = await daiEYESLP.balanceOf(owner.address);
    await dao.setEYEBasedAssetStake(
      finalAssetBalance,
      finalEyeBalance.toString(),
      "2366431913",
      daiEYESLP.address
    );

    const lpBalanceAfter = await daiEYESLP.balanceOf(owner.address);
    expect(lpBalanceBefore.sub(lpBalanceAfter).toString()).to.equal(
      finalAssetBalance.toString()
    );

    let fateState = await dao.fateState(owner.address);
    expect(fateState[0].toString()).to.equal((2366431913n * 2n).toString());

    const reducedAssetBalance = 25n * NAUGHT_POINT_ONE; // 2.5
    const reducedFinalEyeBalance = NAUGHT_POINT_ONE * BigInt(28);
    await dao.setEYEBasedAssetStake(
      reducedAssetBalance,
      reducedFinalEyeBalance.toString(),
      "1673320053",
      daiEYESLP.address
    );
    const lpBalanceAfterReduction = await daiEYESLP.balanceOf(owner.address);

    expect(lpBalanceAfterReduction.sub(lpBalanceAfter).toString()).to.equal(
      reducedAssetBalance.toString()
    );

    fateState = await dao.fateState(owner.address);
    expect(fateState[0].toString()).to.equal((1673320053n * 2n).toString());

    const increasedAssetBalance = 6n * ONE;
    const increasedFinalEyeBalance = (NAUGHT_POINT_ONE * BigInt(672)) / 10n;
    const increasedRootEYE = 2592296279n;
    await dao.setEYEBasedAssetStake(
      increasedAssetBalance,
      increasedFinalEyeBalance.toString(),
      increasedRootEYE,
      daiEYESLP.address
    );

    fateState = await dao.fateState(owner.address);
    expect(fateState[0].toString()).to.equal(
      (increasedRootEYE * 2n).toString()
    );
  });

  //Tests staking and unstaking
  it("Staking multiple asset types sets fate rate correctly", async function () {
    await dao.makeLive();
    const balanceOfDaiEYESLPBeforeStake = await daiEYESLP.balanceOf(
      owner.address
    );

    let finalEyeBalance = NAUGHT_POINT_ONE * BigInt(56);
    let finalAssetBalance = 5n * ONE;
    let rootEYEOfLP = 2366431913n;
    await dao.setEYEBasedAssetStake(
      finalAssetBalance,
      finalEyeBalance.toString(),
      rootEYEOfLP.toString(),
      daiEYESLP.address
    );

    const balanceOfDaiEYESLPAftertake = await daiEYESLP.balanceOf(
      owner.address
    );

    expect(
      balanceOfDaiEYESLPBeforeStake.sub(balanceOfDaiEYESLPAftertake).toString()
    ).to.equal(finalAssetBalance.toString());

    const eyeBalanceBeforeStake = await eye.balanceOf(owner.address);
    await dao.setEYEBasedAssetStake(100, 100, 10, eye.address);
    const eyeBalanceAfterStake = await eye.balanceOf(owner.address);
    expect(eyeBalanceBeforeStake.sub(eyeBalanceAfterStake).toString()).to.equal(
      "100"
    );

    let fateState = await dao.fateState(owner.address);
    let expectedFateWeight = 10n + rootEYEOfLP * 2n;
    expect(fateState[0].toString()).to.equal(expectedFateWeight.toString());

    await dao.setEYEBasedAssetStake(81, 81, 9, eye.address);

    const eyeBalanceAfterReducedStake = await eye.balanceOf(owner.address);
    expect(
      eyeBalanceAfterReducedStake.sub(eyeBalanceAfterStake).toString()
    ).to.equal("19");

    fateState = await dao.fateState(owner.address);
    expectedFateWeight -= 1n;
    expect(fateState[0].toString()).to.equal(expectedFateWeight.toString());

    finalEyeBalance = NAUGHT_POINT_ONE * BigInt(40);
    finalAssetBalance = 3571428571435555566n;
    rootEYEOfLP = 2000000000n;

    await dao.setEYEBasedAssetStake(
      finalAssetBalance,
      finalEyeBalance.toString(),
      rootEYEOfLP.toString(),
      daiEYESLP.address
    );

    const daiEYESLPBalanceAfterReducedStake = await daiEYESLP.balanceOf(
      owner.address
    );
    expect(
      daiEYESLPBalanceAfterReducedStake
        .sub(balanceOfDaiEYESLPAftertake)
        .toString()
    ).to.equal("1428571428564444434");

    expectedFateWeight = 9n + rootEYEOfLP * 2n;
    fateState = await dao.fateState(owner.address);
    expect(fateState[0].toString()).to.equal(expectedFateWeight.toString());
  });

  it("burn eye gives 10x fate", async function () {
    await dao.makeLive();
    const fateBefore = await dao.fateState(owner.address);
    await expect(fateBefore[1].toString()).to.equal("0");

    const eyeSupplyBefore = await eye.totalSupply();
    const lpBalanceOfDAOBefore = await linkEYEULP.balanceOf(dao.address);
    await dao.burnAsset(eye.address, 1000); //1000* 10 => 10000 Fate
    await dao.burnAsset(linkEYEULP.address, 64); //14 EYE => 280 FATE
    const lpBalanceOfDAOAfter = await linkEYEULP.balanceOf(dao.address);
    const eyeSupplyAfter = await eye.totalSupply();

    expect(eyeSupplyBefore.sub(eyeSupplyAfter).toString()).to.equal("1000");
    expect(lpBalanceOfDAOAfter.sub(lpBalanceOfDAOBefore).toString()).to.equal(
      "64"
    );
    console.log(`fateBefore: ${fateBefore[1].toString()}`);
    const fateAfter = await dao.fateState(owner.address);

    await expect(fateAfter[1].sub(fateBefore[1]).toString()).to.equal("10280");
  });

 /* it("setting asset with asset staked in limbo adds to fate", async function () {
    const RealLimbo = await ethers.getContractFactory("Limbo");
    const flan = await GovernableStubFactory.deploy(dao.address);
    
    const limbo = await RealLimbo.deploy(flan.address, dao.address);
    await eye.approve(limbo.address,'10000000000000000000000000000')
    await dao.seed(
      limbo.address,
      flan.address,
      eye.address,
      proposalFactory.address,
      sushiSwapFactory.address,
      uniswapFactory.address,
      flashGovernance.address,
      9,
      [daiEYESLP.address, linkEYESLP.address, sushiEYESLP.address],
      [daiEYEULP.address, linkEYEULP.address, sushiEYEULP.address]
    );

    await dao.makeLive();
    await limbo.configureSoul(
      eye.address,
      10000000,
      2,
      0,
      1,
      0,
      10000000
    );

    await limbo.stake(eye.address, 1000);
    const balanceBefore = await eye.balanceOf(owner.addres);
    await eye.approve(dao.address, "10000000000000000000000000000");
    await dao.setEYEBasedAssetStake(10000, 10000, 100, eye.address);

    // const balanceAfter = await eye.balanceOf(owner.address);
    // expect(balanceAfter.sub(balanceBefore).toString()).to.equal("9000");

    // await advanceTime(21600); // 6 hours

    // await dao.incrementFateFor(owner.address);
    // let fateState = await dao.fateState(owner.address);
    // expect(fateState[1].toString()).to.equal("25");

    // await dao.setEYEBasedAssetStake(400, 400, 20, eye.address);

    // await advanceTime(172800); //2 days
    // await dao.incrementFateFor(owner.address);
    // fateState = await dao.fateState(owner.address);
    // expect(fateState[0].toString()).to.equal("20");
    // expect(fateState[1].toString()).to.equal("65");

    // await dao.setEYEBasedAssetStake(62500, 62500, 250, eye.address);

    // await advanceTime(28800); //8 hours
    // await dao.incrementFateFor(owner.address);
    // fateState = await dao.fateState(owner.address);
    // expect(fateState[1].toString()).to.equal("148");
  });
  */
});
