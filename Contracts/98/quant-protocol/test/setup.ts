import { expect, use } from "chai";
import { waffle } from "hardhat";

const { solidity } = waffle;
use(solidity);

const provider = waffle.provider;

export { expect, provider };
