import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { NumberOrString, parseDecimal, formatDecimal, MAX_NUMBER_DIGITS } from "./Decimal";
import * as signers from "@nomiclabs/hardhat-ethers/dist/src/signers";

export type Signer = signers.SignerWithAddress;
export type SignerOrAddress = Signer|string;

/** @return Address field from signer or address string */
export function addressOf(signer:SignerOrAddress) {
  if (typeof(signer) === "string")
    return signer;
  if (signer.address)
    return signer.address;
  throw new Error("Invalid signer (no address): " + signer);
}

/**
 * Base class for Any contract
 * Contains several utilities for deploying, attaching and type conversions
 */
export abstract class ContractBase
{
  contractName:string;
  contract:Contract;
  decimals:number;
  address:string; // address of the contract, `this.contract.address`

  constructor(contractName:string, decimals:number, contract?:Contract) {
    if (!contractName)
      throw new Error("`contractName` cannot be empty or null");
    this.contractName = contractName;
    this.contract = contract!;
    this.decimals = decimals;
    this.address = contract ? contract.address : '0x0';
  }

  protected initialize(contract:Contract) {
    if (!contract)
      throw new Error("`contract` cannot be null");
    this.contract = contract;
    this.address = contract.address;
  }
  
  /** Connects a user to the contract, so that transactions can be sent by the user */
  connect(user:SignerOrAddress): Contract {
    return this.contract.connect(user);
  }

  /** @return Converts a Number or String into this Contract's BigNumber decimal */
  toBigNum(amount:NumberOrString):BigNumber {
    // TODO: validate the number/string
    if (typeof(amount) === "string") {
      return parseDecimal(amount, this.decimals);
    }
    const decimal = amount.toString();
    if (decimal.length > MAX_NUMBER_DIGITS) {
      throw new Error("ERC20.toBigNum possible number overflow, use a string instead: " + decimal);
    }
    return parseDecimal(decimal, this.decimals);
  }

  /** @return Converts a BN big decimal of this Contract into a String or Number */
  fromBigNum(contractDecimal:BigNumber): NumberOrString {
    return formatDecimal(contractDecimal, this.decimals);
  }

  /**
   * Deploy a contract of any type
   * @param contractName Name of the solidity contract
   * @param args... Optional arguments for the deployed contract
   */
  static async deployContract(contractName:string, ...args: any[]): Promise<Contract> {
    const factory = await ethers.getContractFactory(contractName);
    return await factory.deploy(...args);
  }

  /**
   * Attaches to any contract address
   * @param contractName Name of the solidity contract
   * @param contractAddress Address of the contract
   */
  static async attachContract(contractName:string, contractAddress:string): Promise<Contract> {
    const factory = await ethers.getContractFactory(contractName);
    return await factory.attach(contractAddress);
  }
}
