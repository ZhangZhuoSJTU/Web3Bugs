const { BN } = require("@openzeppelin/test-helpers");
const { web3 } = require("@nomiclabs/hardhat-web3");

const LONGSHORT_CONTRACT_NAME = "LongShort";
const YIELD_MANAGER = "YieldManagerMock";
const ORACLE_MANAGER = "OracleManagerMock";
const STARDAND_ERC20 = "ERC20PresetMinterPauserUpgradeable";
const SYNTHETIC_TOKEN = "SyntheticToken";
const TOKEN_FACTORY = "TokenFactory";
const STAKER = "Staker";
const FLOAT_TOKEN = "FloatToken";
const FLOAT_CAPITAL = "FloatCapital_v0";
const TREASURY = "Treasury_v0";

const SIMULATED_INSTANT_APY = 10;
const TEN_TO_THE_18 = "1000000000000000000";

const erc20 = artifacts.require(STARDAND_ERC20);
const SyntheticToken = artifacts.require(SYNTHETIC_TOKEN);
const LongShort = artifacts.require(LONGSHORT_CONTRACT_NAME);
const OracleManager = artifacts.require(ORACLE_MANAGER);
const YieldManager = artifacts.require(YIELD_MANAGER);
const TokenFactory = artifacts.require(TOKEN_FACTORY);
const Staker = artifacts.require(STAKER);
const FloatToken = artifacts.require(FLOAT_TOKEN);
const FloatCapital = artifacts.require(FLOAT_CAPITAL);
const Treasury = artifacts.require(TREASURY);

const initialize = async (admin) => {
  const longShort = await LongShort.new({
    from: admin,
  });

  const tokenFactory = await TokenFactory.new(longShort.address, {
    from: admin,
  });

  const floatCapital = await FloatCapital.new({
    from: admin,
  });

  const treasury = await Treasury.new({
    from: admin,
  });

  const staker = await Staker.new({
    from: admin,
  });

  const floatToken = await FloatToken.new({
    from: admin,
  });
  await floatToken.initializeFloatToken(
    "Float token",
    "FLOAT TOKEN",
    staker.address,
    {
      from: admin,
    }
  );

  await treasury.initialize(admin, {
    from: admin,
  });

  await longShort.initialize(
    admin,
    treasury.address,
    tokenFactory.address,
    staker.address,
    {
      from: admin,
    }
  );

  await staker.initialize(
    admin,
    longShort.address,
    floatToken.address,
    /// Using the float capital address for the 
    floatCapital.address,
    floatCapital.address,
    "250000000000000000", // 25%
    {
      from: admin,
    }
  );

  return {
    staker,
    longShort,
    floatToken,
    tokenFactory,
    treasury,
  };
};

const createSynthetic = async (
  admin,
  longShort,
  syntheticName,
  syntheticSymbol,
  treasury
) => {
  const fundToken = await erc20.new({
    from: admin,
  });

  await fundToken.initialize("fund token", "FND", {
    from: admin,
  });

  await fundToken.mint(admin, "10000000000000000000", { from: admin });
  await fundToken.approve(longShort.address, "10000000000000000000", {
    from: admin,
  });

  const oracleManager = await OracleManager.new(admin, {
    from: admin,
  });

  const yieldManager = await YieldManager.new(
    longShort.address,
    treasury.address,
    fundToken.address,
    {
      from: admin,
    }
  );

  // Mock yield manager needs to be able to mint tokens to simulate yield.
  var mintRole = await fundToken.MINTER_ROLE.call();
  await fundToken.grantRole(mintRole, yieldManager.address);

  await longShort.createNewSyntheticMarket(
    syntheticName,
    syntheticSymbol,
    fundToken.address,
    oracleManager.address,
    yieldManager.address,
    { from: admin }
  );

  const currentMarketIndex = await longShort.latestMarket.call();

  let kInitialMultiplier = TEN_TO_THE_18;
  let kPeriod = 0;

  await longShort.initializeMarket(
    currentMarketIndex,
    kInitialMultiplier,
    kPeriod,
    "5000000000000000", //50 basis points unstake fee
    "1000000000000000000",
    "5",
    0,
    1,
    { from: admin }
  );

  const longAddress = await longShort.syntheticTokens.call(
    currentMarketIndex,
    0
  );
  const shortAddress = await longShort.syntheticTokens.call(
    currentMarketIndex,
    1
  );
  let longToken = await SyntheticToken.at(longAddress);
  let shortToken = await SyntheticToken.at(shortAddress);

  return {
    fundToken,
    longToken,
    shortToken,
    yieldManager,
    oracleManager,
    currentMarketIndex,
  };
};

const mintAndApprove = async (token, amount, user, approvedAddress) => {
  let bnAmount = new BN(amount);
  await token.mint(user, bnAmount);
  await token.approve(approvedAddress, bnAmount, {
    from: user,
  });
};

const simulateTotalValueWithInterest = (amount, apy) => {
  let bnAmount = new BN(amount);
  return bnAmount.add(bnAmount.mul(new BN(apy)).div(new BN(100)));
};

const simulateInterestEarned = (amount, apy) => {
  let bnAmount = new BN(amount);
  return bnAmount.mul(new BN(apy)).div(new BN(100));
};

