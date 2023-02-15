// cribbed from @zoltu/rlp-encoder
export type RlpItem = Uint8Array | ReadonlyArray<RlpItem>;

export function rlpEncode(item: RlpItem): Uint8Array {
  if (item instanceof Uint8Array) {
    return rlpEncodeItem(item);
  } else if (Array.isArray(item)) {
    return rlpEncodeList(item);
  } else {
    throw new Error(
      `Can only RLP encode Uint8Arrays (items) and arrays (lists).  Please encode your item into a Uint8Array first.\nType: ${typeof item}\n${item}`,
    );
  }
}

function rlpEncodeItem(data: Uint8Array): Uint8Array {
  if (data.length === 1 && data[0] < 0x80) return rlpEncodeTiny(data);
  else if (data.length <= 55) return rlpEncodeSmall(data);
  else return rlpEncodeLarge(data);
}

function rlpEncodeList(items: ReadonlyArray<RlpItem>): Uint8Array {
  const encodedItems = items.map(rlpEncode);
  const encodedItemsLength = encodedItems.reduce(
    (total, item) => total + item.length,
    0,
  );
  if (encodedItemsLength <= 55) {
    const result = new Uint8Array(encodedItemsLength + 1);
    result[0] = 0xc0 + encodedItemsLength;
    let offset = 1;
    for (let encodedItem of encodedItems) {
      result.set(encodedItem, offset);
      offset += encodedItem.length;
    }
    return result;
  } else {
    const lengthBytes = hexStringToUint8Array(encodedItemsLength.toString(16));
    const result = new Uint8Array(1 + lengthBytes.length + encodedItemsLength);
    result[0] = 0xf7 + lengthBytes.length;
    result.set(lengthBytes, 1);
    let offset = 1 + lengthBytes.length;
    for (let encodedItem of encodedItems) {
      result.set(encodedItem, offset);
      offset += encodedItem.length;
    }
    return result;
  }
}

function rlpEncodeTiny(data: Uint8Array): Uint8Array {
  if (data.length > 1)
    throw new Error(`rlpEncodeTiny can only encode single byte values.`);
  if (data[0] > 0x80)
    throw new Error(`rlpEncodeTiny can only encode values less than 0x80`);
  return data;
}

function rlpEncodeSmall(data: Uint8Array): Uint8Array {
  if (data.length === 1 && data[0] < 0x80)
    throw new Error(`rlpEncodeSmall can only encode a value > 0x7f`);
  if (data.length > 55)
    throw new Error(
      `rlpEncodeSmall can only encode data that is <= 55 bytes long`,
    );
  const result = new Uint8Array(data.length + 1);
  result[0] = 0x80 + data.length;
  result.set(data, 1);
  return result;
}

function rlpEncodeLarge(data: Uint8Array): Uint8Array {
  if (data.length <= 55)
    throw new Error(
      `rlpEncodeLarge can only encode data that is > 55 bytes long`,
    );
  const lengthBytes = hexStringToUint8Array(data.length.toString(16));
  const result = new Uint8Array(data.length + lengthBytes.length + 1);
  result[0] = 0xb7 + lengthBytes.length;
  result.set(lengthBytes, 1);
  result.set(data, 1 + lengthBytes.length);
  return result;
}

function hexStringToUint8Array(hex: string): Uint8Array {
  const match = new RegExp(`^(?:0x)?([a-fA-F0-9]*)$`).exec(hex);
  if (match === null)
    throw new Error(
      `Expected a hex string encoded byte array with an optional '0x' prefix but received ${hex}`,
    );
  const maybeLeadingZero = match[1].length % 2 ? '0' : '';
  const normalized = `${maybeLeadingZero}${match[1]}`;
  const byteLength = normalized.length / 2;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; ++i) {
    bytes[i] = Number.parseInt(
      `${normalized[i * 2]}${normalized[i * 2 + 1]}`,
      16,
    );
  }
  return bytes;
}

export function rlpDecode(data: Uint8Array): RlpItem {
  return rlpDecodeItem(data).decoded;
}

