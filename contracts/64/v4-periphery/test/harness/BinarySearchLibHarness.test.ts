import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';

const { getSigners } = ethers;

describe('BinarySearchLibHarness', () => {
    let wallet1: SignerWithAddress;
    let binarySearchLibHarness: Contract;
    let binarySearchLibHarnessFactory: ContractFactory;

    before(async () => {
        [wallet1] = await getSigners();
        binarySearchLibHarnessFactory = await ethers.getContractFactory(
            'BinarySearchLibHarness'
        );
    });

    beforeEach(async () => {
        binarySearchLibHarness = await binarySearchLibHarnessFactory.deploy([]);
    });

    describe('history.length == 1', () => {
        it('should fail to get index [S |]', async () => {
            await binarySearchLibHarness.set([2]);
            expect(binarySearchLibHarness.getIndex(1)).to.be.revertedWith('BinarySearchLib/draw-id-out-of-range');
        });
        
        it('should succeed to get index [S|]', async () => {
            await binarySearchLibHarness.set([1]);
            const index = await binarySearchLibHarness.getIndex(1);
            expect(index).to.equal(0);
        });
        
        it('should succeed to get index [| S]', async () => {
            await binarySearchLibHarness.set([1]);
            const index = await binarySearchLibHarness.getIndex(1);
            expect(index).to.equal(0);
        });
    })
    
    describe('history.length == 2', () => {
        it('should fail to get index [S | |]', async () => {
            await binarySearchLibHarness.set([2,3]);
            expect(binarySearchLibHarness.getIndex(1)).to.be.revertedWith('BinarySearchLib/draw-id-out-of-range');
        });
        
        it('should succeed to get index [S| |]', async () => {
            await binarySearchLibHarness.set([1,2]);
            const index = await binarySearchLibHarness.getIndex(1);
            expect(index).to.equal(0);
        });
        
        it('should succeed to get index [| S |]', async () => {
            await binarySearchLibHarness.set([1,3]);
            const index = await binarySearchLibHarness.getIndex(2);
            expect(index).to.equal(0);
        });
        
        it('should succeed to get index [| |S]', async () => {
            await binarySearchLibHarness.set([1,2]);
            const index = await binarySearchLibHarness.getIndex(2);
            expect(index).to.equal(1);
        });
        
        it('should succeed to get index [| | S ]', async () => {
            await binarySearchLibHarness.set([1,2]);
            const index = await binarySearchLibHarness.getIndex(3);
            expect(index).to.equal(1);
        });
    })
    
    describe('history.length == 3', () => {
        it('should fail to get index [S | | |]', async () => {
            await binarySearchLibHarness.set([2,3,4]);
            expect(binarySearchLibHarness.getIndex(1)).to.be.revertedWith('BinarySearchLib/draw-id-out-of-range');
        });
        
        it('should succeed to get index [S| | |]', async () => {
            await binarySearchLibHarness.set([1,2,3]);
            const index = await binarySearchLibHarness.getIndex(1);
            expect(index).to.equal(0);
        });
        
        it('should succeed to get index [| S | |]', async () => {
            await binarySearchLibHarness.set([1,3,4]);
            const index = await binarySearchLibHarness.getIndex(2);
            expect(index).to.equal(0);
        });
        
        it('should succeed to get index [| S| |]', async () => {
            await binarySearchLibHarness.set([1,3,4]);
            const index = await binarySearchLibHarness.getIndex(3);
            expect(index).to.equal(1);
        });
        
        it('should succeed to get index [| | S |]', async () => {
            await binarySearchLibHarness.set([1,3,5]);
            const index = await binarySearchLibHarness.getIndex(4);
            expect(index).to.equal(1);
        });
        
        it('should succeed to get index [| | |S]', async () => {
            await binarySearchLibHarness.set([1,3,5]);
            const index = await binarySearchLibHarness.getIndex(5);
            expect(index).to.equal(2);
        });
        
        it('should succeed to get index [| | | S]', async () => {
            await binarySearchLibHarness.set([1,3,5]);
            const index = await binarySearchLibHarness.getIndex(6);
            expect(index).to.equal(2);
        });
    })

    describe('history.length == 4', () => {
        it('should succeed to get index [| | | S |]', async () => {
            await binarySearchLibHarness.set([1,4,7,10]);
            const index = await binarySearchLibHarness.getIndex(8);
            expect(index).to.equal(2);
        });
    })
});
