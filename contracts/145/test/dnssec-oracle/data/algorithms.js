module.exports = [
  [
    'RSASHA1Algorithm',
    // This test vector generated from the zone using the following Python script:
    // import dns.rrset
    //
    // dnskey = dns.rrset.from_text("org.", 900, "IN", "DNSKEY", "256 3 7 AwEAAXxsMmN/JgpEE9Y4uFNRJm7Q9GBwmEYUCsCxuKlgBU9WrQEFRrvAeMamUBeX4SE8s3V/TEk/TgGmPPp0pMkKD7mseluK6Ard2HZ6O3nPAzL4i8py/UDRUmYNSCxwfdfjUWRmcB9H+NKWMsJoDhAkLFqg5HS7f0j4Vb99Wac24Fk7")
    //
    // soa = dns.rrset.from_text("org.", 900, "IN", "SOA", "a0.org.afilias-nst.info. noc.afilias-nst.info. 2012953483 1800 900 604800 86400")
    // buf = StringIO()
    // soa.to_wire(buf)
    //
    // rrsig = dns.rrset.from_text("www.example.net.", 900, "IN", "RRSIG", "SOA 7 1 900 20180511092623 20180420082623 1862 org. NNyzNfXm72KiOuKvkd/s57kw4bYTX0xh4QBBca36MbYOl7SoqojQOfrUQmVj6/khTAOh2Ywx/S/2CKRQEhavsdBLKT29TlD5ahyzDHQu1hwvS6ZAqXgaPqeiXJiJodEUFkeCRWpp43iuqwh55mz6EeGqpX7vUpQ3DCDgfa3lo18=")
    //
    // signature = rrsig[0].signature
    // rrsig[0].signature = ''
    // signdata = rrsig[0].to_digestable() + buf.getvalue()
    //
    // print ('0x' + dnskey[0].to_digestable().encode('hex'), '0x' + signdata.encode('hex'), signature.encode('hex'))
    [
      // org.			705	IN	DNSKEY	256 3 7 AwEAAXxsMmN/JgpEE9Y4uFNRJm7Q9GBwmEYUCsCxuKlgBU9WrQEFRrvA eMamUBeX4SE8s3V/TEk/TgGmPPp0pMkKD7mseluK6Ard2HZ6O3nPAzL4 i8py/UDRUmYNSCxwfdfjUWRmcB9H+NKWMsJoDhAkLFqg5HS7f0j4Vb99 Wac24Fk7
      '0x01000307030100017c6c32637f260a4413d638b85351266ed0f460709846140ac0b1b8a960054f56ad010546bbc078c6a6501797e1213cb3757f4c493f4e01a63cfa74a4c90a0fb9ac7a5b8ae80addd8767a3b79cf0332f88bca72fd40d152660d482c707dd7e3516466701f47f8d29632c2680e10242c5aa0e474bb7f48f855bf7d59a736e0593b',
      // org.			39	IN	SOA	a0.org.afilias-nst.info. noc.afilias-nst.info. 2012953483 1800 900 604800 86400
      '0x00060701000003845af561bf5ad9a42f0746036f726700036f72670000060001000003840043026130036f72670b6166696c6961732d6e737404696e666f00036e6f630b6166696c6961732d6e737404696e666f0077fb3b8b000007080000038400093a8000015180',
      // org.			39	IN	RRSIG	SOA 7 1 900 20180511092623 20180420082623 1862 org. NNyzNfXm72KiOuKvkd/s57kw4bYTX0xh4QBBca36MbYOl7SoqojQOfrU QmVj6/khTAOh2Ywx/S/2CKRQEhavsdBLKT29TlD5ahyzDHQu1hwvS6ZA qXgaPqeiXJiJodEUFkeCRWpp43iuqwh55mz6EeGqpX7vUpQ3DCDgfa3l o18=
      '0x34dcb335f5e6ef62a23ae2af91dfece7b930e1b6135f4c61e1004171adfa31b60e97b4a8aa88d039fad4426563ebf9214c03a1d98c31fd2ff608a4501216afb1d04b293dbd4e50f96a1cb30c742ed61c2f4ba640a9781a3ea7a25c9889a1d114164782456a69e378aeab0879e66cfa11e1aaa57eef5294370c20e07dade5a35f'
    ]
  ],
  [
    'RSASHA256Algorithm',
    // This test vector generated from the example in RFC5702 using the following Python script:
    // import dns.rrset
    //
    // dnskey = dns.rrset.from_text("example.net.", 3600, "IN", "DNSKEY", "256 3 8 AwEAAcFcGsaxxdgiuuGmCkVImy4h99CqT7jwY3pexPGcnUFtR2Fh36BponcwtkZ4cAgtvd4Qs8PkxUdp6p/DlUmObdk=")
    //
    // a = dns.rrset.from_text("www.example.net.", 3600, "IN", "A", "192.0.2.91")
    // buf = StringIO()
    // a.to_wire(buf)
    //
    // rrsig = dns.rrset.from_text("www.example.net.", 3600, "IN", "RRSIG", "A 8 3 3600 20300101000000 20000101000000 9033 example.net. kRCOH6u7l0QGy9qpC9l1sLncJcOKFLJ7GhiUOibu4teYp5VE9RncriShZNz85mwlMgNEacFYK/lPtPiVYP4bwg==")
    // signature = rrsig[0].signature
    // rrsig[0].signature = ''
    // signdata = rrsig[0].to_digestable() + buf.getvalue()
    //
    // print ('0x' + dnskey[0].to_digestable().encode('hex'), '0x' + signdata.encode('hex'), signature.encode('hex'))
    [
      // example.net.     3600  IN  DNSKEY  (256 3 8 AwEAAcFcGsaxxdgiuuGmCkVI
      //                  my4h99CqT7jwY3pexPGcnUFtR2Fh36BponcwtkZ4cAgtvd4Qs8P
      //                  kxUdp6p/DlUmObdk= );{id = 9033 (zsk), size = 512b}
      '0x0100030803010001c15c1ac6b1c5d822bae1a60a45489b2e21f7d0aa4fb8f0637a5ec4f19c9d416d476161dfa069a27730b6467870082dbdde10b3c3e4c54769ea9fc395498e6dd9',
      // www.example.net. 3600  IN  A  192.0.2.91
      '0x0001080300000e1070dbd880386d43802349076578616d706c65036e65740003777777076578616d706c65036e6574000001000100000e100004c000025b',
      // www.example.net. 3600  IN  RRSIG  (A 8 3 3600 20300101000000
      //               20000101000000 9033 example.net. kRCOH6u7l0QGy9qpC9
      //               l1sLncJcOKFLJ7GhiUOibu4teYp5VE9RncriShZNz85mwlMgNEa
      //               cFYK/lPtPiVYP4bwg==);{id = 9033}
      '0x91108e1fabbb974406cbdaa90bd975b0b9dc25c38a14b27b1a18943a26eee2d798a79544f519dcae24a164dcfce66c2532034469c1582bf94fb4f89560fe1bc2'
    ]
  ],
  [
    'P256SHA256Algorithm',
    // This test vector generated from the example in RFC6605 using the following Python script:
    // from StringIO import StringIO
    // import dns.rrset
    //
    // dnskey = dns.rrset.from_text("example.net.", 3600, "IN", "DNSKEY", "257 3 13 GojIhhXUN/u4v54ZQqGSnyhWJwaubCvTmeexv7bR6edbkrSqQpF64cYbcB7wNcP+e+MAnLr+Wi9xMWyQLc8NAA==")
    //
    // a = dns.rrset.from_text("www.example.net.", 3600, "IN", "A", "192.0.2.1")
    // buf = StringIO()
    // a.to_wire(buf)
    //
    // rrsig = dns.rrset.from_text("www.example.net.", 3600, "IN", "RRSIG", "A 13 3 3600 20100909100439 20100812100439 55648 example.net. qx6wLYqmh+l9oCKTN6qIc+bw6ya+KJ8oMz0YP107epXAyGmt+3SNruPFKG7tZoLBLlUzGGus7ZwmwWep666VCw==")
    // signature = rrsig[0].signature
    // rrsig[0].signature = ''
    // signdata = rrsig[0].to_digestable() + buf.getvalue()
    //
    // print ('0x' + dnskey[0].to_digestable().encode('hex'), '0x' + signdata.encode('hex'), signature.encode('hex'))
    [
      // example.net. 3600 IN DNSKEY 257 3 13 (
      //         GojIhhXUN/u4v54ZQqGSnyhWJwaubCvTmeexv7bR6edb
      //         krSqQpF64cYbcB7wNcP+e+MAnLr+Wi9xMWyQLc8NAA== )
      '0x0101030d1a88c88615d437fbb8bf9e1942a1929f28562706ae6c2bd399e7b1bfb6d1e9e75b92b4aa42917ae1c61b701ef035c3fe7be3009cbafe5a2f71316c902dcf0d00',
      // www.example.net. 3600 IN A 192.0.2.1
      '0x00010d0300000e104c88b1374c63c737d960076578616d706c65036e65740003777777076578616d706c65036e6574000001000100000e100004c0000201',
      //  www.example.net. 3600 IN RRSIG A 13 3 3600 (
      //               20100909100439 20100812100439 55648 example.net.
      //               qx6wLYqmh+l9oCKTN6qIc+bw6ya+KJ8oMz0YP107epXA
      //               yGmt+3SNruPFKG7tZoLBLlUzGGus7ZwmwWep666VCw== )
      '0xab1eb02d8aa687e97da0229337aa8873e6f0eb26be289f28333d183f5d3b7a95c0c869adfb748daee3c5286eed6682c12e5533186baced9c26c167a9ebae950b'
    ]
  ]
];
