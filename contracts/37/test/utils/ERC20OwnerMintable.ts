import { Contract } from "ethers";
import { NumberOrString } from "./Decimal";
import { SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";

/**
 * Type safe wrapper of ERC20OwnerMintableToken
 */
export class ERC20OwnerMintable extends ERC20 {
  constructor(contractName:string, decimals:number, contract:Contract) {
    super(contractName, decimals, contract);
  }

  static async create(contractName:string, name:string, symbol:string): Promise<ERC20OwnerMintable> {
    const contract = await this.deployContract(contractName, name, symbol);
    return new ERC20OwnerMintable(contractName, 18, contract);
  }

  /** @returns The manager who is allowed to mint and burn. */
  async manager(): Promise<string> {
    return await this.contract.manager();
  }

  /**
   * @param sender Account that is issuing the mint. Must be manager().
   * @param receiver Recipient address to mint tokens to
   * @param amount Number of tokens to mint
   */
  async mint(sender:SignerOrAddress, receiver:SignerOrAddress, amount:NumberOrString) {
    await this.connect(sender).mint(addressOf(receiver), this.toBigNum(amount));
  }

  /**
   * @param sender Account that is issuing the burn. Must be manager().
   * @param amount Number of tokens to burn
   */
  async burn(sender:SignerOrAddress, amount:NumberOrString) {
    await this.connect(sender).burn(this.toBigNum(amount));
  }

  /**
   * @param sender Account that is issuing the burn. Must be manager().
   * @param account Source address to burn tokens from
   * @param amount Number of tokens to burn
   */
  async burnFrom(sender:SignerOrAddress, account:SignerOrAddress, amount:NumberOrString) {
    await this.connect(sender).burnFrom(addressOf(account), this.toBigNum(amount));
  }
}
