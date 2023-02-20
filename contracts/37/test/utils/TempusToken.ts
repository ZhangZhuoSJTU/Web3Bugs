import { NumberOrString } from "./Decimal";
import { SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";

/**
 * Type safe wrapper of TempusToken
 */
export class TempusToken extends ERC20 {
  constructor() {
    super("TempusToken", 18);
  }

  /**
   * Burn the token holder's own tokens.
   * @param sender Account that is issuing the burn.
   * @param amount Number of tokens to burn
   */
  async burn(sender:SignerOrAddress, amount:NumberOrString): Promise<void> {
    await this.connect(sender).burn(this.toBigNum(amount));
  }

  /**
   * Burn some other token holder's tokens.
   * @param sender Account that is issuing the burn.
   * @param account Token holder account
   * @param amount Number of tokens to burn
   */
  async burnFrom(sender:SignerOrAddress, account:SignerOrAddress, amount:NumberOrString): Promise<void> {
    await this.connect(sender).burnFrom(addressOf(account), this.toBigNum(amount));
  }
}
