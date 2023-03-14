module.exports = [
  {
    digest: 'SHA256Digest',
    valids: [
      [
        '',
        '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      ], // valid 1
      [
        'foo',
        '0x2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
      ], // valid 2
    ],
    invalids: [
      ['', '0x1111111111111111111111111111111111111111111111111111111111111111'], // invalid
    ],
    errors: [
      [
        'foo',
        '0x2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae00'
      ], // junk at end of digest
    ],
  },
  {
    digest: 'SHA1Digest',
    valids: [
      ['', '0xda39a3ee5e6b4b0d3255bfef95601890afd80709'], // valid 1
      ['foo', '0x0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33'], // valid 2
    ],
    invalids: [
      ['', '0x1111111111111111111111111111111111111111'], // invalid
    ],
    errors: [
      ['foo', '0x0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a3300'], // junk at end of digest
    ],
  }
];
