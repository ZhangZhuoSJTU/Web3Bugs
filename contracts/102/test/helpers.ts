import hre, { ethers, artifacts, network } from 'hardhat';
import chai from 'chai';
import CBN from 'chai-bn';
import { Core, Core__factory } from '@custom-types/contracts';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import { NamedAddresses } from '@custom-types/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// use default BigNumber
chai.use(CBN(ethers.BigNumber));

const scale = ethers.constants.WeiPerEther;
const toBN = ethers.BigNumber.from;
const { expect } = chai;
const WETH9 = artifacts.readArtifactSync('WETH9');

async function deployDevelopmentWeth(): Promise<void> {
  await network.provider.send('hardhat_setCode', [
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    WETH9.deployedBytecode
  ]);

  const weth = await ethers.getContractAt(WETH9.abi, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
  await weth.init();
}

async function getAddresses(): Promise<NamedAddresses> {
  const [
    userAddress,
    secondUserAddress,
    beneficiaryAddress1,
    beneficiaryAddress2,
    governorAddress,
    genesisGroup,
    keeperAddress,
    pcvControllerAddress,
    minterAddress,
    burnerAddress,
    guardianAddress
  ] = (await ethers.getSigners()).map((signer) => signer.address);

  return {
    userAddress,
    secondUserAddress,
    beneficiaryAddress1,
    beneficiaryAddress2,
    governorAddress,
    genesisGroup,
    keeperAddress,
    pcvControllerAddress,
    minterAddress,
    burnerAddress,
    guardianAddress
  };
}

async function getImpersonatedSigner(address: string): Promise<SignerWithAddress> {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address]
  });

  const signer = await ethers.getSigner(address);

  return signer;
}

async function increaseTime(amount: number | string | BigNumberish): Promise<void> {
  await time.increase(amount);
}

async function resetTime(): Promise<void> {
  await resetFork();
}

async function resetFork(): Promise<void> {
  if (process.env.NO_RESET) {
    return;
  }
  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: hre.config.networks.hardhat.forking
          ? {
              jsonRpcUrl: hre.config.networks.hardhat.forking.url
            }
          : undefined
      }
    ]
  });
}

async function setNextBlockTimestamp(time: number): Promise<void> {
  await hre.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [time]
  });
}

async function latestTime(): Promise<number> {
  const { timestamp } = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());

  return timestamp as number;
}

async function mine(): Promise<void> {
  await hre.network.provider.request({
    method: 'evm_mine'
  });
}

async function getCore(): Promise<Core> {
  const { governorAddress, pcvControllerAddress, minterAddress, burnerAddress, guardianAddress } = await getAddresses();

  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [governorAddress]
  });

  const governorSigner = await ethers.getSigner(governorAddress);

  const coreFactory = new Core__factory(governorSigner);
  const core = await coreFactory.deploy();

  /// send all tokens to timelock
  await core.init();
  await core.grantMinter(minterAddress);
  await core.grantBurner(burnerAddress);
  await core.grantPCVController(pcvControllerAddress);
  await core.grantGuardian(guardianAddress);

  return core;
}

async function expectApprox(
  actual: string | number | BigNumberish,
  expected: string | number | BigNumberish,
  magnitude = '1000'
): Promise<void> {
  const actualBN = toBN(actual);
  const expectedBN = toBN(expected);
  const magnitudeBN = toBN(magnitude);

  const diff = actualBN.sub(expectedBN);
  const diffAbs = diff.abs();

  if (expected.toString() == '0' || expected == 0 || expected == '0') {
    expect(diffAbs).to.be.lt(magnitudeBN);
  } else {
    expect(diffAbs.div(expected).lt(magnitudeBN)).to.be.true;
  }
}

// expectApproxAbs(a, b, c) checks if b is between [a-c, a+c]
async function expectApproxAbs(
  actual: string | number | BigNumberish,
  expected: string | number | BigNumberish,
  diff = '1000000000000000000'
): Promise<void> {
  const actualBN = toBN(actual);
  const expectedBN = toBN(expected);
  const diffBN = toBN(diff);

  const lowerBound = expectedBN.sub(diffBN);
  const upperBound = expectedBN.add(diffBN);

  expect(actualBN).to.be.gte(lowerBound);
  expect(actualBN).to.be.lte(upperBound);
}

async function expectEvent(tx, contract: any, event: string, args: any[]): Promise<void> {
  await expect(tx)
    .to.emit(contract, event)
    .withArgs(...args);
}

async function expectRevert(tx, errorMessage: string): Promise<void> {
  await expect(tx).to.be.revertedWith(errorMessage);
}

async function expectUnspecifiedRevert(tx): Promise<void> {
  await expect(tx).to.be.reverted;
}

const ZERO_ADDRESS = ethers.constants.AddressZero;
const MAX_UINT256 = ethers.constants.MaxUint256;

const balance = {
  current: async (address: string): Promise<BigNumber> => {
    const balance = await ethers.provider.getBalance(address);
    return balance;
  }
};

const time = {
  latest: async (): Promise<number> => latestTime(),

  latestBlock: async (): Promise<number> => await ethers.provider.getBlockNumber(),

  increase: async (duration: number | string | BigNumberish): Promise<void> => {
    const durationBN = ethers.BigNumber.from(duration);

    if (durationBN.lt(ethers.constants.Zero)) throw Error(`Cannot increase time by a negative amount (${duration})`);

    await hre.network.provider.send('evm_increaseTime', [durationBN.toNumber()]);

    await hre.network.provider.send('evm_mine');
  },

  increaseTo: async (target: number | string | BigNumberish): Promise<void> => {
    const targetBN = ethers.BigNumber.from(target);

    const now = ethers.BigNumber.from(await time.latest());

    if (targetBN.lt(now)) throw Error(`Cannot increase current time (${now}) to a moment in the past (${target})`);
    const diff = targetBN.sub(now);
    return time.increase(diff);
  },

  advanceBlockTo: async (target: number | string | BigNumberish): Promise<void> => {
    target = ethers.BigNumber.from(target);

    const currentBlock = await time.latestBlock();
    const start = Date.now();
    let notified;
    if (target.lt(currentBlock))
      throw Error(`Target block #(${target}) is lower than current block #(${currentBlock})`);
    while (ethers.BigNumber.from(await time.latestBlock()).lt(target)) {
      if (!notified && Date.now() - start >= 5000) {
        notified = true;
        console.warn(`You're advancing many blocks; this test may be slow.`);
      }
      await time.advanceBlock();
    }
  },

  advanceBlock: async (): Promise<void> => {
    await hre.network.provider.send('evm_mine');
  }
};

export {
  // utils
  toBN,
  scale,
  ZERO_ADDRESS,
  MAX_UINT256,
  time,
  balance,
  expectEvent,
  expectRevert,
  expectUnspecifiedRevert,
  // functions
  mine,
  getCore,
  getAddresses,
  increaseTime,
  latestTime,
  expectApprox,
  expectApproxAbs,
  deployDevelopmentWeth,
  getImpersonatedSigner,
  setNextBlockTimestamp,
  resetTime,
  resetFork
};
