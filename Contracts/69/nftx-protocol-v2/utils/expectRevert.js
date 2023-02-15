const { fail } = require("assert");

const expectException = async (promise, expectedError) => {
  try {
    await promise;
  } catch (error) {
    if (error.message.indexOf(expectedError) === -1) {
      const actualError = error.message.replace(
        "Returned error: VM Exception while processing transaction: ",
        ""
      );
      fail(actualError); // , expectedError, 'Wrong kind of exception received');
    }
    return;
  }

  fail("Expected an exception but none was received");
};

const expectRevert = async (promise) => {
  await expectException(promise, "revert");
};

expectRevert.assertion = (promise) =>
  expectException(promise, "invalid opcode");
expectRevert.outOfGas = (promise) => expectException(promise, "out of gas");
expectRevert.unspecified = (promise) => expectException(promise, "revert");

exports.expectException = expectException;
exports.expectRevert = expectRevert;
