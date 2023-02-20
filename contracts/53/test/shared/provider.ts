import { waffle } from "hardhat";
import { smock } from "@defi-wonderland/smock";

export const provider = waffle.provider;
export const createFixtureLoader = waffle.createFixtureLoader;

const chai = require("chai");
chai.use(smock.matchers);
export const expect = chai.expect;
