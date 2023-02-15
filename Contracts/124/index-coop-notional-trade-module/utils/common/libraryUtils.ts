import { utils } from "ethers";
import path from "path";

// Converts a fully qualified contract name in a bytecode link id.
// (A fully qualified name looks like: `contracts/mocks/LibraryMock.sol:LibraryMock`)
export function convertLibraryNameToLinkId(libraryName: string): string {
  if (!(libraryName.includes(path.sep) && libraryName.includes(":"))) {
    throw new Error(
      "Converting library name to link id requires a fully qualified " +
      "contract name. Example: `contracts/mocks/LibraryMock.sol:LibraryMock`"
    );
  }

  const hashedName = utils.keccak256(utils.toUtf8Bytes(libraryName));
  return `__$${hashedName.slice(2).slice(0, 34)}$__`;
}
