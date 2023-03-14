var base32hex = require('rfc4648').base32hex
const anchors = require('../test-utils/anchors.js')
const packet = require('dns-packet')
const types = require('dns-packet/types')
const { expectRevert } = require('@openzeppelin/test-helpers')
const { rootKeys, hexEncodeSignedSet, hexEncodeName } = require('../utils/dnsutils.js')

var dnssec = artifacts.require('./DNSSECImpl')
const SignedSet = require('@ensdomains/dnsprovejs').SignedSet

const util = require('util')
const { expect } = require('chai')
web3.currentProvider.send = util.promisify(web3.currentProvider.send)

const test_rrset_timestamp = 1552658805;

// When the real test start failing due to ttl expiration, you can generate the new test dataset at https://dnssec.ens.domains/?domain=ethlab.xyz&mode=advanced
const test_rrsets = [
  // .	55430	IN	RRSIG	DNSKEY 8 0 172800 20190402000000 20190312000000 20326 . A76nZ8WVsD+pLAKJh9ujKxxRDWfJf8SxayOkq3Gq9TX4BStpQM1e/KuX8am4FrVRCGQvLlhiYFNqm+PtevGGJAO0lTFLSiIuavknlkSiI3HMkrMDqSV+YlIQPk1C720khNpWy70WjjNvkq4sBU1GTkVPeFkM3gQI53pCHW+VobCPXZz70J+PnSOq7SmjrwXgU8E9iSXkI3yfhGIup2c54Sf9w0Bw10opvxXMT+1ALgWY1TnV1/gRixIUZp1K86iR8VeX9K/4UTqEa5bYux+aeIcQ2/4Qqyo3Ocb2RrbUvDNzU2lB4b1r/oHqsd6C0SiGmdo0A8R44djKMHVaD/JmLg==
  // .	55430	IN	DNSKEY	256 3 8 AwEAAcH+axCdUOsTc9o+jmyVq5rsGTh1EcatSumPqEfsPBT+whyj0/UhD7cWeixV9Wqzj/cnqs8iWELqhdzGX41ZtaNQUfWNfOriASnWmX2D9m/EunplHu8nMSlDnDcT7+llE9tjk5HI1Sr7d9N16ZTIrbVALf65VB2ABbBG39dyAb7tz21PICJbSp2cd77UF7NFqEVkqohl/LkDw+7Apalmp0qAQT1Mgwi2cVxZMKUiciA6EqS+KNajf0A6olO2oEhZnGGY6b1LTg34/YfHdiIIZQqAfqbieruCGHRiSscC2ZE7iNreL/76f4JyIEUNkt6bQA29JsegxorLzQkpF7NKqZc=
  // .	55430	IN	DNSKEY	257 3 8 AwEAAaz/tAm8yTn4Mfeh5eyI96WSVexTBAvkMgJzkKTOiW1vkIbzxeF3+/4RgWOq7HrxRixHlFlExOLAJr5emLvN7SWXgnLh4+B5xQlNVz8Og8kvArMtNROxVQuCaSnIDdD5LKyWbRd2n9WGe2R8PzgCmr3EgVLrjyBxWezF0jLHwVN8efS3rCj/EWgvIWgb9tarpVUDK/b58Da+sqqls3eNbuv7pr+eoZG+SrDK6nWeL3c6H5Apxz7LjVc1uTIdsIXxuOLYA4/ilBmSVIzuDWfdRUfhHdY6+cn8HFRm+2hM8AnXGXws9555KrUB5qihylGa8subX2Nn6UwNR1AkUTV74bU=
  // .	55430	IN	DNSKEY	385 3 8 AwEAAagAIKlVZrpC6Ia7gEzahOR+9W29euxhJhVVLOyQbSEW0O8gcCjFFVQUTf6v58fLjwBd0YI0EzrAcQqBGCzh/RStIoO8g0NfnfL2MTJRkxoXbfDaUeVPQuYEhg37NZWAJQ9VnMVDxP/VHL496M/QZxkjf5/Efucp2gaDX6RS6CXpoY68LsvPVjR0ZSwzz1apAzvN9dlzEheX7ICJBBtuA6G3LQpzW5hOA2hzCTMjJPJ8LbqF6dsV6DoBQzgul0sGIcGOYl7OyQdXfZ57relSQageu+ipAdTTJ25AsRTAoub8ONGcLmqrAmRLKBP1dfwhYB4N7knNnulqQxA+Uk1ihz0=
  [
    web3.utils.toHex('.'),
    '0x003008000002a3005ca2a6005c86f6804f660000003000010002a30001080100030803010001c1fe6b109d50eb1373da3e8e6c95ab9aec19387511c6ad4ae98fa847ec3c14fec21ca3d3f5210fb7167a2c55f56ab38ff727aacf225842ea85dcc65f8d59b5a35051f58d7ceae20129d6997d83f66fc4ba7a651eef273129439c3713efe96513db639391c8d52afb77d375e994c8adb5402dfeb9541d8005b046dfd77201beedcf6d4f20225b4a9d9c77bed417b345a84564aa8865fcb903c3eec0a5a966a74a80413d4c8308b6715c5930a52272203a12a4be28d6a37f403aa253b6a048599c6198e9bd4b4e0df8fd87c7762208650a807ea6e27abb821874624ac702d9913b88dade2ffefa7f827220450d92de9b400dbd26c7a0c68acbcd092917b34aa99700003000010002a30001080101030803010001acffb409bcc939f831f7a1e5ec88f7a59255ec53040be432027390a4ce896d6f9086f3c5e177fbfe118163aaec7af1462c47945944c4e2c026be5e98bbcded25978272e1e3e079c5094d573f0e83c92f02b32d3513b1550b826929c80dd0f92cac966d17769fd5867b647c3f38029abdc48152eb8f207159ecc5d232c7c1537c79f4b7ac28ff11682f21681bf6d6aba555032bf6f9f036beb2aaa5b3778d6eebfba6bf9ea191be4ab0caea759e2f773a1f9029c73ecb8d5735b9321db085f1b8e2d8038fe2941992548cee0d67dd4547e11dd63af9c9fc1c5466fb684cf009d7197c2cf79e792ab501e6a8a1ca519af2cb9b5f6367e94c0d47502451357be1b500003000010002a30001080181030803010001a80020a95566ba42e886bb804cda84e47ef56dbd7aec612615552cec906d2116d0ef207028c51554144dfeafe7c7cb8f005dd18234133ac0710a81182ce1fd14ad2283bc83435f9df2f6313251931a176df0da51e54f42e604860dfb359580250f559cc543c4ffd51cbe3de8cfd06719237f9fc47ee729da06835fa452e825e9a18ebc2ecbcf563474652c33cf56a9033bcdf5d973121797ec8089041b6e03a1b72d0a735b984e03687309332324f27c2dba85e9db15e83a0143382e974b0621c18e625ecec907577d9e7bade95241a81ebbe8a901d4d3276e40b114c0a2e6fc38d19c2e6aab02644b2813f575fc21601e0dee49cd9ee96a43103e524d62873d',
    '0x03bea767c595b03fa92c028987dba32b1c510d67c97fc4b16b23a4ab71aaf535f8052b6940cd5efcab97f1a9b816b55108642f2e586260536a9be3ed7af1862403b495314b4a222e6af9279644a22371cc92b303a9257e6252103e4d42ef6d2484da56cbbd168e336f92ae2c054d464e454f78590cde0408e77a421d6f95a1b08f5d9cfbd09f8f9d23aaed29a3af05e053c13d8925e4237c9f84622ea76739e127fdc34070d74a29bf15cc4fed402e0598d539d5d7f8118b1214669d4af3a891f15797f4aff8513a846b96d8bb1f9a788710dbfe10ab2a3739c6f646b6d4bc3373536941e1bd6bfe81eab1de82d1288699da3403c478e1d8ca30755a0ff2662e',
  ],

  // xyz.	75722	IN	RRSIG	DS 8 1 86400 20190326170000 20190313160000 16749 . b8+qL5kCQQ1cXJ3WtMffVlB9DhDYjcaJLq3YMU7JKfBUO9NDiSPWx2ugrWsXdgzr+ZCmnYJ3kcFK0kqhq/hklCKai16f+XxRlw/TLRG1O1pgBt5zyb3eklEwqqJkeq2sx4n74i5zPArNsIOdkDtqreBza2cWAEyBrfCgyVmoMIjqXgM7Nc7hEGueHJ/qxCcDKGB5hzuvzgl1Nhj8FpuLOEC0SsrEULrOytTVwas/H3aoQtdWoAiKnU1Dr0VtdxtdMl1kZcZZQmLvJHlsZC8YaF8ur+d+N7SP6MMTNyWv1II0OMrznnkbYC+h/p+3l1oZjWW0CPD4KaTmoXhYxiFt4w==
  // xyz.	75722	IN	DS	3599 8 1 3FA3B264F45DB5F38BEDEAF1A88B76AA318C2C7F
  // xyz.	75722	IN	DS	3599 8 2 B9733869BC84C86BB59D102BA5DA6B27B2088552332A39DCD54BC4E8D66B0499
  [
    web3.utils.toHex('xyz.'),
    '0x002b0801000151805c9a5a905c892900416d000378797a00002b00010001518000180e0f08013fa3b264f45db5f38bedeaf1a88b76aa318c2c7f0378797a00002b00010001518000240e0f0802b9733869bc84c86bb59d102ba5da6b27b2088552332a39dcd54bc4e8d66b0499',
    '0x6fcfaa2f9902410d5c5c9dd6b4c7df56507d0e10d88dc6892eadd8314ec929f0543bd3438923d6c76ba0ad6b17760cebf990a69d827791c14ad24aa1abf86494229a8b5e9ff97c51970fd32d11b53b5a6006de73c9bdde925130aaa2647aadacc789fbe22e733c0acdb0839d903b6aade0736b6716004c81adf0a0c959a83088ea5e033b35cee1106b9e1c9feac42703286079873bafce09753618fc169b8b3840b44acac450bacecad4d5c1ab3f1f76a842d756a0088a9d4d43af456d771b5d325d6465c6594262ef24796c642f18685f2eafe77e37b48fe8c3133725afd4823438caf39e791b602fa1fe9fb7975a198d65b408f0f829a4e6a17858c6216de3',
  ],

  // xyz.	3599	IN	RRSIG	DNSKEY 8 1 3600 20190410030245 20190310213458 3599 xyz. IDV9fvByi5DC37UAe7gYuxJDjo6nAoz58e4EmeCFsX1RjjLjmOR2juGv80AY5rDRZq1F8hCGcCL0JpgCm3m/I/r6CkqRhFMRDCQmjv3X4otEGeIDPSyiTDA9wkiH01IqtozMrff/Px2jwnRojP7xqIF79ySX1mjHTAX0LsdoJiUNA7WYlyT6F3QrrlghgyHR01RcozY4/bGKGL5Ko7FW3Aul1NOhFHBTIkaCCWbKJrXCNg0fkRPfFS8IUxxmDghf8SvCe8E9CjE9K283gUy/SVaqe4uwcph71Uer0fDTdqPHdEQ1SNZwXC3wd+hwTbkAra/an3My9twMW5Gzcc1kYA==
  // xyz.	3599	IN	DNSKEY	257 3 8 AwEAAbYRTzkgLg4oxcFb/+oFQMvluEut45siTtLiNL7t5Fim/ZnYhkxal6TiCUywnfgiycJyneNmtC/3eoTcz5dlrlRB5dwDehcqiZoFiqjaXGHcykHGFBDynD0/sRcEAQL+bLMv2qA+o2L7pDPHbCGJVXlUq57oTWfS4esbGDIa+1Bs8gDVMGUZcbRmeeKkc/MH2Oq1ApE5EKjH0ZRvYWS6afsWyvlXD2NXDthS5LltVKqqjhi6dy2O02stOt41z1qwfRlU89b3HXfDghlJ/L33DE+OcTyK0yRJ+ay4WpBgQJL8GDFKz1hnR2lOjYXLttJD7aHfcYyVO6zYsx2aeHI0OYM=
  // xyz.	3599	IN	DNSKEY	256 3 8 AwEAAdkudvbXI30VVqraORIz7iVP4GX5jLvYI1vk1f8JJnvLNW9Gnsd8W4jne3PrkIIgoBeHJG1GC+5zo4Deusc8KVbQNjfL3TnuQF5iS8tkqnyqEUqHt2Rm+JHglrX0eIqftBjegf0WBTCVJIE/KqiC/X2EXr83/sAmrF5SchoEM2gx
  // xyz.	3599	IN	DNSKEY	256 3 8 AwEAAa5jh93mWraaokFC83dqjRLypC8KijEI9DpGCL9epWGcZoEg2QpFRNaJuYjxASKjqF04TXZFOPLgSLMS6fPy6Cx4cBy4K392cbHBJafUnAecmHd4WJauED8q5OU+AnZbD07J424L9CszIXKFBBIeUXyNVhSgFszjZevNRie/Jk3v
  [
    web3.utils.toHex('xyz.'),
    '0x0030080100000e105cad5cd55c8583020e0f0378797a000378797a000030000100000e1000880100030803010001ae6387dde65ab69aa24142f3776a8d12f2a42f0a8a3108f43a4608bf5ea5619c668120d90a4544d689b988f10122a3a85d384d764538f2e048b312e9f3f2e82c78701cb82b7f7671b1c125a7d49c079c9877785896ae103f2ae4e53e02765b0f4ec9e36e0bf42b3321728504121e517c8d5614a016cce365ebcd4627bf264def0378797a000030000100000e1000880100030803010001d92e76f6d7237d1556aada391233ee254fe065f98cbbd8235be4d5ff09267bcb356f469ec77c5b88e77b73eb908220a01787246d460bee73a380debac73c2956d03637cbdd39ee405e624bcb64aa7caa114a87b76466f891e096b5f4788a9fb418de81fd1605309524813f2aa882fd7d845ebf37fec026ac5e52721a043368310378797a000030000100000e1001080101030803010001b6114f39202e0e28c5c15bffea0540cbe5b84bade39b224ed2e234beede458a6fd99d8864c5a97a4e2094cb09df822c9c2729de366b42ff77a84dccf9765ae5441e5dc037a172a899a058aa8da5c61dcca41c61410f29c3d3fb117040102fe6cb32fdaa03ea362fba433c76c2189557954ab9ee84d67d2e1eb1b18321afb506cf200d530651971b46679e2a473f307d8eab502913910a8c7d1946f6164ba69fb16caf9570f63570ed852e4b96d54aaaa8e18ba772d8ed36b2d3ade35cf5ab07d1954f3d6f71d77c3821949fcbdf70c4f8e713c8ad32449f9acb85a90604092fc18314acf586747694e8d85cbb6d243eda1df718c953bacd8b31d9a7872343983',
    '0x20357d7ef0728b90c2dfb5007bb818bb12438e8ea7028cf9f1ee0499e085b17d518e32e398e4768ee1aff34018e6b0d166ad45f210867022f42698029b79bf23fafa0a4a918453110c24268efdd7e28b4419e2033d2ca24c303dc24887d3522ab68cccadf7ff3f1da3c274688cfef1a8817bf72497d668c74c05f42ec76826250d03b5989724fa17742bae58218321d1d3545ca33638fdb18a18be4aa3b156dc0ba5d4d3a11470532246820966ca26b5c2360d1f9113df152f08531c660e085ff12bc27bc13d0a313d2b6f37814cbf4956aa7b8bb072987bd547abd1f0d376a3c774443548d6705c2df077e8704db900adafda9f7332f6dc0c5b91b371cd6460',
  ],

  // ethlab.xyz.	3599	IN	RRSIG	DS 8 2 3600 20190412084119 20190313062929 53709 xyz. QYtNoU4SsRpKcSeH1UUJNwJAADRW+LNx4an35z25tb+Cw0y51sKP/2FS8gD47XReZ5mmYE1E6DWLmPbizPOAUibfLZad+zKjRyrGm59rbeSetLdDD1zKw7Wa5CB2a+wFi0AVGwO0pMqxE/N2E1SEPbPUdsroMGTgBxBf/ON0YL4=
  // ethlab.xyz.	3599	IN	DS	42999 8 2 954C021A38E5731EBAAA95323FB7C472A866CE4D86AE3AD8605843B722B62213
  // ethlab.xyz.	3599	IN	DS	60820 8 2 D1CDCF8E905ED06FEC438A63C69A34D2F4871B1F4869BBB852859892E693CAED
  [
    web3.utils.toHex('ethlab.xyz.'),
    '0x002b080200000e105cb04f2f5c88a349d1cd0378797a00066574686c61620378797a00002b000100000e100024a7f70802954c021a38e5731ebaaa95323fb7c472a866ce4d86ae3ad8605843b722b62213066574686c61620378797a00002b000100000e100024ed940802d1cdcf8e905ed06fec438a63c69a34d2f4871b1f4869bbb852859892e693caed',
    '0x418b4da14e12b11a4a712787d54509370240003456f8b371e1a9f7e73db9b5bf82c34cb9d6c28fff6152f200f8ed745e6799a6604d44e8358b98f6e2ccf3805226df2d969dfb32a3472ac69b9f6b6de49eb4b7430f5ccac3b59ae420766bec058b40151b03b4a4cab113f3761354843db3d476cae83064e007105ffce37460be',
  ],

  // ethlab.xyz.	3599	IN	RRSIG	DNSKEY 8 2 3600 20340214222653 20190305212653 42999 ethlab.xyz. DIouYhqzqxxN7fAQN8VYCSkXKFzuv1P964uctDaIfk/7BbCePJ3s3omGywNzH0/+Vzwa34AV0thIOphmLFqSQw==
  // ethlab.xyz.	3599	IN	DNSKEY	257 3 8 AwEAAbjW5+pT9WirUzRujl+Haab7lw8NOa7N1FdRjpJ4ICzvOfc1vSYULj2eBIQJq5lys1Bhgs0NXHGsR0UDVok+uu7dic+UlEH8gIAa82yPefJOotD6yCZfqk1cuLX2+RGMHfpVgs4qwQa+PdajYfpw+sjzafGBuwiygycuZe40p4/Azm3E5/9lFsis4z3bXOd5vTdKYv5AWdEgKRdzZIRjIxurKz6G7nXPaxOn4zo4LM/kXxn4KjSLQQxQflr+xxHxda8zJZOY1Pj3iKcMzPtPHUsxbHbcjszmwNrn7sqNpSEPsoAw4+UQCG0FnhwsQxnAo5rE2YxJV1S+BRcAunyEsUE=
  // ethlab.xyz.	3599	IN	DNSKEY	256 3 8 AwEAAdlnRTgge2TmnkenqHAh6YXRNWobwj0r23zHhgLxkN3IB7iAyUulB1L92aS60hHbfYJ1aXjFnF1fhXvAxaAgQN0=
  [
    web3.utils.toHex('ethlab.xyz.'),
    '0x0030080200000e10789d35ad5c7ee99da7f7066574686c61620378797a00066574686c61620378797a000030000100000e1000480100030803010001d9674538207b64e69e47a7a87021e985d1356a1bc23d2bdb7cc78602f190ddc807b880c94ba50752fdd9a4bad211db7d82756978c59c5d5f857bc0c5a02040dd066574686c61620378797a000030000100000e1001080101030803010001b8d6e7ea53f568ab53346e8e5f8769a6fb970f0d39aecdd457518e9278202cef39f735bd26142e3d9e048409ab9972b3506182cd0d5c71ac47450356893ebaeedd89cf949441fc80801af36c8f79f24ea2d0fac8265faa4d5cb8b5f6f9118c1dfa5582ce2ac106be3dd6a361fa70fac8f369f181bb08b283272e65ee34a78fc0ce6dc4e7ff6516c8ace33ddb5ce779bd374a62fe4059d120291773648463231bab2b3e86ee75cf6b13a7e33a382ccfe45f19f82a348b410c507e5afec711f175af33259398d4f8f788a70cccfb4f1d4b316c76dc8ecce6c0dae7eeca8da5210fb28030e3e510086d059e1c2c4319c0a39ac4d98c495754be051700ba7c84b141',
    '0x0c8a2e621ab3ab1c4dedf01037c558092917285ceebf53fdeb8b9cb436887e4ffb05b09e3c9decde8986cb03731f4ffe573c1adf8015d2d8483a98662c5a9243',
  ],

  // _ens.ethlab.xyz.	21599	IN	RRSIG	TXT 8 3 86400 20340214222653 20190305212653 42999 ethlab.xyz. cK9JLb6gBKY7oJi2E+94a0Eii8k4nirIKgginKID3FD7B0lVn6I0499nKzLVCWQtFc3Hnte9JaUrz4GvP3mBTA==
  // _ens.ethlab.xyz.	21599	IN	TXT	"a=0xfdb33f8ac7ce72d7d4795dd8610e323b4c122fbb"
  [
    web3.utils.toHex('_ens.ethlab.xyz.'),
    '0x0010080300015180789d35ad5c7ee99da7f7066574686c61620378797a00045f656e73066574686c61620378797a000010000100015180002d2c613d307866646233336638616337636537326437643437393564643836313065333233623463313232666262',
    '0x70af492dbea004a63ba098b613ef786b41228bc9389e2ac82a08229ca203dc50fb0749559fa234e3df672b32d509642d15cdc79ed7bd25a52bcf81af3f79814c',
  ],
]

