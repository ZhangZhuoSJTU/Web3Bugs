const {assert, expect} = require("chai");
const {ethers, upgrades} = require("hardhat");
require("chai").should();

describe("Controller Contract", async () => {
    let ADMIN, ALICE, BOB;
    let Controller;

    before(async () => {
        [ADMIN, ALICE, BOB] = await ethers.getSigners();
        Controller = await ethers.getContractFactory("ControllerMock");
    });

    describe("Pause and unpause contract using default admin", () => {
        let controller;
        let pauseTx;
        let unpauseTx;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
        });

        it("Contract should be unpaused by default", async () => {
            let paused = await controller.paused();
            paused.should.eq(false);
        });

        it("Admin should be able to send pause tx", async () => {
            try {
                pauseTx = await controller.pause();
            } catch (e) {
                console.error(e);
                assert.fail();
            }
        });

        it("Paused event should be emitted in pause tx", async () => {
            const receipt = await pauseTx.wait();
            const logIdx = receipt.events.findIndex(e => e.event == "Paused");
            expect(logIdx).to.be.a("number").that.is.gt(-1);
        });

        it("Contract should be paused", async () => {
            let paused = await controller.paused();
            paused.should.eq(true);
        });

        it("Admin should be able to send unpause tx", async () => {
            try {
                unpauseTx = await controller.unpause();
            } catch (e) {
                console.error(e);
                assert.fail();
            }
        });

        it("Unpaused event should be emitted in unpause tx", async () => {
            const receipt = await unpauseTx.wait();
            const logIdx = receipt.events.findIndex(e => e.event == "Unpaused");
            expect(logIdx).to.be.a("number").that.is.gt(-1);
        });

        it("Contract should be unpaused", async () => {
            let paused = await controller.paused();
            paused.should.eq(false);
        });
    });

    describe("Unpausing already unpaused contract", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
        });

        it("Contract should be unpaused", async () => {
            let paused = await controller.paused();
            paused.should.eq(false);
        });

        it("Unpause tx should fail", async () => {
            try {
                await controller.unpause();
            } catch (e) {
                return;
            }
            assert.fail();
        });
    });

    describe("Pausing already paused contract", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
            await controller.pause();
        });

        it("Contract should be pasued", async () => {
            let paused = await controller.paused();
            paused.should.eq(true);
        });

        it("Pause tx should fail", async () => {
            try {
                await controller.pause();
            } catch (e) {
                return;
            }
            assert.fail();
        });
    });

    describe("Change pause guardian using default admin", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
        });

        it("Pause guardian should be admin by default", async () => {
            const pauseGuardian = await controller.pauseGuardian();
            pauseGuardian.should.eq(ADMIN.address);
        });

        it("Admin should be able to change pause guardian to Alice", async () => {
            try {
                await controller.setGuardian(ALICE.address);
            } catch (e) {
                console.log(e);
                assert.fail();
            }
        });

        it("Alice should be new pause guardian", async () => {
            const pauseGuardian = await controller.pauseGuardian();
            pauseGuardian.should.eq(ALICE.address);
        });
    });

    describe("Pause and unpause using non default guardian (Alice)", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
            await controller.setGuardian(ALICE.address);
        });

        it("Alice should be pause guardian", async () => {
            const pauseGuardian = await controller.pauseGuardian();
            pauseGuardian.should.eq(ALICE.address);
        });

        it("Contract should be unpaused", async () => {
            let paused = await controller.paused();
            paused.should.eq(false);
        });

        it("Alice should be able to send pause tx", async () => {
            try {
                await controller.connect(ALICE).pause();
            } catch (e) {
                assert.fail();
            }
        });

        it("Contract should be paused", async () => {
            let paused = await controller.paused();
            paused.should.eq(true);
        });

        it("Alice should be able to send unpause tx", async () => {
            try {
                await controller.connect(ALICE).unpause();
            } catch (e) {
                assert.fail();
            }
        });

        it("Contract should be unpaused", async () => {
            let paused = await controller.paused();
            paused.should.eq(false);
        });
    });

    describe("Change pause guardian using non admin (Bob)", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
        });

        it("Bob should not be the guardian", async () => {
            const pauseGuardian = await controller.pauseGuardian();
            pauseGuardian.should.not.eq(BOB.address);
        });

        it("Bob should not be able to change pause guardian to Alice", async () => {
            try {
                await controller.connect(BOB).setGuardian(ALICE.address);
            } catch (e) {
                return;
            }
            assert.fail();
        });
    });

    describe("Pause contract using non guardian (Bob)", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
            await controller.setGuardian(ALICE.address);
        });

        it("Bob should not be the guardian", async () => {
            const pauseGuardian = await controller.pauseGuardian();
            pauseGuardian.should.not.eq(BOB.address);
        });

        it("Contract should be unpaused", async () => {
            let paused = await controller.paused();
            paused.should.eq(false);
        });

        it("Bob should not be able to pause the contract", async () => {
            try {
                await controller.connect(BOB).pause();
            } catch (e) {
                return;
            }
            assert.fail();
        });
    });

    describe("Unpause contract using non guardian (Bob)", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
            await controller.pause();
            await controller.setGuardian(ALICE.address);
        });

        it("Bob should not be the guardian", async () => {
            const pauseGuardian = await controller.pauseGuardian();
            pauseGuardian.should.not.eq(BOB.address);
        });

        it("Contract should be paused", async () => {
            let paused = await controller.paused();
            paused.should.eq(true);
        });

        it("Bob should not be able to unpause the contract", async () => {
            try {
                await controller.connect(BOB).unpause();
            } catch (e) {
                return;
            }
            assert.fail();
        });
    });

    describe("Add new admins using default admin", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
        });

        it("Default admin should be admin", async () => {
            isAdmin = await controller.isAdmin(ADMIN.address);
            isAdmin.should.eq(true);
        });

        it("Alice should not be an admin", async () => {
            isAdmin = await controller.isAdmin(ALICE.address);
            isAdmin.should.eq(false);
        });

        it("Bob should not be an admin", async () => {
            isAdmin = await controller.isAdmin(BOB.address);
            isAdmin.should.eq(false);
        });

        it("Default admin should be able to add Alice as admin", async () => {
            try {
                await controller.addAdmin(ALICE.address);
            } catch (e) {
                assert.fail();
            }
        });

        it("Default admin should be able to add Bob as admin", async () => {
            try {
                await controller.addAdmin(BOB.address);
            } catch (e) {
                assert.fail();
            }
        });

        it("Alice should be an admin", async () => {
            isAdmin = await controller.isAdmin(ALICE.address);
            isAdmin.should.eq(true);
        });

        it("Bob should be an admin", async () => {
            isAdmin = await controller.isAdmin(BOB.address);
            isAdmin.should.eq(true);
        });
    });

    describe("Admins should be able to renounce themselves", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
            await controller.addAdmin(ALICE.address);
            await controller.addAdmin(BOB.address);
        });

        it("Default admin should be an admin", async () => {
            isAdmin = await controller.isAdmin(ADMIN.address);
            isAdmin.should.eq(true);
        });

        it("Default admin should be able to renounce", async () => {
            try {
                await controller.renounceAdmin();
            } catch (e) {
                assert.fail();
            }
        });

        it("Default admin should not be an admin", async () => {
            isAdmin = await controller.isAdmin(ADMIN.address);
            isAdmin.should.eq(false);
        });

        it("Alice should be an admin", async () => {
            isAdmin = await controller.isAdmin(ALICE.address);
            isAdmin.should.eq(true);
        });

        it("Alice should be able to renounce", async () => {
            try {
                await controller.connect(ALICE).renounceAdmin();
            } catch (e) {
                assert.fail();
            }
        });

        it("Alice should not be an admin", async () => {
            isAdmin = await controller.isAdmin(ALICE.address);
            isAdmin.should.eq(false);
        });

        it("Bob should be an admin", async () => {
            isAdmin = await controller.isAdmin(BOB.address);
            isAdmin.should.eq(true);
        });

        it("Bob should be able to renounce", async () => {
            try {
                await controller.connect(BOB).renounceAdmin();
            } catch (e) {
                assert.fail();
            }
        });

        it("Bob should not be an admin", async () => {
            isAdmin = await controller.isAdmin(BOB.address);
            isAdmin.should.eq(false);
        });
    });

    describe("Add new admin using non default admin (Alice)", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
            await controller.addAdmin(ALICE.address);
            await controller.renounceAdmin();
        });

        it("Default admin should not be an admin", async () => {
            isAdmin = await controller.isAdmin(ADMIN.address);
            isAdmin.should.eq(false);
        });

        it("Alice should be an admin", async () => {
            isAdmin = await controller.isAdmin(ALICE.address);
            isAdmin.should.eq(true);
        });

        it("Alice should be able to add Bob as admin", async () => {
            try {
                await controller.connect(ALICE).addAdmin(BOB.address);
            } catch (e) {
                assert.fail();
            }
        });

        it("Bob should be an admin", async () => {
            isAdmin = await controller.isAdmin(BOB.address);
            isAdmin.should.eq(true);
        });
    });

    describe("Add new admin using non admin (Bob)", () => {
        let controller;
        before(async () => {
            controller = await upgrades.deployProxy(Controller, [ADMIN.address], {
                initializer: "__Controller_init(address)",
                kind: "uups"
            });
        });

        it("Bob should not be an admin", async () => {
            isAdmin = await controller.isAdmin(BOB.address);
            isAdmin.should.eq(false);
        });

        it("Bob should not be able to add Alice as admin", async () => {
            try {
                await controller.connect(BOB).addAdmin(ALICE.address);
            } catch (e) {
                return;
            }
            assert.fail();
        });
    });
});