function rlpDecodeItem(data: Uint8Array): {
  decoded: RlpItem;
  consumed: number;
} {
  if (data.length === 0)
    throw new Error(`Cannot RLP decode a 0-length byte array.`);
  if (data[0] <= 0x7f) {
    const consumed = 1;
    const decoded = data.slice(0, consumed);
    return { decoded, consumed };
  } else if (data[0] <= 0xb7) {
    const byteLength = data[0] - 0x80;
    if (byteLength > data.length - 1)
      throw new Error(
        `Encoded data length (${byteLength}) is larger than remaining data (${
          data.length - 1
        }).`,
      );
    const consumed = 1 + byteLength;
    const decoded = data.slice(1, consumed);
    if (byteLength === 1 && decoded[0] <= 0x7f)
      throw new Error(
        `A tiny value (${decoded[0].toString(
          16,
        )}) was found encoded as a small value (> 0x7f).`,
      );
    return { decoded, consumed };
  } else if (data[0] <= 0xbf) {
    const lengthBytesLength = data[0] - 0xb7;
    if (lengthBytesLength > data.length - 1)
      throw new Error(
        `Encoded length of data length (${lengthBytesLength}) is larger than the remaining data (${
          data.length - 1
        })`,
      );
    // the conversion to Number here is lossy, but we throw on the following line in that case so "meh"
    const length = decodeLength(data, 1, lengthBytesLength);
    if (length > data.length - 1 - lengthBytesLength)
      throw new Error(
        `Encoded data length (${length}) is larger than the remaining data (${
          data.length - 1 - lengthBytesLength
        })`,
      );
    const consumed = 1 + lengthBytesLength + length;
    const decoded = data.slice(1 + lengthBytesLength, consumed);
    if (length <= 0x37)
      throw new Error(
        `A small value (<= 55 bytes) was found encoded in a large value (> 55 bytes)`,
      );
    return { decoded, consumed };
  } else if (data[0] <= 0xf7) {
    const length = data[0] - 0xc0;
    if (length > data.length - 1)
      throw new Error(
        `Encoded array length (${length}) is larger than remaining data (${
          data.length - 1
        }).`,
      );
    let offset = 1;
    const results = [];
    while (offset !== length + 1) {
      const { decoded, consumed } = rlpDecodeItem(data.slice(offset));
      results.push(decoded);
      offset += consumed;
      if (offset > length + 1)
        throw new Error(
          `Encoded array length (${length}) doesn't align with the sum of the lengths of the encoded elements (${offset})`,
        );
    }
    return { decoded: results, consumed: offset };
  } else {
    const lengthBytesLength = data[0] - 0xf7;
    // the conversion to Number here is lossy, but we throw on the following line in that case so "meh"
    const length = decodeLength(data, 1, lengthBytesLength);
    if (length > data.length - 1 - lengthBytesLength)
      throw new Error(
        `Encoded array length (${length}) is larger than the remaining data (${
          data.length - 1 - lengthBytesLength
        })`,
      );
    let offset = 1 + lengthBytesLength;
    const results = [];
    while (offset !== length + 1 + lengthBytesLength) {
      const { decoded, consumed } = rlpDecodeItem(data.slice(offset));
      results.push(decoded);
      offset += consumed;
      if (offset > length + 1 + lengthBytesLength)
        throw new Error(
          `Encoded array length (${length}) doesn't align with the sum of the lengths of the encoded elements (${offset})`,
        );
    }
    return { decoded: results, consumed: offset };
  }
}

function decodeLength(
  data: Uint8Array,
  offset: number,
  lengthBytesLength: number,
): number {
  const lengthBytes = data.slice(offset, offset + lengthBytesLength);
  let length = 0;
  if (lengthBytes.length >= 1) length = lengthBytes[0];
  if (lengthBytes.length >= 2) length = (length << 8) | lengthBytes[1];
  if (lengthBytes.length >= 3) length = (length << 8) | lengthBytes[2];
  if (lengthBytes.length >= 4) length = (length << 8) | lengthBytes[3];
  if (lengthBytes.length >= 5)
    throw new Error(
      `Unable to decode RLP item or array with a length larger than 2**32`,
    );
  return length;
}