async function verifySubmission(instance, rrsets) {
  var response = await instance.verifyRRSet(rrsets);
}

async function verifyFailedSubmission(instance, rrsets) {
  await expectRevert.unspecified(
      instance.verifyRRSet(rrsets)
  );
}

// Test against real record
contract('DNSSEC', (accounts) => {
  it('should accept real DNSSEC records', async function() {
    var instance = await dnssec.deployed()
    var proof = await instance.anchors()
    const totalLen = test_rrsets
      .map(
        ([name, rrset, sig]) => rrset.length / 2 - 1 + (sig.length / 2 - 1) + 4
      )
      .reduce((a, b) => a + b)
    const sets = []
    for (const [name, rrset, sig] of test_rrsets) {
      const rrsetBuf = Buffer.from(rrset.slice(2), 'hex')
      const sigBuf = Buffer.from(sig.slice(2), 'hex')
      sets.push([rrsetBuf, sigBuf])
    }
    var record = await instance.verifyRRSet(sets, test_rrset_timestamp);
    var [_, data, sig] = test_rrsets[test_rrsets.length - 1];
    var expected = SignedSet.fromWire(Buffer.from(data.slice(2), 'hex'), Buffer.from(sig.slice(2), 'hex'));
    expect(record.slice(2)).to.equal(expected.toWire(false).toString('hex'));
  })
})

