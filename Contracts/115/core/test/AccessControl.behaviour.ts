import { constants } from "./utils/helpers";

function shouldBehaveLikeAccessControl(ctx: any, owner: string) {
  it("deployer has default admin role", async () => {
    const hasAdminRole = await ctx().hasRole(constants.DEFAULT_ADMIN_ROLE, owner);
    expect(hasAdminRole).to.equal(true);
  });
}

module.exports = shouldBehaveLikeAccessControl;
