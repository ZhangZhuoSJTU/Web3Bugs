function isException(error) {
    let strError = error.toString();
    return strError.includes('invalid opcode') || strError.includes('invalid JUMP') || strError.includes('revert');
}

function ensureException(error) {
    assert(isException(error), error.toString());
}

async function expectFailure(call) {
    try {
        await call;
    } catch (error) {
        return ensureException(error)
    }

    assert.fail("should fail")
}

module.exports = {
    ensureException: ensureException,
    expectFailure: expectFailure
}
