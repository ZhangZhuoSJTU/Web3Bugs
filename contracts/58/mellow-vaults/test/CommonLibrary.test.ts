import { expect } from "chai";
import { Contract } from "@ethersproject/contracts";
import { Address } from "hardhat-deploy/dist/types";
import { deployCommonLibraryTest } from "./library/Deployments";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import Exceptions from "./library/Exceptions";

describe("CommonLibrary", () => {
    let commonTest: Contract;
    const addresses: Address[] = [
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        "0x0000000000000000000000000000000000000003",
        "0x0000000000000000000000000000000000000004",
        "0x0000000000000000000000000000000000000005",
        "0x0000000000000000000000000000000000000006",
        "0x0000000000000000000000000000000000000007",
    ];

    before(async () => {
        commonTest = await deployCommonLibraryTest();
    });

    describe("bubbleSort", () => {
        it("sort unsorted", async () => {
            const array: Address[] = [addresses[3], addresses[2], addresses[1]];
            const sorted: Address[] = await commonTest.bubbleSort(array);
            expect(sorted).to.deep.equal([
                addresses[1],
                addresses[2],
                addresses[3],
            ]);
        });

        it("sort non-unique", async () => {
            const array: Address[] = [
                addresses[3],
                addresses[2],
                addresses[1],
                addresses[2],
                addresses[3],
            ];
            const sorted: Address[] = await commonTest.bubbleSort(array);
            expect(sorted).to.deep.equal([
                addresses[1],
                addresses[2],
                addresses[2],
                addresses[3],
                addresses[3],
            ]);
        });

        it("sort empty array", async () => {
            expect(await commonTest.bubbleSort([])).to.deep.equal([]);
        });
    });

    describe("isSortedAndUnique", () => {
        it("true for sorted and unique", async () => {
            const array: Address[] = [addresses[1], addresses[2], addresses[3]];
            expect(await commonTest.isSortedAndUnique(array)).to.equal(true);
        });

        it("false for unsorted", async () => {
            const array: Address[] = [addresses[3], addresses[1], addresses[2]];
            expect(await commonTest.isSortedAndUnique(array)).to.equal(false);
        });

        it("false for unsorted and non-unique", async () => {
            const array: Address[] = [
                addresses[3],
                addresses[1],
                addresses[2],
                addresses[3],
            ];
            expect(await commonTest.isSortedAndUnique(array)).to.equal(false);
        });

        it("false for sorted an non-unique", async () => {
            const array: Address[] = [
                addresses[0],
                addresses[1],
                addresses[1],
                addresses[3],
            ];
            expect(await commonTest.isSortedAndUnique(array)).to.equal(false);
        });

        it("true for empty", async () => {
            expect(await commonTest.isSortedAndUnique([])).to.equal(true);
        });
    });

    describe("projectTokenAmounts", () => {
        describe("when tokensToProject is not a subset of tokens", () => {
            describe("when tokenAmountsToProject are all zero", () => {
                it("returns zero array", async () => {
                    let res = await commonTest.projectTokenAmountsTest(
                        [
                            addresses[0],
                            addresses[1],
                            addresses[3],
                            addresses[6],
                        ],
                        [
                            addresses[2],
                            addresses[4],
                            addresses[5],
                            addresses[7],
                        ],
                        [
                            BigNumber.from(0),
                            BigNumber.from(0),
                            BigNumber.from(0),
                            BigNumber.from(0),
                        ]
                    );
                    expect(res).to.deep.equal([
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                    ]);
                });
            });
            describe("when tokenAmountsToProject are not == 0", () => {
                it("returns zero array", async () => {
                    await expect(
                        commonTest.projectTokenAmountsTest(
                            [
                                addresses[0],
                                addresses[1],
                                addresses[3],
                                addresses[6],
                            ],
                            [
                                addresses[2],
                                addresses[4],
                                addresses[5],
                                addresses[7],
                            ],
                            [
                                BigNumber.from(0),
                                BigNumber.from(10),
                                BigNumber.from(0),
                                BigNumber.from(0),
                            ]
                        )
                    ).to.be.revertedWith("TPS");
                });
            });

            describe("when tokens.length > tokensToProject.length", () => {
                it("returns correct answer", async () => {
                    let res = await commonTest.projectTokenAmountsTest(
                        [
                            addresses[0],
                            addresses[1],
                            addresses[3],
                            addresses[6],
                            addresses[7],
                        ],
                        [addresses[2], addresses[4], addresses[5]],
                        [
                            BigNumber.from(0),
                            BigNumber.from(0),
                            BigNumber.from(0),
                        ]
                    );
                    expect(res).to.deep.equal([
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                    ]);
                });
            });
        });

        describe("when tokensToProject is a subset of tokens", () => {
            describe("when tokenAmountsToProject are all zero", () => {
                it("returns zero array", async () => {
                    let res = await commonTest.projectTokenAmountsTest(
                        [
                            addresses[0],
                            addresses[1],
                            addresses[3],
                            addresses[6],
                        ],
                        [
                            addresses[1],
                            addresses[4],
                            addresses[6],
                            addresses[7],
                        ],
                        [
                            BigNumber.from(0),
                            BigNumber.from(0),
                            BigNumber.from(0),
                            BigNumber.from(0),
                        ]
                    );
                    expect(res).to.deep.equal([
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                    ]);
                });
            });
            describe("when tokenAmountsToProject are not == 0", () => {
                it("returns zero array", async () => {
                    let res = await commonTest.projectTokenAmountsTest(
                        [
                            addresses[0],
                            addresses[1],
                            addresses[3],
                            addresses[6],
                        ],
                        [
                            addresses[1],
                            addresses[4],
                            addresses[6],
                            addresses[7],
                        ],
                        [
                            BigNumber.from(10),
                            BigNumber.from(0),
                            BigNumber.from(10),
                            BigNumber.from(0),
                        ]
                    );
                    expect(res).to.deep.equal([
                        BigNumber.from(0),
                        BigNumber.from(10),
                        BigNumber.from(0),
                        BigNumber.from(10),
                    ]);
                });
            });
            describe("when tokens.length > tokensToProject.length", () => {
                it("returns correct answer", async () => {
                    let res = await commonTest.projectTokenAmountsTest(
                        [
                            addresses[0],
                            addresses[1],
                            addresses[3],
                            addresses[6],
                            addresses[7],
                        ],
                        [addresses[1], addresses[3], addresses[7]],
                        [
                            BigNumber.from(0),
                            BigNumber.from(10),
                            BigNumber.from(20),
                        ]
                    );
                    expect(res).to.deep.equal([
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(10),
                        BigNumber.from(0),
                        BigNumber.from(20),
                    ]);
                });
            });
        });
    });

    describe("isContract", () => {
        describe("when address is contract", () => {
            it("returns true", async () => {
                expect(
                    await commonTest.isContractTest(commonTest.address)
                ).to.be.equal(true);
            });
        });
        describe("when address is not contract", () => {
            it("returns false", async () => {
                expect(
                    await commonTest.isContractTest(
                        (await ethers.getSigners())[0].getAddress()
                    )
                ).to.be.equal(false);
            });
        });
    });

    describe("splitAmounts", () => {
        // todo
        it("returns correct weighted and normalized matrix", async () => {
            expect(
                await commonTest.splitAmountsTest(
                    [3, 3, 3],
                    [
                        [1, 1, 1],
                        [1, 1, 1],
                        [1, 1, 1],
                    ]
                )
            ).to.deep.equal([
                [BigNumber.from(1), BigNumber.from(1), BigNumber.from(1)],
                [BigNumber.from(1), BigNumber.from(1), BigNumber.from(1)],
                [BigNumber.from(1), BigNumber.from(1), BigNumber.from(1)],
            ]);
        });

        describe("when amounts.length == 0", () => {
            it("reverts", async () => {
                await expect(
                    commonTest.splitAmountsTest(
                        [],
                        [
                            [1, 2, 3],
                            [4, 5, 6],
                            [7, 8, 9],
                        ]
                    )
                ).to.be.revertedWith(Exceptions.AMOUNTS_LENGTH_IS_ZERO);
            });
        });
        describe("when weights.length == 0", () => {
            it("reverts", async () => {
                await expect(
                    commonTest.splitAmountsTest([1, 2, 3], [])
                ).to.be.revertedWith(Exceptions.WEIGHTS_LENGTH_IS_ZERO);
            });
        });

        describe("when weights[i].length != amounts.length", () => {
            it("reverts", async () => {
                await expect(
                    commonTest.splitAmountsTest(
                        [1, 2, 3],
                        [
                            [1, 2, 3],
                            [4, 5],
                            [7, 8, 9],
                        ]
                    )
                ).to.be.revertedWith(Exceptions.MATRIX_NOT_RECTANGULAR);
            });
        });
    });
});
