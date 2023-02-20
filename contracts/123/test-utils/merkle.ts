import { BigNumber } from "ethers";
import { MerkleTree } from "merkletreejs";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";

const hashFn = (data: string) => keccak256(data).slice(2);

export const createTreeWithAccounts = (accounts: Record<string, BigNumber>): MerkleTree => {
    const elements = Object.entries(accounts).map(([account, balance]) =>
        solidityKeccak256(["address", "uint256"], [account, balance.toString()]),
    );
    return new MerkleTree(elements, hashFn, { sort: true });
};

export const getAccountBalanceProof = (tree: MerkleTree, account: string, balance: BigNumber) => {
    const element = solidityKeccak256(["address", "uint256"], [account, balance.toString()]);
    return tree.getHexProof(element);
};
