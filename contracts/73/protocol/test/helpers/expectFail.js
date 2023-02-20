export default async (promise, reason) => {
    try {
        await promise
    } catch (error) {
        assert.isTrue(
            error.message.includes(reason),
            `Reverted, but with a different reason: ${error.message}`
        )
        return
    }

    assert.fail("Expected revert did not occur")
}
