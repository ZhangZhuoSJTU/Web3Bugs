export function addressToString(value: bigint) {
  return `0x${value.toString(16).padStart(40, '0')}`;
}

export function stripLeadingZeros(byteArray: Uint8Array): Uint8Array {
  let i = 0;
  for (; i < byteArray.length; ++i) {
    if (byteArray[i] !== 0) break;
  }
  const result = new Uint8Array(byteArray.length - i);
  for (let j = 0; j < result.length; ++j) {
    result[j] = byteArray[i + j];
  }
  return result;
}

export function unsignedIntegerToUint8Array(
  value: bigint | number,
  widthInBytes: 8 | 20 | 32 | 256 = 32,
) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value))
      throw new Error(`${value} is not able to safely be cast into a bigint.`);
    value = BigInt(value);
  }
  if (value >= 2n ** (BigInt(widthInBytes) * 8n) || value < 0n)
    throw new Error(
      `Cannot fit ${value} into a ${widthInBytes * 8}-bit unsigned integer.`,
    );
  const result = new Uint8Array(widthInBytes);
  if (result.length !== widthInBytes)
    throw new Error(
      `Cannot a ${widthInBytes} value into a ${result.length} byte array.`,
    );
  for (let i = 0; i < result.length; ++i) {
    result[i] = Number(
      (BigInt(value) >>
        BigInt(BigInt(widthInBytes - i) * BigInt(8) - BigInt(8))) &
        0xffn,
    );
  }
  return result;
}
