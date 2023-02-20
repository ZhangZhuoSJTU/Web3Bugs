import * as fc from 'fast-check'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers, waffle } from 'hardhat'
import { expect } from '../../shared/Expect'
import { MsgValueCallee } from '../../../typechain'
import { infiniteStream } from 'fast-check'
import { ContractTransaction } from '@ethersproject/contracts'
import { loadFixture } from '@ethereum-waffle/provider'
import { Fixture } from '../../shared/Fixtures'
import { Wallet } from '@ethersproject/wallet'
import { deployContract } from 'ethereum-waffle'
import { advanceTimeAndBlock } from '../../shared/Helper'
const MAXUINT256 = (1n << 256n) -1n
const MAXUINT112 = (1n << 112n) -1n

async function msgValueContractFixture() {
    const msgValueCalleeFactory = await ethers.getContractFactory('MsgValueCallee')
    const msgValueCalleeContract =  (await msgValueCalleeFactory.deploy()) as MsgValueCallee
    await msgValueCalleeContract.deployTransaction.wait()
    await ethers.provider.send('evm_mine',[])
    return msgValueCalleeContract
}


describe('Msg Value',()=>{
    it('Succeded', async()=>{
        const signers = await ethers.getSigners()
        await fc.assert(
            fc.asyncProperty(
                fc.bigUintN(200).filter((x)=> x>0).noShrink(),
                async (ethSent) => {
                    async function msgValueFixture(){
                        const signer = signers[1]
                    
                        const msgValueContract = await msgValueContractFixture()
                    
                        const txn: ContractTransaction = await msgValueContract.connect(signers[1]).getUint112({value: ethSent.toString()})
                        await txn.wait()
                    
                        return msgValueContract
                    }
                    const msgValueContract = await  msgValueFixture()
                    const contractBalance = (await ethers.provider.getBalance(msgValueContract.address)).toBigInt()
                    if(ethSent>MAXUINT112){
                        expect(contractBalance).equalBigInt(MAXUINT112);
                    }
                    else{
                        expect(contractBalance).equalBigInt(ethSent)
                    }
                }
            )
        )
    })
})