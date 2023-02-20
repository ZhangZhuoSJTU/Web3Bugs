const { expect } = require("chai");

describe("NFTLoanTicket contract", function () {
    let name = 'Ticket'
    let symbol = 'T'

    beforeEach(async function () {
        [pretendNFTLoanFacilitator, pretendDescriptor, addr1, ...addrs] = await ethers.getSigners();

        NFTLoanTicketContract = await ethers.getContractFactory("NFTLoanTicket");
        NFTLoanTicket = await NFTLoanTicketContract.deploy(name, symbol, pretendNFTLoanFacilitator.address, pretendDescriptor.address)
        await NFTLoanTicket.deployed();
    })

    describe("contructor", function () {
        it("sets name correctly", async function(){
            const n = await NFTLoanTicket.name();
            expect(n).to.equal(name)
        })

        it("sets symbol correctly", async function(){
            const s = await NFTLoanTicket.symbol();
            expect(s).to.equal(symbol)
        })

        it("sets nftLoanFacilitator correctly", async function(){
            const p = await NFTLoanTicket.nftLoanFacilitator();
            expect(p).to.equal(pretendNFTLoanFacilitator.address)
        })

        it("sets descriptor correctly", async function(){
            const d = await NFTLoanTicket.descriptor();
            expect(d).to.equal(pretendDescriptor.address)
        })
    })

    describe("mint", function () {
        context('when caller is not loan facilitator', function(){
            it('reverts', async function(){
                await expect(
                    NFTLoanTicket.connect(addr1).mint(addr1.address, "1")
                ).to.be.revertedWith("NFTLoanTicket: only loan facilitator")
            })
        })
        
        context('when caller is loan facilitator', function(){
            it('mints', async function(){
                await expect(
                    NFTLoanTicket.connect(pretendNFTLoanFacilitator).mint(addr1.address, "1")
                ).not.to.be.reverted
                const owner = await NFTLoanTicket.ownerOf("1")
                expect(owner).to.equal(addr1.address)
            })

            context('when tokenId exists', function(){
                it('reverts', async function(){
                    await NFTLoanTicket.connect(pretendNFTLoanFacilitator).mint(addr1.address, "1")
                    await expect(
                        NFTLoanTicket.connect(pretendNFTLoanFacilitator).mint(addr1.address, "1")
                    ).to.be.revertedWith('ALREADY_MINTED')
                    const owner = await NFTLoanTicket.ownerOf("1")
                    expect(owner).to.equal(addr1.address)
                })
            })
        })
    })
})