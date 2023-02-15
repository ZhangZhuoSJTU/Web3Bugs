import { ethers } from 'hardhat';
import { assert, expect } from 'chai';
import { constants, Wallet } from 'ethers';
import { formatEther, parseUnits, randomBytes } from 'ethers/lib/utils'
import { deployContract, signPermission, signPermitEIP2612 } from './utils'

describe("Visor contract", function() {

  let owner: any = null;
  let outsider: any = null;
  let visor: any = null;
  let visorFactory: any = null;
  let testToken: any = null;

  before('should setup the contract instances', async () => {

    // Get owner
    [owner, outsider] = await ethers.getSigners()

    // Deploy VisorFactory & Visor template
    const VisorFactory = await ethers.getContractFactory("VisorFactory");
    const Visor = await ethers.getContractFactory("Visor");

    const visorTemplate = await Visor.deploy();
    visorFactory = await VisorFactory.deploy();

    await visorTemplate.initializeLock();

    const name = ethers.utils.formatBytes32String('VISOR-2.0.1')
    const tx = await visorFactory.addTemplate(name, visorTemplate.address);

    // Deploy user's Visor
    visor = await ethers.getContractAt(
      'Visor',
      await visorFactory.callStatic['create()'](),
    )

    await visorFactory['create()']()

    // Get StakingToken contract and deploy
    const TestToken = await ethers.getContractFactory("StakingToken");
    testToken = await TestToken.deploy(owner.address);

  })

  it('should delegateTransferERC20 only for approved address, amount', async()=> {

    let ownerBalance = await testToken.balanceOf(owner.address);
    
    await testToken.transfer(visor.address, ownerBalance); 

    // not approved 
    await expect(
      visor.connect(outsider).delegatedTransferERC20(outsider.address, testToken.address, ownerBalance)
    ).to.be.reverted;
    
    await visor.approveTransferERC20(testToken.address, outsider.address, 1);

    // more than approved amount
    await expect(
      visor.connect(outsider).delegatedTransferERC20(testToken.address, outsider.address, ownerBalance)
    ).to.be.reverted;
    
    await visor.connect(outsider).delegatedTransferERC20(testToken.address, outsider.address, 1)

    // outsider should have ownerBalance tokens
    expect((await testToken.balanceOf(outsider.address)).toString()).to.equal('1');

    // return tokens to owner
    await visor.transferERC20(testToken.address, owner.address, (await testToken.balanceOf(visor.address)));
    await testToken.connect(outsider).transfer(owner.address, (await testToken.balanceOf(outsider.address)));

  })

  it('should create ERC20 timelock and allow withdrawal only to recipient after expiry', async()=> {

    let currentTime = Math.floor(new Date().getTime()/1000); 
    let duration = 60*3;
    
    let ownerBalance = await testToken.balanceOf(owner.address);

    await testToken.approve(visor.address, ownerBalance); 
    await visor.timeLockERC20(outsider.address, testToken.address, ownerBalance, currentTime+duration); 

    // not expired
    await expect(
      visor.connect(outsider).timeUnlockERC20(outsider.address, testToken.address, ownerBalance, currentTime+duration)
    ).to.be.reverted;
    
    await ethers.provider.send("evm_increaseTime", [6000])
    await ethers.provider.send("evm_mine",[])
    
    // not recipient
    await expect(
      visor.timeUnlockERC20(outsider.address, testToken.address, ownerBalance, currentTime+duration)
    ).to.be.reverted;

    await visor.connect(outsider).timeUnlockERC20(outsider.address, testToken.address, ownerBalance, currentTime+duration);
    let outBalance = await testToken.balanceOf(outsider.address);

    // outsider should have ownerBalance tokens
    expect(await testToken.balanceOf(outsider.address)).to.equal(ownerBalance);

    // return tokens to owner 
    await testToken.connect(outsider).transfer(owner.address, (await testToken.balanceOf(outsider.address)));
  })

  it('should create ERC721 timelock and allow withdrawal only to recipient only after expiry', async()=> {
    let currentTime = (
      await ethers.provider.getBlock (
        await ethers.provider.getBlockNumber()
      )
    ).timestamp;
    let duration = 6000;

    // deploy a test Visor
    let testVisor = await ethers.getContractAt(
       'Visor',
       await visorFactory.callStatic['create()'](),
     )

    await visorFactory['create()']()

    // get tokenId fo test Visor
    let tokenId = await visorFactory.tokenOfOwnerByIndex(owner.address, 1);
    await visorFactory.functions['safeTransferFrom(address,address,uint256)'](owner.address, visor.address, tokenId); 

    // check nft was deposited
    let info = await visor.getNftById(0);
    assert(info.tokenId.toString() == tokenId); 

    // unnapproved transfer should fail
    await expect(
      visor.connect(outsider).transferERC721(outsider.address, visorFactory.address, tokenId)
    ).to.be.reverted;
    
    // approved transfer
    await visor.approveTransferERC721(outsider.address, visorFactory.address, tokenId);
    await visor.transferERC721(outsider.address, visorFactory.address, tokenId);

    // transfer back to owner 
    await visorFactory.connect(outsider).functions['safeTransferFrom(address,address,uint256)'](outsider.address, owner.address, tokenId); 

    await visorFactory.functions['approve(address,uint256)'](visor.address, tokenId); 
    await visor.timeLockERC721(outsider.address, visorFactory.address, tokenId, currentTime+duration);

    // not expired
    await expect(
      visor.timeUnlockERC721(outsider.address, visorFactory.address, tokenId, currentTime+duration)
    ).to.be.reverted;

    // not recipient
    await expect(
      visor.timeUnlockERC721(owner.address, visorFactory.address, tokenId, currentTime+duration)
    ).to.be.reverted;

    await ethers.provider.send("evm_increaseTime", [6000])
    await ethers.provider.send("evm_mine",[])
 
    await visor.connect(outsider).timeUnlockERC721(outsider.address, visorFactory.address, tokenId, currentTime+duration);

    expect(await testVisor.owner()).to.equal(outsider.address);

  })

});
