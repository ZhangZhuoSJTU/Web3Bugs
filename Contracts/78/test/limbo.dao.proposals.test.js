const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const web3 = require("web3");

describe("DAO Proposals", function () {
  let owner, secondPerson, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, proposalFactory, updateProposalConfigProposal;
  const zero = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, secondPerson] = await ethers.getSigners();

    const UniswapFactoryFactory = await ethers.getContractFactory(
      "UniswapFactory"
    );
    const UniswapPairFactory = await ethers.getContractFactory("UniswapPair");

    const sushiSwapFactory = await UniswapFactoryFactory.deploy();
    const uniswapFactory = await UniswapFactoryFactory.deploy();

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

    this.TransferHelperFactory = await ethers.getContractFactory(
      "TransferHelper"
    );
    const daoFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        TransferHelper: (await this.TransferHelperFactory.deploy()).address,
      },
    });

    dao = await daoFactory.deploy();
    const firstProposalFactory = await ethers.getContractFactory(
      "ToggleWhitelistProposalProposal"
    );
    this.whiteListingProposal = await firstProposalFactory.deploy(
      dao.address,
      "toggle whitelist"
    );

    const morgothTokenApproverFactory = await ethers.getContractFactory(
      "MockMorgothTokenApprover"
    );

    const GovernableStubFactory = await ethers.getContractFactory(
      "GovernableStub"
    );

    const FlanFactory = await ethers.getContractFactory("Flan");
    this.flan = await FlanFactory.deploy(dao.address);
    this.flan.transferOwnership(dao.address);
    this.limbo = await GovernableStubFactory.deploy(dao.address);

    this.morgothTokenApprover = await morgothTokenApproverFactory.deploy();

    const soulUpdateProposalFactory = await ethers.getContractFactory(
      "UpdateSoulConfigProposal"
    );

    this.soulUpdateProposal = await soulUpdateProposalFactory.deploy(
      dao.address,
      "hello",
      this.limbo.address,
      this.morgothTokenApprover.address
    );

    const ProposalFactoryFactory = await ethers.getContractFactory(
      "ProposalFactory"
    );
    proposalFactory = await ProposalFactoryFactory.deploy(
      dao.address,
      this.whiteListingProposal.address,
      this.soulUpdateProposal.address
    );

    const flashGovernanceFactory = await ethers.getContractFactory(
      "FlashGovernanceArbiter"
    );
    this.flashGovernance = await flashGovernanceFactory.deploy(dao.address);

    await dao.seed(
      this.limbo.address,
      this.flan.address,
      eye.address,
      proposalFactory.address,
      sushiSwapFactory.address,
      uniswapFactory.address,
      this.flashGovernance.address,
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
    await dao.makeLive();
    await proposalFactory.setDAO(dao.address);

    const UpdateProposalConfigProposalFactory = await ethers.getContractFactory(
      "UpdateProposalConfigProposal"
    );
    updateProposalConfigProposal =
      await UpdateProposalConfigProposalFactory.deploy(
        dao.address,
        "UPDATE_CONFIG"
      );

    await toggleWhiteList(
      updateProposalConfigProposal.address,
      this.whiteListingProposal
    );
  });

  const toggleWhiteList = async (contractToToggle, whiteListingProposal) => {
    await whiteListingProposal.parameterize(
      proposalFactory.address,
      contractToToggle
    );
    const requiredFateToLodge = (await dao.proposalConfig())[1];

    await eye.mint(requiredFateToLodge);
    await eye.approve(dao.address, requiredFateToLodge.mul(2));
    await dao.burnAsset(eye.address, requiredFateToLodge.div(5).add(10));

    await proposalFactory.lodgeProposal(whiteListingProposal.address);
    await dao.vote(whiteListingProposal.address, "100");
    await advanceTime(100000000);
    await dao.executeCurrentProposal();
  };

  const advanceTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds]); //6 hours
    await network.provider.send("evm_mine");
  };
  const ONE = BigInt("1000000000000000000");
  const NAUGHT_POINT_ONE = ONE / 10n;

  it("Insufficient fate to lodge rejected", async function () {
    await expect(
      proposalFactory.lodgeProposal(updateProposalConfigProposal.address)
    ).to.be.revertedWith(
      "Arithmetic operation underflowed or overflowed outside of an unchecked block"
    );
  });

  it("lodging proposal when none exist accepted", async function () {
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn);
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    const currentProposalAfter = (await dao.currentProposalState())[4];
    expect(currentProposalAfter.toString()).to.equal(
      updateProposalConfigProposal.address
    );
  });

  it("paramerterize once proposal is lodged fails", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn);
    await updateProposalConfigProposal.parameterize(
      100,
      200,
      proposalFactory.address
    );
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    const params = await updateProposalConfigProposal.params();
    expect(params[0].toString()).to.equal("100");
    expect(params[1].toString()).to.equal("200");
    expect(params[2]).to.equal(proposalFactory.address);
    const currentProposalAfter = (await dao.currentProposalState())[4];
    expect(currentProposalAfter.toString()).to.equal(
      updateProposalConfigProposal.address
    );

    await expect(
      updateProposalConfigProposal.parameterize(
        110,
        220,
        proposalFactory.address
      )
    ).to.be.revertedWith("LimboDAO: proposal locked");
  });

  it("Lodging proposal while existing proposal valid rejected", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn);
    await updateProposalConfigProposal.parameterize(
      100,
      200,
      proposalFactory.address
    );
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    //end lodge

    let SetAssetApprovalProposalFactory = await ethers.getContractFactory(
      "SetAssetApprovalProposal"
    );
    let setAssetApprovalProposal = await SetAssetApprovalProposalFactory.deploy(
      dao.address,
      "ASSET"
    );

    await setAssetApprovalProposal.parameterize(sushiEYEULP.address, false);

    await expect(
      toggleWhiteList(
        setAssetApprovalProposal.address,
        this.whiteListingProposal
      )
    ).to.be.revertedWith("LimboDAO: active proposal.");
  });

  it("success returns half of required fate", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn);

    //fate before
    const fateBeforeLodge = (await dao.fateState(owner.address))[1];
    await updateProposalConfigProposal.parameterize(
      100,
      "223000000000000000000",
      proposalFactory.address
    );
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    //fate after lodge
    const fateAfterLodge = (await dao.fateState(owner.address))[1];
    //end lodge

    expect(fateBeforeLodge.sub(fateAfterLodge).toString()).to.equal(
      "446000000000000000000"
    );

    //second person acquires fate and votes on current proposal
    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000");
    await dao
      .connect(secondPerson)
      .vote(updateProposalConfigProposal.address, "10000000000");

    //fast forward to after proposal finished
    //3*24*60*60 =259200
    await advanceTime(259200);
    const fateBeforeExecute = (await dao.fateState(owner.address))[1];
    console.log("owner: " + owner.address);
    await dao.executeCurrentProposal();
    const fateAfterExecute = (await dao.fateState(owner.address))[1];
    expect(fateAfterExecute.sub(fateBeforeExecute).toString()).to.equal(
      "223000000000000000000"
    );
  });

  it("voting no on current proposal makes it unexecutable.", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn);

    //fate before
    const fateBeforeLodge = (await dao.fateState(owner.address))[1];
    await updateProposalConfigProposal.parameterize(
      100,
      "123",
      proposalFactory.address
    );
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    //fate after lodge
    const fateAfterLodge = (await dao.fateState(owner.address))[1];
    //end lodge

    expect(fateBeforeLodge.sub(fateAfterLodge).toString()).to.equal(
      "446000000000000000000"
    );

    //second person acquires fate and votes NO on current proposal
    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000");
    await dao
      .connect(secondPerson)
      .vote(updateProposalConfigProposal.address, "-10000000000");

    //fast forward to after proposal finished
    //3*24*60*60 =259200
    await advanceTime(259200);
    const fateBeforeExecute = (await dao.fateState(owner.address))[1];
    const configBefore = await dao.proposalConfig();

    await dao.executeCurrentProposal();
    const fateAfterExecute = (await dao.fateState(owner.address))[1];
    await expect(fateBeforeExecute).to.equal(fateBeforeExecute);

    const decisionState = (await dao.previousProposalState())[1];
    expect(decisionState).to.equal(2);
    const configAfter = await dao.proposalConfig();

    expect(configAfter[0].toString()).to.equal(configBefore[0].toString());
  });

  it("asset approval proposal can add and remove approved assets", async function () {
    //get enough fate to lodge proposal
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn);

    let SetAssetApprovalProposalFactory = await ethers.getContractFactory(
      "SetAssetApprovalProposal"
    );
    let setAssetApprovalProposal = await SetAssetApprovalProposalFactory.deploy(
      dao.address,
      "ASSET"
    );

    await setAssetApprovalProposal.parameterize(sushiEYEULP.address, false);

    await toggleWhiteList(
      setAssetApprovalProposal.address,
      this.whiteListingProposal
    );
    await proposalFactory.lodgeProposal(setAssetApprovalProposal.address);

    const currentProposal = (await dao.currentProposalState())[4];
    expect(currentProposal).to.equal(setAssetApprovalProposal.address);

    const assetApprovedBefore = await dao.assetApproved(sushiEYEULP.address);
    expect(assetApprovedBefore).to.be.true;

    //second person acquires fate and votes on current proposal
    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000");
    await dao
      .connect(secondPerson)
      .vote(setAssetApprovalProposal.address, "10000000000");

    //fast forward to after proposal finished
    //3*24*60*60 =259200
    await advanceTime(259200);

    await dao.executeCurrentProposal();

    const assetApprovedAfter = await dao.assetApproved(sushiEYEULP.address);
    expect(assetApprovedAfter).to.be.false;
  });

  it("vote that flips decision in last hour extends voting for 2 hours", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn);

    //fate before
    const fateBeforeLodge = (await dao.fateState(owner.address))[1];
    await updateProposalConfigProposal.parameterize(
      100,
      "123",
      proposalFactory.address
    );
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    //fate after lodge
    const fateAfterLodge = (await dao.fateState(owner.address))[1];
    //end lodge

    expect(fateBeforeLodge.sub(fateAfterLodge).toString()).to.equal(
      "446000000000000000000"
    );

    //second person acquires fate and votes NO on current proposal
    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000");
    await dao
      .connect(secondPerson)
      .vote(updateProposalConfigProposal.address, "-100");

    //fast forward to after proposal finished
    //47*60*60+60  =169260
    await advanceTime(169260);

    const timeRemainingBeforeSwingVote = (
      await dao.timeRemainingOnProposal()
    ).toNumber();
    expect(timeRemainingBeforeSwingVote).to.be.greaterThan(3534);
    expect(timeRemainingBeforeSwingVote).to.be.lessThan(3537);

    await dao
      .connect(secondPerson)
      .vote(updateProposalConfigProposal.address, "-10"); //same direction shouldn't change duration
    const timeRemainingAfterSameDirectionVote =
      await dao.timeRemainingOnProposal();
    expect(timeRemainingAfterSameDirectionVote.toString()).to.equal("3535");

    await dao
      .connect(secondPerson)
      .vote(updateProposalConfigProposal.address, "200");
    const timeRemainingAfterSwingVote = await dao.timeRemainingOnProposal();
    expect(timeRemainingAfterSwingVote.toString()).to.equal("10734");
    await advanceTime(10000);
    await dao
      .connect(secondPerson)
      .vote(updateProposalConfigProposal.address, "100"); //same direction shouldn't change duration
    const timeRemainingAfterSameDirectionVote2 =
      await dao.timeRemainingOnProposal();
    expect(timeRemainingAfterSameDirectionVote2.toString()).to.equal("733");

    await advanceTime(733);
    await expect(
      dao
        .connect(secondPerson)
        .vote(updateProposalConfigProposal.address, "100")
    ).to.be.revertedWith("LimboDAO: voting for current proposal has ended.");
  });

  it("killDAO, only callable by owner, transfers ownership to new DAO", async function () {
    this.TransferHelperFactory = await ethers.getContractFactory(
      "TransferHelper"
    );
    const daoFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        TransferHelper: (await this.TransferHelperFactory.deploy()).address,
      },
    });

    newDAO = await daoFactory.deploy();

    const limboDAObefore = await this.limbo.DAO();
    expect(limboDAObefore).to.equal(dao.address);

    const flanDAObefore = await this.flan.DAO();
    expect(flanDAObefore).to.equal(dao.address);

    await expect(
      dao.connect(secondPerson).killDAO(newDAO.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await dao.killDAO(newDAO.address);

    const limboDAOafter = await this.limbo.DAO();

    expect(limboDAOafter).to.equal(newDAO.address);
    const flanDAOafter = await this.flan.DAO();
    expect(flanDAOafter).to.equal(newDAO.address);
  });

  it("lisitng unapproved token fails", async function () {
    //get enough fate to lodge proposal
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn);

    await expect(
      this.soulUpdateProposal.parameterize(
        sushiEYEULP.address,
        "100",
        1,
        1,
        1,
        1
      )
    ).to.be.revertedWith("MORGOTH: token not approved for listing on Behodler");

    await this.morgothTokenApprover.addToken(sushiEYEULP.address);
    await this.soulUpdateProposal.parameterize(
      sushiEYEULP.address,
      "100",
      1,
      1,
      1,
      1
    );
  });

  it("trying to convert fate to flan without a rate mints zero flan", async function () {
    await expect(dao.convertFateToFlan(1000)).to.be.revertedWith(
      "LimboDAO: Fate conversion to Flan disabled."
    );
  });

  it("setting fateToFlan to positive number mints flan, depletes fate", async function () {
    const FateToFlanProposal = await ethers.getContractFactory(
      "TurnOnFateMintingProposal"
    );
    const fateToFlanProposal = await FateToFlanProposal.deploy(
      dao.address,
      "minting"
    );
    await fateToFlanProposal.parameterize("2000000000000000000");
    const requiredFate = (await dao.proposalConfig())[1];

    await dao.burnAsset(eye.address, requiredFate);

    await toggleWhiteList(
      fateToFlanProposal.address,
      this.whiteListingProposal
    );

    await proposalFactory.lodgeProposal(fateToFlanProposal.address);
    const fateAfterLodge = BigInt(
      (await dao.fateState(owner.address))[1].toString()
    );
    const expectedFlan = fateAfterLodge * BigInt(2);

    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000");
    await dao.connect(secondPerson).vote(fateToFlanProposal.address, "10000");

    await advanceTime(259200);

    await dao.executeCurrentProposal();

    await dao.convertFateToFlan(fateAfterLodge);
    const flanBalance = (await this.flan.balanceOf(owner.address)).toString();

    expect(flanBalance).to.equal(expectedFlan.toString());
  });
});
