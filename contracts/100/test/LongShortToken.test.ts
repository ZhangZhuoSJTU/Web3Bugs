import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { LongShortToken } from '../typechain/LongShortToken'
import { LongShortTokenFixture } from './fixtures/LongShortTokenFixture'
import { revertReason } from './utils'

chai.use(solidity)

describe('=> LongShortToken', () => {
    let longShort: LongShortToken
    let deployer: SignerWithAddress
    let user: SignerWithAddress
    let user2: SignerWithAddress

    beforeEach(async () => {
        ;[deployer, user, user2] = await ethers.getSigners()
        longShort = await LongShortTokenFixture(
            'preSTRIPE LONG 100-200 30-September-2021',
            'preSTRP_L_100-200_30SEP21'
        )
    })

    describe('# initialize', () => {
        it('should be initialized with correct values', async () => {
            expect(await longShort.name()).to.eq(
                'preSTRIPE LONG 100-200 30-September-2021'
            )
            expect(await longShort.symbol()).to.eq('preSTRP_L_100-200_30SEP21')
        })

        it('owner should be set to deployer', async () => {
            expect(await longShort.owner()).to.eq(deployer.address)
        })
    })

    describe('# mint', () => {
        it('should only usable by the owner', async () => {
            await expect(
                longShort.connect(user).mint(user.address, 1)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })
        it('should allow the owner to mint tokens for another user', async () => {
            await longShort.connect(deployer).mint(user.address, 1)
            expect(await longShort.balanceOf(user.address)).to.eq(1)
        })
        it('should allow the owner to mint tokens for themselves', async () => {
            await longShort.connect(deployer).mint(deployer.address, 1)
            expect(await longShort.balanceOf(deployer.address)).to.eq(1)
        })
    })
})
