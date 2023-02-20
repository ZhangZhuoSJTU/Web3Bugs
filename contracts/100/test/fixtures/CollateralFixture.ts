import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers, upgrades } from 'hardhat'
import { Collateral, TestCollateral } from '../../typechain'

chai.use(solidity)

export async function collateralFixture(
    tokenAddress: string,
    treasuryAddress: string
): Promise<Collateral> {
    const Collateral = await ethers.getContractFactory('Collateral')
    return (await upgrades.deployProxy(Collateral, [
        tokenAddress,
        treasuryAddress,
    ])) as any
}

export async function testCollateralFixture(
    tokenAddress: string,
    treasuryAddress: string
): Promise<TestCollateral> {
    const TestCollateral = await ethers.getContractFactory('TestCollateral')
    /**
     * This is only meant for testing to prevent warnings for use of delegatecall().
     * OpenZeppelin Upgrades by default does not allow the logic contract to
     * use delegatecall() since the fear is that the target of the delegatecall()
     * could call selfdestruct() which would destroy the logic contract, and thus
     * leave the storage contract pointing to a nonexistent implementation. For
     * testing purposes, this is not an issue so we silence the warning.
     */
    upgrades.silenceWarnings()
    return (await upgrades.deployProxy(
        TestCollateral,
        [tokenAddress, treasuryAddress],
        {
            unsafeAllow: ['delegatecall'],
        }
    )) as any
}
