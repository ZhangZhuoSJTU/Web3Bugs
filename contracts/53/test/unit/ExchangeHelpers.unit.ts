import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { appendDecimals, BIG_NUMBER_ZERO, UINT256_MAX } from "../helpers";
import { DummyRouter, MockERC20 } from "../../typechain";

describe("ExchangeHelpers", () => {
    let dummyRouter: DummyRouter, mockERC20: MockERC20;
    let bob: SignerWithAddress, randomContract: SignerWithAddress;

    before(async () => {
        const signers = await ethers.getSigners();
        bob = signers[0] as any;
        randomContract = signers[1] as any;
    });

    beforeEach(async () => {
        const dummyRouterFactory = await ethers.getContractFactory("DummyRouter");
        dummyRouter = await dummyRouterFactory.deploy();

        const mockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockERC20 = await mockERC20Factory.deploy("Mocked ERC20", "MOCK20", appendDecimals(3000000));
    });

    /*
     * The dummyRouter has these two functions :
     * - setMaxAllowance(IERC20 _token, address _spender), using the ExchangeHelper
     * - setAllowance(IERC20 _token, address _spender, uint256 _amount)
     */
    describe("#setMaxAllowance", () => {
        it("should sets allowance to type(uint256).max", async () => {
            let currentAllowance = await mockERC20.allowance(dummyRouter.address, randomContract.address);
            expect(currentAllowance).to.equal(BIG_NUMBER_ZERO);

            await dummyRouter.setMaxAllowance(mockERC20.address, randomContract.address);
            currentAllowance = await mockERC20.allowance(dummyRouter.address, randomContract.address);
            expect(currentAllowance).to.equal(UINT256_MAX);
        });

        it("should increase allowance to type(uint256).max", async () => {
            let allowance = appendDecimals(100);
            await dummyRouter.setAllowance(mockERC20.address, randomContract.address, allowance);
            let currentAllowance = await mockERC20.allowance(dummyRouter.address, randomContract.address);
            expect(currentAllowance).to.equal(allowance);

            await dummyRouter.setMaxAllowance(mockERC20.address, randomContract.address);
            currentAllowance = await mockERC20.allowance(dummyRouter.address, randomContract.address);
            expect(currentAllowance).to.equal(UINT256_MAX);
        });

        it("should keep allowance to type(uint256).max", async () => {
            await dummyRouter.setAllowance(mockERC20.address, randomContract.address, UINT256_MAX);
            let currentAllowance = await mockERC20.allowance(dummyRouter.address, randomContract.address);
            expect(currentAllowance).to.equal(UINT256_MAX);

            await dummyRouter.setMaxAllowance(mockERC20.address, randomContract.address);
            currentAllowance = await mockERC20.allowance(dummyRouter.address, randomContract.address);
            expect(currentAllowance).to.equal(UINT256_MAX);
        });
    });
});
