const {ethers, upgrades, waffle} = require("hardhat");
const {parseEther} = ethers.utils;
const {waitNBlocks, encodeParameters, etherUnsigned, increaseTime} = require("../../utils");

require("chai").should();

describe("Governance Contract", async () => {
    before(async () => {
        [ADMIN, proxyAdmin] = await ethers.getSigners();

        console.log("Creating proxy instance of ERC20...");
        erc20Proxy = await upgrades.deployProxy(
            await ethers.getContractFactory("FaucetERC20"),
            ["Dai Stablecoin", "DAI"], //Must be "Dai Stablecoin" or permit signature verification will fail
            {initializer: "__FaucetERC20_init(string,string)"}
        );
        console.log(`ERC20 proxy created at ${erc20Proxy.address}`);
        await erc20Proxy.mint(ADMIN.address, parseEther("10000000"));

        console.log("Creating proxy instance of CreditLimitByMedian.sol...");
        const CreditLimitByMedian = await ethers.getContractFactory("CreditLimitByMedian");
        creditLimitByMedian = await CreditLimitByMedian.deploy(3);
        console.log(`CreditLimitByMedian proxy created at ${creditLimitByMedian.address}`);

        console.log("Creating proxy instance of FixedInterestRateModel.sol...");
        //The interest rate is set to 0 to prevent interference
        const FixedInterestRateModel = await ethers.getContractFactory("FixedInterestRateModel");
        fixedInterestRateModel = await FixedInterestRateModel.deploy(ethers.utils.parseEther("0"));
        console.log(`FixedInterestRateModel proxy created at ${fixedInterestRateModel.address}`);

        console.log("Creating proxy instance of unionToken.sol...");
        const block = await waffle.provider.getBlock("latest");
        const time = block.timestamp;
        const UnionToken = await ethers.getContractFactory("UnionToken");
        unionTokenProxy = await UnionToken.deploy("Union Token", "UNION", parseInt(time) + 10);
        console.log(`UnionToken proxy created at ${unionTokenProxy.address}`);

        console.log("Creating proxy instance of MarketRegistry.sol...");
        marketRegistryProxy = await upgrades.deployProxy(await ethers.getContractFactory("MarketRegistry"), {
            initializer: "__MarketRegistry_init()"
        });
        console.log(`MarketRegistry proxy created at ${marketRegistryProxy.address}`);

        console.log("Creating proxy instance of Comptroller.sol...");
        comptroller = await upgrades.deployProxy(
            await ethers.getContractFactory("Comptroller"),
            [unionTokenProxy.address, marketRegistryProxy.address],
            {initializer: "__Comptroller_init(address,address)"}
        );
        console.log(`Comptroller proxy created at ${comptroller.address}`);

        console.log("Creating proxy instance of AssetManager.sol...");
        assetManagerProxy = await upgrades.deployProxy(
            await ethers.getContractFactory("AssetManager"),
            [marketRegistryProxy.address],
            {
                initializer: "__AssetManager_init(address)"
            }
        );
        console.log(`AssetManager proxy created at ${assetManagerProxy.address}`);

        console.log("Creating proxy instance of userManagerProxy.sol...");
        userManagerProxy = await upgrades.deployProxy(
            await ethers.getContractFactory("UserManager"),
            [
                assetManagerProxy.address,
                unionTokenProxy.address,
                erc20Proxy.address,
                creditLimitByMedian.address,
                comptroller.address,
                ADMIN.address
            ],
            {
                initializer: "__UserManager_init(address,address,address,address,address,address)"
            }
        );
        console.log(`UserManager proxy created at ${userManagerProxy.address}`);
        //Handling fee is set to 0
        await userManagerProxy.setNewMemberFee(0);

        console.log("Creating proxy instance of Timelock.sol...");
        const Timelock = await ethers.getContractFactory("TimelockController");
        timlockProxy = await Timelock.deploy(etherUnsigned(7 * 24 * 60 * 60), [ADMIN.address], [ADMIN.address]);
        console.log(`Timelock proxy created at ${timlockProxy.address}`);

        console.log("Creating proxy instance of Governor.sol...");
        const Governor = await ethers.getContractFactory("UnionGovernorMock");
        governanceProxy = await Governor.deploy(unionTokenProxy.address, timlockProxy.address);
        console.log(`Governor proxy created at ${governanceProxy.address}`);
        await timlockProxy.grantRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), governanceProxy.address);
        await timlockProxy.grantRole(ethers.utils.id("PROPOSER_ROLE"), governanceProxy.address);
        await timlockProxy.grantRole(ethers.utils.id("EXECUTOR_ROLE"), governanceProxy.address);
        await timlockProxy.renounceRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), ADMIN.address);
        await timlockProxy.renounceRole(ethers.utils.id("PROPOSER_ROLE"), ADMIN.address);
        await timlockProxy.renounceRole(ethers.utils.id("EXECUTOR_ROLE"), ADMIN.address);

        const UErc20 = await ethers.getContractFactory("UErc20");
        const uErc20 = await UErc20.deploy("UToken", "UToken");
        uTokenProxy = await upgrades.deployProxy(
            await ethers.getContractFactory("UToken"),
            [
                uErc20.address,
                erc20Proxy.address,
                "1000000000000000000",
                "500000000000000000",
                "0",
                "1000000000000000000000000",
                "10000000000000000000000",
                "1000000000000000000",
                "10",
                ADMIN.address
            ],
            {
                initializer:
                    "__UToken_init(address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address)"
            }
        );
        await uErc20.transferOwnership(uTokenProxy.address);
        await marketRegistryProxy.addUToken(erc20Proxy.address, uTokenProxy.address);
        await erc20Proxy.approve(assetManagerProxy.address, parseEther("10000"));
        await userManagerProxy.addAdmin(timlockProxy.address);
    });

    it("Propose set new member fee", async () => {
        const targets = [userManagerProxy.address];
        const values = ["0"];
        const calldatas = [
            userManagerProxy.interface.encodeFunctionData("setNewMemberFee(uint256)", [parseEther("1")])
        ];

        await unionTokenProxy.delegate(ADMIN.address);
        await waitNBlocks(2);

        await governanceProxy["propose(address[],uint256[],bytes[],string)"](
            targets,
            values,
            calldatas,
            "set new member fee"
        );
    });

    it("Cast vote", async () => {
        let res;
        const proposalId = await governanceProxy.latestProposalIds(ADMIN.address);

        const votingDelay = await governanceProxy.votingDelay();
        await waitNBlocks(parseInt(votingDelay));

        res = await governanceProxy.state(proposalId);
        res.toString().should.eq("1");

        await governanceProxy.castVote(proposalId, 1);
        const votingPeriod = await governanceProxy.votingPeriod();
        await waitNBlocks(parseInt(votingPeriod));

        res = await governanceProxy.state(proposalId);
        res.toString().should.eq("4");

        await governanceProxy["queue(uint256)"](proposalId);

        await increaseTime(7 * 24 * 60 * 60);

        res = await governanceProxy.getActions(proposalId);
        console.log(res.toString());

        await governanceProxy["execute(uint256)"](proposalId);

        res = await userManagerProxy.newMemberFee();
        res.toString().should.eq(parseEther("1"));
    });
});
