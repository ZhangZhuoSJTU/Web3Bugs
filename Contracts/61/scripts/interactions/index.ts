import { createPool } from './pool';
import { verify } from './adminVerifier';
import contracts from './contracts.json';
import { ethers } from 'hardhat';
import { PoolData } from './types';
import { zeroAddress } from '../../utils/constants';
import { addStrategy } from './addStrategy';

async function run() {
    // await addStrategy(zeroAddress);
    // console.log("strategy added");
    // let borrower = (await ethers.getSigners())[2];
    // await verify("0xDdD7B873a60e6b1F908115C020DB7908F5E08f1C", "@jkrantz", true);
    // const poolData: PoolData = {
    //     borrower,
    //     borrowToken: "0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa",
    //     collateralToken: zeroAddress,
    //     strategy: zeroAddress,
    //     salt: ethers.utils.keccak256(Buffer.from(borrower.address+Date.now().toString(16))),
    //     transferFromSavingsAccount: false,
    //     poolCreateParams: {
    //         _poolSize: 10000000000,
    //         _borrowRate: ethers.utils.parseUnits(6+"", 30),
    //         _collateralAmount: 10000000000,
    //         _collateralRatio: ethers.utils.parseUnits(0.5+"", 30),
    //         _collectionPeriod: 0,
    //         _loanWithdrawalDuration: 0,
    //         _noOfRepaymentIntervals: 15,
    //         _repaymentInterval: 3600
    //     }
    // };
    // await createPool(poolData, contracts);
}

run();
