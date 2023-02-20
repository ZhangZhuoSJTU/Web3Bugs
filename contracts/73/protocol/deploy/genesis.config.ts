import {BigNumber, utils} from "ethers"
export default {
    initialSupply: utils.parseEther("10000000"),
    crowdSupply: utils.parseEther("6343700"),
    companySupply: utils.parseEther("500000"),
    teamSupply: utils.parseEther("1235000"),
    investorsSupply: utils.parseEther("1900000"),
    communitySupply: utils.parseEther("21300"),
    bankMultisig: "0x6941627cba3518385e75de75d25a189185672bfe",
    governanceMultisig: "0x04746b890d090ae3c4c5df0101cfd089a4faca6c",
    timeToGrantsStart: BigNumber.from(60).mul(60).mul(4),
    merkleMine: {
        genesisRoot: "0x53f35a304a1e1e20d6648e09bb3073ccd44a5bf1638a01355897a71e801879f8",
        totalGenesisRecipients: 2598071,
        balanceThreshold: 100000000000000000,
        genesisBlock: 5264265,
        blocksToCliff: 500000,
        callerAllocationPeriod: 2500000
    },
    teamTimeToCliff: 0,
    teamVestingDuration: BigNumber.from(60).mul(60).mul(24).mul(365).mul(3),
    teamGrants: [
        {
            receiver: "0x907D3231DFd3b45C1075B87ff92335325fEd3632",
            amount: utils.parseEther("500000")
        },
        {
            receiver: "0x13eF0bA91DF06e789cFdDC8C72c704948242C801",
            amount: utils.parseEther("500000")
        },
        {
            receiver: "0x64EC217e384CF06Bb8cf73cb3fcbc0A42DBA8071",
            amount: utils.parseEther("60000")
        },
        {
            receiver: "0x02a7Db34a9415642BC8d9899E29b43E070546A00",
            amount: utils.parseEther("25000")
        },
        {
            receiver: "0xc7d6d54a4360b42fa0759e12de990bfd4b13d3c3",
            amount: utils.parseEther("20000")
        },
        {
            receiver: "0x867C90A7F48FB39b2f3cCbdd33e5002477b935AE",
            amount: utils.parseEther("25000")
        },
        {
            receiver: "0x5c64a6C5b93917B51a073e7Bc92e6C02de2DE85b",
            amount: utils.parseEther("50000")
        },
        {
            receiver: "0x85a48E017c2f09037046656F2dbB063c3C1d3CE2",
            amount: utils.parseEther("55000")
        }
    ],
    investorsTimeToCliff: 0,
    investorsVestingDuration: BigNumber.from(60).mul(60).mul(24).mul(365).mul(3).div(2),
    investorGrants: [
        {
            receiver: "0x2e0EEaEB1aF7565bd5381aaEDEb8EEB0B1082d02",
            amount: utils.parseEther("228432")
        },
        {
            receiver: "0x58EaE5A835a2DA8815028CC56b4a1490f3D49D5E",
            amount: utils.parseEther("348039")
        },
        {
            receiver: "0x0C199ebd4D61A28861B47792ADf200DE2b48bC82",
            amount: utils.parseEther("211765")
        },
        {
            receiver: "0xCe12D21f23501d6Edfd215157ecD8ACAd3A3E399",
            amount: utils.parseEther("26471")
        },
        {
            receiver: "0x26d869Da43ac69E9505101C87019b08d06159B25",
            amount: utils.parseEther("15882")
        },
        {
            receiver: "0xEfaCaC60b2E24cdB3A414e5692e6d326029055e8",
            amount: utils.parseEther("34803")
        },
        {
            receiver: "0x662DfAF8267114A29533FfC3C1EBa18687AA077e",
            amount: utils.parseEther("52941")
        },
        {
            receiver: "0x4FAb6DfAA87ED82D9b9255416cE472Db42DC657C",
            amount: utils.parseEther("26471")
        },
        {
            receiver: "0x94d9A128875c2928BD212ee7eDF980389b008DBD",
            amount: utils.parseEther("48726")
        },
        {
            receiver: "0x9fD4a0c0f41e7192C8bBCf8197f5Fbb0f4C5AeCb",
            amount: utils.parseEther("34804")
        },
        {
            receiver: "0x395b0b569118Cd826B53b5A6246Adb5795b8D28C",
            amount: utils.parseEther("100000")
        },
        {
            receiver: "0x4122fb56891A6771dd5785cff5Ebcf98f134DDCB",
            amount: utils.parseEther("8333")
        },
        {
            receiver: "0x8d55189f170B1B5Ccb9DE214e0ECCdB30325C1F4",
            amount: utils.parseEther("25000")
        },
        {
            receiver: "0x67936306C1490dB7C491B0fE56BCf067eDE1Fd28",
            amount: utils.parseEther("83333")
        },
        {
            receiver: "0x9dbF125B97DD49915E54C63eed81545edc1B20dB",
            amount: utils.parseEther("166667")
        },
        {
            receiver: "0x8d95adcFdC1aBEB7385C298C09b8592DcB6dF6eC",
            amount: utils.parseEther("33333")
        },
        {
            receiver: "0xd355d1390c4a077D85AfaC1B2C1faE1624a30E52",
            amount: utils.parseEther("83333")
        },
        {
            receiver: "0x5af1B322A9Cb01Ca2104a6c2b94400fc3F8fE1Ef",
            amount: utils.parseEther("183333")
        },
        {
            receiver: "0xeB73C744B95c75709F362E42769ffeFc71952432",
            amount: utils.parseEther("66667")
        },
        {
            receiver: "0xD48A50d038A842d4D6408Ae8478DBCC22562E392",
            amount: utils.parseEther("83333")
        },
        {
            receiver: "0xA23F2B0920B6A7c321f286B03d15dd621F314863",
            amount: utils.parseEther("16667")
        },
        {
            receiver: "0xF775B7B3dbf427603d7E0075b7ce13892b13Dd9c",
            amount: utils.parseEther("16667")
        },
        {
            receiver: "0x94aD4001c7a411fA8D55044508170e65ca9f77cA",
            amount: utils.parseEther("5000")
        }
    ],
    communityGrants: [
        {
            receiver: "0x85a48E017c2f09037046656F2dbB063c3C1d3CE2",
            amount: utils.parseEther("2000")
        },
        {
            receiver: "0x11Ab5Ec22AE6772CD3a704717b3c9d7B8224631b",
            amount: utils.parseEther("500")
        },
        {
            receiver: "0x064d7f14CA21C9616d419e6d60Fe1d4EF0BD8315",
            amount: utils.parseEther("7500")
        },
        {
            receiver: "0x191ce48c50b96006c32c338aecb8fd8caa954132",
            amount: utils.parseEther("500")
        },
        {
            receiver: "0x5d030bfd0287007b7626648668b027c7922a1315",
            amount: utils.parseEther("500")
        },
        {
            receiver: "0x07525F33E00e5494bCBaba5d69f752ba0ED1A657",
            amount: utils.parseEther("1000")
        },
        {
            receiver: "0x066bcbeb88e398bbc5d960ba2079dfe118593811",
            amount: utils.parseEther("500")
        },
        {
            receiver: "0x22b544d19ffe43c6083327271d9f39020da30c65",
            amount: utils.parseEther("1000")
        },
        {
            receiver: "0x6bA604963046512Cc0143693E9A52Faa2eB41ec2",
            amount: utils.parseEther("750")
        },
        {
            receiver: "0xe507c8882dab3277577937f868dc14d5b1f16b1a",
            amount: utils.parseEther("500")
        },
        {
            receiver: "0xbd91c9df3c30f0e43b19b1dd05888cf9b647b781",
            amount: utils.parseEther("750")
        },
        {
            receiver: "0xf0f4AF7eD1Dd8e1B71883A92F8C484C3f286f5f7",
            amount: utils.parseEther("300")
        },
        {
            receiver: "0x3bb3f97618929f4f493cfcd2918427634ed14ee4",
            amount: utils.parseEther("500")
        },
        {
            receiver: "0x7d3e2d29C0F77d35e470942e10aeD8f3a6A596fe",
            amount: utils.parseEther("1000")
        },
        {
            receiver: "0x4122fb56891A6771dd5785cff5Ebcf98f134DDCB",
            amount: utils.parseEther("1000")
        },
        {
            receiver: "0x144c7b90f5A9888676931f6F829761A1F3D948c7",
            amount: utils.parseEther("3000")
        }
    ]
}
