import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import AllocationTree from "../merkle-tree/balance-tree";



const PERCENTAGE_SCALE = 1000000;
const NULL_BYTES =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
    const claimers = ['0x8211310A6d22b2098193A68A006FA6b0784df9E3', '0x4A0f811d7bC167CF8D59542beB51BDEE300DFE14'];
   
    const NftContract = await ethers.getContractFactory("MyNFT");
    const nftContract = NftContract.attach('0xD7B8ea11E1171aa8a429F5A59c3A01eb03d70957');

    const Splitter = await ethers.getContractFactory("Splitter");
    const splitter = Splitter.attach('0xF28D92158fa45E47fC0798D9271CD5c0dd3D59bb');

    const SplitFactory = await ethers.getContractFactory("SplitFactory");
    const proxyFactory = SplitFactory.attach('0x6B6630271993f17b8FEeA49FC367C9D0666Ad0bE');

    //console.log(await nftContract.ownerOf(1));

    const allocationPercentages = [50000000, 50000000];
    const allocations = allocationPercentages.map((percentage, index) => {
        return {
            account: nftContract.address,
            tokenId:index+1,
            allocation: BigNumber.from(percentage),
        };
    });
    
    let tree = new AllocationTree(allocations);
    const rootHash = tree.getHexRoot();

    // const deployTx = await proxyFactory
    //     .createSplit(rootHash);
    const constructorArgs = ethers.utils.defaultAbiCoder.encode(
        ["bytes32"],
        [rootHash]
    );
    const salt = ethers.utils.keccak256(constructorArgs);
    const proxyBytecode = (await ethers.getContractFactory("SplitProxy"))
        .bytecode;
    const codeHash = ethers.utils.keccak256(proxyBytecode);
    const proxyAddress = await ethers.utils.getCreate2Address(
        proxyFactory.address,
        salt,
        codeHash
    );
    let proxy = 
        await ethers.getContractAt("SplitProxy", proxyAddress)

    // console.log(proxy)

    let callableProxy =
        await ethers.getContractAt("Splitter", proxy.address)
    
    const window = 1;
    const account = claimers[1];
    let allocation = BigNumber.from("50000000");
    const proof = tree.getProof(nftContract.address,2, allocation);
    const accountBalanceBefore = await waffle.provider.getBalance(
        account
    );

    console.log('Balance Before',accountBalanceBefore);
    
    let claimTx = await callableProxy
    .claim(window, nftContract.address,2, allocation, proof);
    
    const accountBalanceAfter = await waffle.provider.getBalance(
        account
        );
    
    console.log('Balance Before',accountBalanceAfter);
   
    //let res=await callableProxy.incrementWindow();

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
