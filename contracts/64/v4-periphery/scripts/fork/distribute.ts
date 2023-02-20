import { usdc } from "@studydefi/money-legos/erc20";
import { Signer } from "ethers";

import { task } from "hardhat/config";

import {
    ETH_HOLDER_ADDRESS_MAINNET,
    POOL_HOLDER_ADDRESS_MAINNET,
    POOL_TOKEN_ADDRESS_MAINNET,
    POOL_TOKEN_DECIMALS,
    USDC_HOLDER_ADDRESS_MAINNET,
} from "../../Constants";
import { action, success } from "../../helpers";

export default task("fork:distribute", "Distribute Ether and USDC").setAction(
    async (taskArguments, hre) => {
        action("Distributing Ether and USDC...");

        const { ethers } = hre;
        const { provider, getContractAt, getSigners } = ethers;
        const [deployer, attacker] = await getSigners();

        const ethHolder = provider.getUncheckedSigner(ETH_HOLDER_ADDRESS_MAINNET);
        const poolHolder = provider.getUncheckedSigner(
            POOL_HOLDER_ADDRESS_MAINNET
        ) as unknown as Signer;
        const usdcHolder = provider.getUncheckedSigner(
            USDC_HOLDER_ADDRESS_MAINNET
        ) as unknown as Signer;

        const usdcContract = await getContractAt(usdc.abi, usdc.address, usdcHolder);
        const poolContract = await getContractAt(usdc.abi, POOL_TOKEN_ADDRESS_MAINNET, poolHolder);

        const recipients: { [key: string]: string } = {
            ["Deployer"]: deployer.address,
            ["Attacker"]: attacker.address,
        };

        const keys = Object.keys(recipients);

        for (var i = 0; i < keys.length; i++) {
            const name = keys[i];
            const address = recipients[name];

            action(`Sending 1000 Ether to ${name}...`);
            await ethHolder.sendTransaction({
                to: address,
                value: ethers.utils.parseEther("1000"),
            });

            action(`Sending 1000 USDC to ${name}...`);
            await usdcContract.transfer(address, ethers.utils.parseUnits("1000", usdc.decimals));

            action(`Sending 12000 POOL to ${name}...`);
            await poolContract.transfer(
                address,
                ethers.utils.parseUnits("12000", POOL_TOKEN_DECIMALS)
            );
        }

        success("Done!");
    }
);