const tokenPriceCalculator = (value, supply) => {
  return new BN(value).mul(new BN("1000000000000000000")).div(new BN(supply));
};

const feeCalculation = (
  _amount,
  _longValue,
  _shortValue,
  _baseEntryFee,
  _entryFeeMultiplier,
  _minThreshold,
  _feeUnitsOfPrecision,
  isLongDeposit,
  thinBeta
) => {
  // check if imbalance or not
  amount = new BN(_amount);
  longValue = new BN(_longValue);
  shortValue = new BN(_shortValue);
  baseEntryFee = new BN(_baseEntryFee);
  entryFeeMultiplier = new BN(_entryFeeMultiplier);
  minThreshold = new BN(_minThreshold);
  feeUnitsOfPrecision = new BN(_feeUnitsOfPrecision);

  let fees;

  // simple 0.5% fee
  if (isLongDeposit) {
    // Adding to heavy side
    if (longValue.gt(shortValue)) {
      fees = baseEntryFee.mul(amount).div(feeUnitsOfPrecision);
      // Adding to thin side & tipping
    } else if (longValue.add(amount).gt(shortValue)) {
      let amountLiableForFee = amount.sub(shortValue.sub(longValue));
      fees = baseEntryFee.mul(amountLiableForFee).div(feeUnitsOfPrecision);
      // Adding to thin side
    } else {
      fees = new BN(0);
    }
  } else {
    // Adding to heavy side
    if (shortValue.gt(longValue)) {
      fees = baseEntryFee.mul(amount).div(feeUnitsOfPrecision);
      // Adding to thin side & tipping
    } else if (shortValue.add(amount).gt(longValue)) {
      let amountLiableForFee = amount.sub(longValue.sub(shortValue));
      fees = baseEntryFee.mul(amountLiableForFee).div(feeUnitsOfPrecision);
      // Adding to thin side
    } else {
      fees = new BN(0);
    }
  }
  // If greater than minFeeThreshold
  if (amount.add(longValue).add(shortValue).gte(minThreshold)) {
    const TEN_TO_THE_18 = "1" + "000000000000000000";
    let betaDiff = new BN(TEN_TO_THE_18).sub(thinBeta); // TODO: when previous beta != 1

    let residualAmount = new BN(amount);
    let totalValueLocked = longValue.add(shortValue).add(amount);
    let amountIsPassingScalingFees = totalValueLocked
      .sub(amount)
      .lt(minThreshold);
    if (amountIsPassingScalingFees) {
      residualAmount = totalValueLocked.sub(minThreshold);
    }

    let additionalFees = new BN(residualAmount)
      .mul(new BN(betaDiff))
      .mul(new BN(10))
      .mul(new BN(100))
      .div(new BN(feeUnitsOfPrecision))
      .div(new BN(TEN_TO_THE_18));

    fees = fees.add(additionalFees);
  }
  return fees;
};

const logGasPrices = async (
  functionName,
  receipt,
  ethPriceUsd,
  maticPriceUsd,
  ethGasPriceGwei,
  maticGasPriceGwei
) => {
  const ONE_GWEI = new BN("1000000000");
  const ONE_ETH = new BN("1000000000000000000");
  console.log(`Assessing gas for: ${functionName}`);

  const gasUsed = receipt.receipt.gasUsed;
  console.log(`GasUsed: ${gasUsed}`);

  console.log(`------Cost for ETH Mainnet------`);
  console.log(`gas price gwei: ${ethGasPriceGwei}`);
  const totalCostEth = new BN(gasUsed).mul(
    new BN(ethGasPriceGwei).mul(ONE_GWEI)
  );
  console.log(`USD Price: $${ethPriceUsd}`);
  const ethCost =
    Number(
      totalCostEth.mul(new BN(ethPriceUsd)).mul(new BN(100)).div(ONE_ETH)
    ) / 100;
  console.log(`Cost on ETH Mainnet: $${ethCost}`);

  console.log(`------Cost for Matic/POLYGON ------`);
  console.log(`gas price gwei: ${maticGasPriceGwei}`);
  const totalCostMatic = new BN(gasUsed).mul(
    new BN(maticGasPriceGwei).mul(ONE_GWEI)
  );
  console.log(`MATIC Price: $${maticPriceUsd}`);
  const maticCost =
    Number(
      totalCostMatic.mul(new BN(maticPriceUsd)).mul(new BN(100)).div(ONE_ETH)
    ) / 100;
  console.log(`Cost on BSC: $${maticCost}`);
};

const totalValueLockedInMarket = async (longShort, marketIndex) => {
  const longValue = await longShort.syntheticTokenBackedValue.call(
    0,
    marketIndex
  );
  const shortValue = await longShort.syntheticTokenBackedValue.call(
    1,
    marketIndex
  );
  return new BN(longValue).add(new BN(shortValue));
};

module.exports = {
  initialize,
  mintAndApprove,
  SIMULATED_INSTANT_APY,
  simulateInterestEarned,
  tokenPriceCalculator,
  simulateTotalValueWithInterest,
  feeCalculation,
  createSynthetic,
  logGasPrices,
  totalValueLockedInMarket,
};
