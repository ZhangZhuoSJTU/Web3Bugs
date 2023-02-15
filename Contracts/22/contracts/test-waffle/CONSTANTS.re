let floatIssuanceFixedDecimal =
  Ethers.BigNumber.fromUnsafe("1000000000000000000000000000000000000000000");
let tenToThe18 = Ethers.BigNumber.fromUnsafe("1000000000000000000");
let zeroBn = Ethers.BigNumber.fromInt(0);
let oneBn = Ethers.BigNumber.fromInt(1);
let twoBn = Ethers.BigNumber.fromInt(2);
let longTokenType = 0;
let shortTokenType = 1;

let zeroAddressStr = "0x0000000000000000000000000000000000000000";
let zeroAddress = Ethers.Utils.getAddressUnsafe(zeroAddressStr);
