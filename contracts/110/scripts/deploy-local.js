const hre = require("hardhat");
const StakedCitadelLockerArtifact = require("../artifacts-external/StakedCitadelLocker.json");
const ethers = hre.ethers;

const { formatUnits, parseUnits } = ethers.utils;

const wbtc_address = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599";
const cvx_address = "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b";

const wbtc_minter_address = "0xCA06411bd7a7296d7dbdd0050DFc846E95fEBEB7"; // owner address of wbtc
const cvx_minter_address = "0xF403C135812408BFbE8713b5A23a04b3D48AAE31"; // operator address of cvx

const erc20_mintable_abi = ["function mint(address, uint256)"];

const address = (entity) => entity.address;

const hashIt = (str) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(str));

async function main() {
  const signers = await ethers.getSigners();

  /// === Contract Factories
  const GlobalAccessControl = await ethers.getContractFactory(
    "GlobalAccessControl"
  );

  const CitadelToken = await ethers.getContractFactory("CitadelToken");
  const StakedCitadel = await ethers.getContractFactory("StakedCitadel");
  const StakedCitadelVester = await ethers.getContractFactory(
    "StakedCitadelVester"
  );
  const StakedCitadelLocker = await ethers.getContractFactoryFromArtifact({
    ...StakedCitadelLockerArtifact,
    _format: "hh-sol-artifact-1",
    contractName: "StakedCitadelLocker",
    sourceName: "src/StakedCitadelLocker.sol",
    linkReferences: {
      ...StakedCitadelLockerArtifact.bytecode.linkReferences,
      ...StakedCitadelLockerArtifact.deployedBytecode.linkReferences,
    },
    deployedLinkReferences: {
      ...StakedCitadelLockerArtifact.bytecode.deployedLinkReferences,
      ...StakedCitadelLockerArtifact.deployedBytecode.deployedLinkReferences,
    },
    bytecode: StakedCitadelLockerArtifact.bytecode.object,
    deployedBytecode: StakedCitadelLockerArtifact.deployedBytecode.object,
  });

  const SupplySchedule = await ethers.getContractFactory("SupplySchedule");
  const CitadelMinter = await ethers.getContractFactory("CitadelMinter");

  const KnightingRound = await ethers.getContractFactory("KnightingRound");

  const Funding = await ethers.getContractFactory("Funding");

  const ERC20Upgradeable = await ethers.getContractFactory("ERC20Upgradeable");

  /// === Deploying Contracts & loggin addresses
  const gac = await GlobalAccessControl.deploy();
  console.log("global access control address is: ", gac.address);

  const citadel = await CitadelToken.deploy();
  console.log("citadel address is: ", citadel.address);

  const xCitadel = await StakedCitadel.deploy();
  console.log("xCitadel address is: ", xCitadel.address);

  const xCitadelVester = await StakedCitadelVester.deploy();
  console.log("xCitadelVester address is: ", xCitadelVester.address);

  const xCitadelLocker = await StakedCitadelLocker.deploy();
  console.log("xCitadelLocker address is: ", xCitadelLocker.address);

  const schedule = await SupplySchedule.deploy();
  console.log("schedule address is: ", schedule.address);

  const citadelMinter = await CitadelMinter.deploy();
  console.log("citadelMinter address is: ", citadelMinter.address);

  const knightingRound = await KnightingRound.deploy();
  console.log("knightingRound address is: ", knightingRound.address);

  const fundingWbtc = await Funding.deploy();
  console.log("fundingWbtc address is: ", knightingRound.address);

  const fundingCvx = await Funding.deploy();
  console.log("fundingCvx address is: ", knightingRound.address);

  /// === mint wbtc and cvx to signers[0]
  // impersonate the token owner
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [wbtc_minter_address],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [cvx_minter_address],
  });

  // send some balance for the gas
  await hre.network.provider.send("hardhat_setBalance", [
    wbtc_minter_address,
    "0x1000000000000000000",
  ]);
  await hre.network.provider.send("hardhat_setBalance", [
    cvx_minter_address,
    "0x1000000000000000000",
  ]);

  // get the signer
  const wbtc_minter = await ethers.getSigner(wbtc_minter_address);
  const cvx_minter = await ethers.getSigner(cvx_minter_address);

  // connect the token contract to signers
  const wbtcMintable = new ethers.Contract(
    wbtc_address,
    erc20_mintable_abi,
    wbtc_minter
  );

  const cvxMintable = new ethers.Contract(
    cvx_address,
    erc20_mintable_abi,
    cvx_minter
  );

  // mint some tokens to signers[0]
  const user = signers[0];
  const txWbtcMint = await wbtcMintable.mint(address(user), parseUnits("1"));
  await txWbtcMint.wait();
  const txCvxMint = await cvxMintable.mint(address(user), parseUnits("1"));
  await txCvxMint.wait();

  const wbtc = ERC20Upgradeable.attach(wbtc_address); //
  const cvx = ERC20Upgradeable.attach(cvx_address); //

  // check the balance
  const balance_wbtc = await wbtc.callStatic.balanceOf(address(user));
  console.log(`wbtc balance of signers[0]: ${formatUnits(balance_wbtc)}`);
  const balance_cvx = await cvx.callStatic.balanceOf(address(user));
  console.log(`cvx balance of signers[0]: ${formatUnits(balance_cvx)}`);

  /// === Variable Setup
  const governance = signers[12];
  const keeper = signers[11];
  const guardian = signers[13];
  const treasuryVault = signers[14];
  const techOps = signers[15];
  const treasuryOps = signers[18];
  const citadelTree = signers[16];
  const policyOps = signers[19];

  const rando = signers[17];

  const whale = signers[7];
  const shrimp = signers[8];
  const shark = signers[9];

  const eoaOracle = signers[3];

  /// === Initialization and Setup

  /// ======= Global Access Control

  await gac.connect(governance).initialize(governance.address);

  /// ======= Citadel Token

  citadel.connect(governance).initialize("Citadel", "CTDL", gac.address);

  /// ======= Staked (x) Citadel Vault Token

  const xCitadelFees = [0, 0, 0, 0];

  xCitadel
    .connect(governance)
    .initialize(
      address(citadel),
      address(governance),
      address(keeper),
      address(guardian),
      address(treasuryVault),
      address(techOps),
      address(citadelTree),
      address(xCitadelVester),
      "Staked Citadel",
      "xCTDL",
      xCitadelFees
    );

  /// ======= Vested Exit | xCitadelVester
  xCitadelVester
    .connect(governance)
    .initialize(address(gac), address(citadel), address(xCitadel));

  /// =======  xCitadelLocker
  xCitadelLocker
    .connect(governance)
    .initialize(address(xCitadel), "Vote Locked xCitadel", "vlCTDL");

  // ========  SupplySchedule || CTDL Token Distribution
  schedule.connect(governance).initialize(address(gac));

  // ========  CitadelMinter || CTDLMinter
  citadelMinter
    .connect(governance)
    .initialize(
      address(gac),
      address(citadel),
      address(xCitadel),
      address(xCitadelLocker),
      address(schedule)
    );

  /// ========  Knighting Round
  const knightingRoundParams = {
    start: new Date(new Date().getTime() + 10 * 1000),
    duration: 7 * 24 * 3600 * 1000,
    citadelWbtcPrice: ethers.utils.parseUnits("23", 18), // 21 CTDL per wBTC
    wbtcLimit: ethers.utils.parseUnits("100", 8), // 100 wBTC
  };

  knightingRound.connect(governance).initialize(
    address(gac),
    address(citadel),
    address(wbtc),
    knightingRoundParams.start,
    knightingRoundParams.duration,
    knightingRoundParams.citadelWbtcPrice,
    address(governance),
    address(0), // TODO: Add guest list and test with it
    knightingRoundParams.wbtcLimit
  );

  /// ========  Funding
  fundingWbtc.initialize(
    address(gac),
    address(citadel),
    address(wbtc),
    address(xCitadel),
    address(treasuryVault),
    eoaOracle,
    ethers.utils.parseUnits("100", 8)
  );
  fundingCvx.initialize(
    address(gac),
    address(citadel),
    address(cvx),
    address(xCitadel),
    address(treasuryVault),
    address(eoaOracle),
    ethers.utils.parseUnits("100000", 18)
  );

  /// ======== Grant roles

  gac
    .connect(governance)
    .grantRole(hashIt("CONTRACT_GOVERNANCE_ROLE"), address(governance));
  gac
    .connect(governance)
    .grantRole(hashIt("TREASURY_GOVERNANCE_ROLE"), address(treasuryVault));

  gac
    .connect(governance)
    .grantRole(hashIt("TECH_OPERATIONS_ROLE"), address(techOps));
  gac
    .connect(governance)
    .grantRole(hashIt("TREASURY_OPERATIONS_ROLE"), address(treasuryOps));
  gac
    .connect(governance)
    .grantRole(hashIt("POLICY_OPERATIONS_ROLE"), address(policyOps));

  gac
    .connect(governance)
    .grantRole(hashIt("CITADEL_MINTER_ROLE"), address(citadelMinter));
  gac
    .connect(governance)
    .grantRole(hashIt("CITADEL_MINTER_ROLE"), address(governance));

  gac.connect(governance).grantRole(hashIt("PAUSER_ROLE"), address(governance));
  gac.connect(governance).grantRole(hashIt("UNPAUSER_ROLE"), address(techOps));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
