import { ethers } from 'hardhat';
import { expect } from 'chai';
import { constants, Wallet } from 'ethers';
import { formatEther, parseUnits, randomBytes } from 'ethers/lib/utils'
import { deployContract, signPermission, signPermitEIP2612 } from './utils'

const DAY = 60 * 60 * 24;

describe("Token contract", function() {
  it("Deployment should assign the total supply of tokens to the owner", async function() {
    const [owner] = await ethers.getSigners();

    // Deploy tokens for staking and rewards
    const StakingToken = await ethers.getContractFactory("StakingToken");
    const RewardToken = await ethers.getContractFactory("RewardToken");

    const stakingToken = await StakingToken.deploy(owner.address);
    const rewardToken = await RewardToken.deploy(owner.address);

    // Checking that token contracts have successfully deployed & credited
    // owner with tokens
    const ownerBalance = await stakingToken.balanceOf(owner.address);
    expect(await stakingToken.totalSupply()).to.equal(ownerBalance);

    const ownerRewardBalance = await rewardToken.balanceOf(owner.address);
    expect(await rewardToken.totalSupply()).to.equal(ownerBalance);

    // Deploy VisorFactory & Visor template
    const VisorFactory = await ethers.getContractFactory("VisorFactory");
    const Visor = await ethers.getContractFactory("Visor");

    const visorTemplate = await Visor.deploy();
    const visorFactory = await VisorFactory.deploy();

    await visorTemplate.initializeLock();

    const name = ethers.utils.formatBytes32String('VISOR-1.0.0')
    const tx = await visorFactory.addTemplate(name, visorTemplate.address);

    console.log('addTemplate tx ', tx.hash);

    // Deploy user's Visor
    const visor = await ethers.getContractAt(
      'Visor',
      await visorFactory.callStatic['create()'](),
    )

    await visorFactory['create()']()

    // Deploy Hypervisor & required factoriees
    const RewardPoolFactory = await ethers.getContractFactory("RewardPoolFactory");
    const rewardPoolFactory = await RewardPoolFactory.deploy();

    const PowerSwitchFactory = await ethers.getContractFactory("PowerSwitchFactory");
    const powerSwitchFactory = await PowerSwitchFactory.deploy();

    const Hypervisor = await ethers.getContractFactory("Hypervisor");
    const hypervisor = await Hypervisor.deploy(owner.address, rewardPoolFactory.address, powerSwitchFactory.address, stakingToken.address, rewardToken.address, [0, 1000, 28 * DAY], 2500);

    // Fund Hypervisor

    console.log('Approve reward deposit')
    const approveTx = await rewardToken.approve(hypervisor.address, constants.MaxUint256);
    await approveTx.wait();
    console.log('  in', approveTx.hash);

    console.log('Deposit reward');
    const depositTx = await hypervisor.fund(1000000, 28 * DAY);
    console.log('  in', depositTx.hash);

    // Register Vault Factory
    await hypervisor.registerVaultFactory(visorFactory.address);

    // Deploy Mainframe
    const Mainframe = await ethers.getContractFactory("Mainframe");
    const mainframe = await Mainframe.deploy();

    // Permit and Stake
    const signerWallet = Wallet.fromMnemonic(process.env.DEV_MNEMONIC || '')
    expect(owner.address).to.be.eq(signerWallet.address)

    const amount = 1000;

    let permission = await signPermission(
      'Lock',
      visor,
      signerWallet,
      hypervisor.address,
      stakingToken.address,
      amount,
      0,
    )

    await stakingToken.approve(mainframe.address, ethers.constants.MaxUint256);

    await mainframe.stake(hypervisor.address, visor.address, amount, permission);

    // after staking `amount`, expect visor value locked to be `amount`
    let balanceLocked = await visor.getBalanceLocked(stakingToken.address);
    expect(balanceLocked).to.equal(amount);
    let lockSetCount = await visor.getLockSetCount();
    expect(lockSetCount).to.equal(1);

    //unclaim and stake
    let nonce = await visor.getNonce()

    const unlockPermission = await signPermission(
      'Unlock',
      visor,
      signerWallet,
      hypervisor.address,
      stakingToken.address,
      amount,
      nonce,
    )

    await hypervisor.unstakeAndClaim(
      visor.address,
      amount,
      unlockPermission,
    )

    // after unstaking `amount`, expect visor value locked to be 0
    balanceLocked = await visor.getBalanceLocked(stakingToken.address);
    expect(balanceLocked).to.equal(0);
    lockSetCount = await visor.getLockSetCount();
    expect(lockSetCount).to.equal(0);

    // Test Stakelimit
    nonce = await visor.getNonce()
    permission = await signPermission(
      'Lock',
      visor,
      signerWallet,
      hypervisor.address,
      stakingToken.address,
      amount*3,
      nonce,
    )
    await expect(mainframe.stake(hypervisor.address, visor.address, amount*3, permission)).to.be.revertedWith("Hypervisor: Stake limit exceeded");

    // Test RAGEQUIT
    nonce = await visor.getNonce()
    permission = await signPermission(
      'Lock',
      visor,
      signerWallet,
      hypervisor.address,
      stakingToken.address,
      amount*2,
      nonce,
    )

    await mainframe.stake(hypervisor.address, visor.address, amount*2, permission);

    // after stake, expect balance locked to be equal to 2xamount
    balanceLocked = await visor.getBalanceLocked(stakingToken.address);
    lockSetCount = await visor.getLockSetCount();
    expect(lockSetCount).to.equal(1);
    expect(balanceLocked).to.equal(amount*2);

    await visor.rageQuit(hypervisor.address, stakingToken.address);
  });
});
