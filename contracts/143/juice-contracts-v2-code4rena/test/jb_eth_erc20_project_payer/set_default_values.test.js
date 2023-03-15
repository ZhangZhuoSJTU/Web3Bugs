import { ethers } from 'hardhat';
import { expect } from 'chai';

import { deployMockContract } from '@ethereum-waffle/mock-contract';

import jbDirectory from '../../artifacts/contracts/JBDirectory.sol/JBDirectory.json';

describe('JBETHERC20ProjectPayer::setDefaultValues(...)', function () {
  const INITIAL_PROJECT_ID = 1;
  const INITIAL_BENEFICIARY = ethers.Wallet.createRandom().address;
  const INITIAL_PREFER_CLAIMED_TOKENS = false;
  const INITIAL_MEMO = 'hello world';
  const INITIAL_METADATA = ethers.utils.randomBytes(32);
  const INITIAL_PREFER_ADD_TO_BALANCE = false;
  const PROJECT_ID = 2;
  const BENEFICIARY = ethers.Wallet.createRandom().address;
  const PREFER_CLAIMED_TOKENS = true;
  const MEMO = 'hi world';
  const METADATA = ethers.utils.randomBytes(32);
  const PREFER_ADD_TO_BALANCE = true;

  async function setup() {
    let [deployer, owner, ...addrs] = await ethers.getSigners();

    let mockJbDirectory = await deployMockContract(deployer, jbDirectory.abi);

    let jbProjectPayerFactory = await ethers.getContractFactory('JBETHERC20ProjectPayer');
    let jbProjectPayer = await jbProjectPayerFactory.deploy(
      INITIAL_PROJECT_ID,
      INITIAL_BENEFICIARY,
      INITIAL_PREFER_CLAIMED_TOKENS,
      INITIAL_MEMO,
      INITIAL_METADATA,
      INITIAL_PREFER_ADD_TO_BALANCE,
      mockJbDirectory.address,
      owner.address,
    );

    return {
      deployer,
      owner,
      addrs,
      mockJbDirectory,
      jbProjectPayer,
    };
  }

  it(`Should set defaults if owner`, async function () {
    const { owner, jbProjectPayer } = await setup();

    expect(await jbProjectPayer.defaultProjectId()).to.equal(INITIAL_PROJECT_ID);
    expect(await jbProjectPayer.defaultBeneficiary()).to.equal(INITIAL_BENEFICIARY);
    expect(await jbProjectPayer.defaultPreferClaimedTokens()).to.equal(
      INITIAL_PREFER_CLAIMED_TOKENS,
    );
    expect(await jbProjectPayer.defaultMemo()).to.equal(INITIAL_MEMO);
    expect(await jbProjectPayer.defaultMetadata()).to.equal(
      ethers.BigNumber.from(INITIAL_METADATA),
    );
    expect(await jbProjectPayer.defaultPreferAddToBalance()).to.equal(
      INITIAL_PREFER_ADD_TO_BALANCE,
    );

    const setDefaultsTx = await jbProjectPayer
      .connect(owner)
      .setDefaultValues(
        PROJECT_ID,
        BENEFICIARY,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        METADATA,
        PREFER_ADD_TO_BALANCE,
      );

    expect(await jbProjectPayer.defaultProjectId()).to.equal(PROJECT_ID);
    expect(await jbProjectPayer.defaultBeneficiary()).to.equal(BENEFICIARY);
    expect(await jbProjectPayer.defaultPreferClaimedTokens()).to.equal(PREFER_CLAIMED_TOKENS);
    expect(await jbProjectPayer.defaultMemo()).to.equal(MEMO);
    expect(await jbProjectPayer.defaultMetadata()).to.equal(ethers.BigNumber.from(METADATA));
    expect(await jbProjectPayer.defaultPreferAddToBalance()).to.equal(PREFER_ADD_TO_BALANCE);

    await expect(setDefaultsTx)
      .to.emit(jbProjectPayer, 'SetDefaultValues')
      .withArgs(
        PROJECT_ID,
        BENEFICIARY,
        PREFER_CLAIMED_TOKENS,
        MEMO,
        ethers.BigNumber.from(METADATA),
        PREFER_ADD_TO_BALANCE,
        owner.address,
      );
  });
  it(`Should set defaults if nothing has changed`, async function () {
    const { owner, jbProjectPayer } = await setup();

    expect(await jbProjectPayer.defaultProjectId()).to.equal(INITIAL_PROJECT_ID);
    expect(await jbProjectPayer.defaultBeneficiary()).to.equal(INITIAL_BENEFICIARY);
    expect(await jbProjectPayer.defaultPreferClaimedTokens()).to.equal(
      INITIAL_PREFER_CLAIMED_TOKENS,
    );
    expect(await jbProjectPayer.defaultMemo()).to.equal(INITIAL_MEMO);
    expect(await jbProjectPayer.defaultMetadata()).to.equal(
      ethers.BigNumber.from(INITIAL_METADATA),
    );
    expect(await jbProjectPayer.defaultPreferAddToBalance()).to.equal(
      INITIAL_PREFER_ADD_TO_BALANCE,
    );

    const setDefaultsTx = await jbProjectPayer
      .connect(owner)
      .setDefaultValues(
        INITIAL_PROJECT_ID,
        INITIAL_BENEFICIARY,
        INITIAL_PREFER_CLAIMED_TOKENS,
        INITIAL_MEMO,
        INITIAL_METADATA,
        INITIAL_PREFER_ADD_TO_BALANCE,
      );

    expect(await jbProjectPayer.defaultProjectId()).to.equal(INITIAL_PROJECT_ID);
    expect(await jbProjectPayer.defaultBeneficiary()).to.equal(INITIAL_BENEFICIARY);
    expect(await jbProjectPayer.defaultPreferClaimedTokens()).to.equal(
      INITIAL_PREFER_CLAIMED_TOKENS,
    );
    expect(await jbProjectPayer.defaultMemo()).to.equal(INITIAL_MEMO);
    expect(await jbProjectPayer.defaultMetadata()).to.equal(
      ethers.BigNumber.from(INITIAL_METADATA),
    );
    expect(await jbProjectPayer.defaultPreferAddToBalance()).to.equal(
      INITIAL_PREFER_ADD_TO_BALANCE,
    );

    await expect(setDefaultsTx)
      .to.emit(jbProjectPayer, 'SetDefaultValues')
      .withArgs(
        INITIAL_PROJECT_ID,
        INITIAL_BENEFICIARY,
        INITIAL_PREFER_CLAIMED_TOKENS,
        INITIAL_MEMO,
        ethers.BigNumber.from(INITIAL_METADATA),
        INITIAL_PREFER_ADD_TO_BALANCE,
        owner.address,
      );
  });

  it(`Can't set defaults if not owner`, async function () {
    const { addrs, jbProjectPayer } = await setup();

    await expect(
      jbProjectPayer
        .connect(addrs[0])
        .setDefaultValues(
          PROJECT_ID,
          BENEFICIARY,
          PREFER_CLAIMED_TOKENS,
          MEMO,
          METADATA,
          PREFER_ADD_TO_BALANCE,
        ),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