contract('DNSSEC', function(accounts) {
  let result
  beforeEach(async () => {
    ;({ result } = await web3.currentProvider.send({
      method: 'evm_snapshot',
    }))
  })
  afterEach(async () => {
    await web3.currentProvider.send({
      method: 'evm_revert',
      params: result,
    })
  })

  it('should have a default algorithm and digest set', async function() {
    var instance = await dnssec.deployed()
    assert.notEqual(
      await instance.algorithms(8),
      '0x0000000000000000000000000000000000000000'
    )
    assert.notEqual(
      await instance.algorithms(253),
      '0x0000000000000000000000000000000000000000'
    )
    assert.notEqual(
      await instance.digests(2),
      '0x0000000000000000000000000000000000000000'
    )
    assert.notEqual(
      await instance.digests(253),
      '0x0000000000000000000000000000000000000000'
    )
  })

  it('should only allow the owner to set digests', async function() {
    var instance = await dnssec.deployed()
    await expectRevert.unspecified(
      instance.setDigest(1, accounts[1], { from: accounts[1] })
    )
  })

  it('should only allow the owner to set algorithms', async function() {
    var instance = await dnssec.deployed()
    await expectRevert.unspecified(
      instance.setAlgorithm(1, accounts[1], { from: accounts[1] })
    )
  })

  const validityPeriod = 2419200
  const expiration = Date.now() / 1000 - 15 * 60 + validityPeriod
  const inception = Date.now() / 1000 - 15 * 60

  it('should reject signatures with non-matching algorithms', async function() {
    var instance = await dnssec.deployed()
    var keys = rootKeys(expiration, inception)
    keys.rrs.forEach((r) => {
      r.data.algorithm = 255
    })
    await expectRevert(instance.verifyRRSet([hexEncodeSignedSet(keys)]), 'NoMatchingProof');
  })

  it('should reject signatures with non-matching keytags', async function() {
    var instance = await dnssec.deployed()
    var keys = rootKeys(expiration, inception)

    keys.rrs = [
      {
        name: '.',
        type: 'DNSKEY',
        class: 'IN',
        ttl: 3600,
        data: {
          flags: 0x0101,
          protocol: 3,
          algorithm: 253,
          key: Buffer.from('1112', 'HEX'),
        },
      },
    ]

    await expectRevert(instance.verifyRRSet([hexEncodeSignedSet(keys)]), 'NoMatchingProof');
  })

  it('should accept odd-length public keys', async () => {
    const instance = await dnssec.deployed()
    const keys = rootKeys(expiration, inception)
    keys.rrs = [
      {
        name: '.',
        type: 'DNSKEY',
        data: {
          flags: 257,
          algorithm: 253,
          key: Buffer.from('00', 'hex'),
        },
      },
    ]
    await verifySubmission(instance, [hexEncodeSignedSet(keys)])
  })

  it('should reject signatures by keys without the ZK bit set', async function() {
    var instance = await dnssec.deployed()
    var keys = rootKeys(expiration, inception)
    keys.rrs = [
      {
        name: '.',
        type: 'DNSKEY',
        class: 'IN',
        ttl: 3600,
        data: {
          flags: 0x0001,
          protocol: 3,
          algorithm: 253,
          key: Buffer.from('1211', 'HEX'),
        },
      },
    ]

    await expectRevert(instance.verifyRRSet([hexEncodeSignedSet(keys)]), 'NoMatchingProof');
  })

  it('should accept a root DNSKEY', async function() {
    var instance = await dnssec.deployed()
    var keys = rootKeys(expiration, inception)
    await verifySubmission(instance, [hexEncodeSignedSet(keys)])
  })

  it('should accept a signed RRSET', async function() {
    var instance = await dnssec.deployed()
    await verifySubmission(
      instance,
      [
        hexEncodeSignedSet(rootKeys(expiration, inception)),
        hexEncodeSignedSet({
          name: 'test',
          sig: {
            name: 'test',
            type: 'RRSIG',
            ttl: 0,
            class: 'IN',
            flush: false,
            data: {
              typeCovered: 'TXT',
              algorithm: 253,
              labels: 1,
              originalTTL: 3600,
              expiration,
              inception,
              keyTag: 1278,
              signersName: '.',
              signature: new Buffer([]),
            },
          },
          rrs: [
            {
              name: 'test',
              type: 'TXT',
              class: 'IN',
              ttl: 3600,
              data: Buffer.from('test', 'ascii'),
            },
          ],
        })
      ]
    )
  })

  it('should reject signatures with non-IN classes', async function() {
    var instance = await dnssec.deployed()
    await expectRevert(
      instance.verifyRRSet([
        hexEncodeSignedSet(rootKeys(expiration, inception)),
        hexEncodeSignedSet({
          name: 'net',
          sig: {
            name: 'net',
            type: 'RRSIG',
            ttl: 0,
            class: 'CH',
            flush: false,
            data: {
              typeCovered: 'TXT',
              algorithm: 253,
              labels: 1,
              originalTTL: 3600,
              expiration,
              inception,
              keyTag: 1278,
              signersName: '.',
              signature: new Buffer([]),
            },
          },
          rrs: [
            {
              name: 'net',
              type: 'TXT',
              class: 'CH',
              ttl: 3600,
              data: Buffer.from('foo', 'ascii'),
            },
          ],
        })
      ]),
      'InvalidClass'
    )
  })

  it('should reject signatures with the wrong type covered', async function() {
    var instance = await dnssec.deployed()
    await expectRevert(
      instance.verifyRRSet([
        hexEncodeSignedSet(rootKeys(expiration, inception)),
        hexEncodeSignedSet({
          name: 'net',
          sig: {
            name: 'net',
            type: 'RRSIG',
            ttl: 0,
            class: 'IN',
            flush: false,
            data: {
              typeCovered: 'DS',
              algorithm: 253,
              labels: 1,
              originalTTL: 3600,
              expiration,
              inception,
              keyTag: 1278,
              signersName: '.',
              signature: new Buffer([]),
            },
          },
          rrs: [
            {
              name: 'net',
              type: 'TXT',
              class: 'IN',
              ttl: 3600,
              data: Buffer.from('foo', 'ascii'),
            },
          ],
        })
      ]), 'SignatureTypeMismatch'
    )
  })

  it('should reject signatures with too many labels', async function() {
    var instance = await dnssec.deployed()
    await expectRevert(
      instance.verifyRRSet([
        hexEncodeSignedSet(rootKeys(expiration, inception)),
        hexEncodeSignedSet({
          name: 'net',
          sig: {
            name: 'net',
            type: 'RRSIG',
            ttl: 0,
            class: 'IN',
            flush: false,
            data: {
              typeCovered: 'TXT',
              algorithm: 253,
              labels: 2,
              originalTTL: 3600,
              expiration,
              inception,
              keyTag: 1278,
              signersName: '.',
              signature: new Buffer([]),
            },
          },
          rrs: [
            {
              name: 'net',
              type: 'TXT',
              class: 'IN',
              ttl: 3600,
              data: Buffer.from('foo', 'ascii'),
            },
          ],
        })
      ]), 'InvalidLabelCount'
    )
  })

  it('should reject signatures with invalid signer names', async function() {
    var instance = await dnssec.deployed()
    await verifySubmission(
      instance,
      [
        hexEncodeSignedSet(rootKeys(expiration, inception)),
        hexEncodeSignedSet({
          name: 'test',
          sig: {
            name: 'test',
            type: 'RRSIG',
            ttl: 0,
            class: 'IN',
            flush: false,
            data: {
              typeCovered: 'TXT',
              algorithm: 253,
              labels: 1,
              originalTTL: 3600,
              expiration,
              inception,
              keyTag: 1278,
              signersName: '.',
              signature: new Buffer([]),
            },
          },
          rrs: [
            {
              name: 'test',
              type: 'TXT',
              class: 'IN',
              ttl: 3600,
              data: Buffer.from('test', 'ascii'),
            },
          ],
        })
      ]
    )
    await expectRevert(
      instance.verifyRRSet([
        hexEncodeSignedSet(rootKeys(expiration, inception)),
        hexEncodeSignedSet({
          name: 'test',
          sig: {
            name: 'test',
            type: 'RRSIG',
            ttl: 0,
            class: 'IN',
            flush: false,
            data: {
              typeCovered: 'TXT',
              algorithm: 253,
              labels: 1,
              originalTTL: 3600,
              expiration,
              inception,
              keyTag: 1278,
              signersName: 'com',
              signature: new Buffer([]),
            },
          },
          rrs: [
            {
              name: 'test',
              type: 'TXT',
              class: 'IN',
              ttl: 3600,
              data: Buffer.from('test', 'ascii'),
            },
          ],
        })
      ]), 'InvalidSignerName'
    )
  })

  it('should reject entries with expirations in the past', async function() {
    var instance = await dnssec.deployed()
    var keys = rootKeys(expiration, inception)
    keys.sig.data.expiration = Date.now() / 1000 - 2
    await expectRevert(instance.verifyRRSet([hexEncodeSignedSet(keys)]), 'SignatureExpired');
  })

  it('should reject entries with inceptions in the future', async function() {
    var instance = await dnssec.deployed()
    var keys = rootKeys(expiration, inception)
    keys.sig.data.inception = Date.now() / 1000 + 15 * 60
    await expectRevert(instance.verifyRRSet([hexEncodeSignedSet(keys)]), 'SignatureNotValidYet');
  })

  it('should reject invalid RSA signatures', async function() {
    var instance = await dnssec.deployed()
    await instance.verifyRRSet(
      [
        [test_rrsets[0][1], test_rrsets[0][2]]
      ],
      test_rrset_timestamp
    );
    var sig = test_rrsets[0][2]
    await expectRevert(
      instance.verifyRRSet(
        [[test_rrsets[0][1], sig.slice(0, sig.length - 2) + 'FF']],
        test_rrset_timestamp
      ),
      'NoMatchingProof'
    );
  })

  it('should reject DS proofs with the wrong name', async function() {
    var instance = await dnssec.deployed()
    await expectRevert(
      instance.verifyRRSet([
        hexEncodeSignedSet(rootKeys(expiration, inception)),
        hexEncodeSignedSet({
          name: 'test',
          sig: {
            name: 'test',
            type: 'RRSIG',
            ttl: 0,
            class: 'IN',
            flush: false,
            data: {
              typeCovered: 'DS',
              algorithm: 253,
              labels: 1,
              originalTTL: 3600,
              expiration,
              inception,
              keyTag: 1278,
              signersName: '.',
              signature: new Buffer([]),
            },
          },
          rrs: [
            {
              name: 'test',
              type: 'DS',
              class: 'IN',
              ttl: 3600,
              data: {
                keyTag: 1278, // Empty body, flags == 0x0101, algorithm = 253, body = 0x0000
                algorithm: 253,
                digestType: 253,
                digest: new Buffer('', 'hex')
              }
            },
          ],
        }),
        hexEncodeSignedSet({
          name: 'foo',
          sig: {
            name: 'foo',
            type: 'RRSIG',
            ttl: 0,
            class: 'IN',
            flush: false,
            data: {
              typeCovered: 'DNSKEY',
              algorithm: 253,
              labels: 1,
              originalTTL: 3600,
              expiration,
              inception,
              keyTag: 1278,
              signersName: 'foo',
              signature: new Buffer([]),
            },
          },
          rrs: [
            {
              name: 'foo',
              type: 'DNSKEY',
              class: 'IN',
              ttl: 3600,
              data: {
                flags: 0x0101,
                algorithm: 253,
                key: Buffer.from('0000', 'HEX'),
              },
            }
          ]
        })
      ]),
      'ProofNameMismatch'
    )
  })
})
