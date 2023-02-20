const { expect } = require("chai");

describe("LendTicket contract", function () {
    beforeEach(async function () {
        [pretendNFTLoanFacilitator, pretendDescriptor, addr1, addr2, ...addrs] = await ethers.getSigners();

        LendTicketContract = await ethers.getContractFactory("LendTicket");
        LendTicket = await LendTicketContract.deploy(pretendNFTLoanFacilitator.address, pretendDescriptor.address)
        await LendTicket.deployed();

        await LendTicket.connect(pretendNFTLoanFacilitator).mint(addr1.address, "1");
    })

    describe("loanFacilitatorTransfer", function () {
        it('reverts if caller is not loan facilitator', async function(){
            await expect(
                LendTicket.connect(addr1).loanFacilitatorTransfer(addr1.address, addr2.address, "1")
            ).to.be.revertedWith("NFTLoanTicket: only loan facilitator")
        })

        it('transfers correctly if caller is loan facilitator', async function(){
            await expect(
                LendTicket.connect(pretendNFTLoanFacilitator).loanFacilitatorTransfer(addr1.address, addr2.address, "1")
            ).not.to.be.reverted
            const owner = await LendTicket.ownerOf("1")
            expect(owner).to.equal(addr2.address)
        })
    })  
})