import { ethers, providers } from "ethers";

export const privateKeys = [
  "0xf2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d",
  "0x5d862464fe9303452126c8bc94274b8c5f9874cbd219789b3eb2128075a76f72",
  "0xdf02719c4df8b9b8ac7f551fcb5d9ef48fa27eef7a66453879f4d8fdc6e78fb1",
  "0xff12e391b79415e941a94de3bf3a9aee577aed0731e297d5cfa0b8a1e02fa1d0",
  "0x752dd9cf65e68cfaba7d60225cbdbc1f4729dd5e5507def72815ed0d8abc6249",
  "0xefb595a0178eb79a8df953f87c5148402a224cdf725e88c0146727c6aceadccd",
  "0x83c6d2cc5ddcf9711a6d59b417dc20eb48afd58d45290099e5987e3d768f328f",
  "0xbb2d3f7c9583780a7d3904a2f55d792707c345f21de1bacb2d389934d82796b2",
  "0xb2fd4d29c1390b71b8795ae81196bfd60293adf99f9d32a0aff06288fcdac55f",
];

export function generatedWallets(provider: providers.Provider) {
  return privateKeys.map((key: string) => {
    return new ethers.Wallet(key, provider);
  });
}
