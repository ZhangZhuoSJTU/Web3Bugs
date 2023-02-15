import { expect } from 'chai';
import { BigNumber, Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';

const { utils } = ethers;
const { parseEther: toWei } = utils;

describe('ExtendedSafeCastLib', () => {
    let ExtendedSafeCastLib: Contract;
    let ExtendedSafeCastLibFactory: ContractFactory;

    before(async () => {
        ExtendedSafeCastLibFactory = await ethers.getContractFactory('ExtendedSafeCastLibHarness');
        ExtendedSafeCastLib = await ExtendedSafeCastLibFactory.deploy();
    });

    describe('toUint104()', () => {
        it('should return uint256 downcasted to uint104', async () => {
            const value = toWei('1');

            expect(await ExtendedSafeCastLib.toUint104(value)).to.equal(value);
        });
        it('should fail to return value if value passed does not fit in 104 bits', async () => {
            const value = BigNumber.from(2).pow(104);

            await expect(ExtendedSafeCastLib.toUint104(value)).to.be.revertedWith(
                "SafeCast: value doesn't fit in 104 bits",
            );
        });
    });

    describe('toUint208()', () => {
        it('should return uint256 downcasted to uint208', async () => {
            const value = toWei('1');

            expect(await ExtendedSafeCastLib.toUint208(value)).to.equal(value);
        });
        it('should fail to return value if value passed does not fit in 208 bits', async () => {
            const value = BigNumber.from(2).pow(209);

            await expect(ExtendedSafeCastLib.toUint208(value)).to.be.revertedWith(
                "SafeCast: value doesn't fit in 208 bits",
            );
        });
    });

    describe('toUint224()', () => {
        it('should return uint256 downcasted to uint224', async () => {
            const value = toWei('1');

            expect(await ExtendedSafeCastLib.toUint224(value)).to.equal(value);
        });

        it('should fail to return value if value passed does not fit in 208 bits', async () => {
            const value = BigNumber.from(2).pow(224);

            await expect(ExtendedSafeCastLib.toUint224(value)).to.be.revertedWith(
                "SafeCast: value doesn't fit in 224 bits",
            );
        });
    });
});
