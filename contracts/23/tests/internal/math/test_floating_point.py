import pytest
from brownie.test import given, strategy


class TestFloatingPoint:
    @pytest.fixture(scope="module", autouse=True)
    def floatingPoint(self, accounts, MockFloatingPoint56):
        return accounts[0].deploy(MockFloatingPoint56)

    @pytest.fixture(autouse=True)
    def isolation(self, fn_isolation):
        pass

    @given(value=strategy("uint128"))
    def test_floating_point(self, floatingPoint, value):
        (packed, unpacked) = floatingPoint.testPackingUnpacking(value)

        bitsShifted = int(packed.hex()[-2:], 16)
        # This is the max bit shift
        assert bitsShifted <= (128 - 47)
        # Assert packed is always less than 56 bits, means that the
        # top 50 values (256 - 56 = 200 bits) and 4 bits per character
        # equals 50 values
        assert str(packed.hex())[0:50] == "0" * 50
        # Assert unpacked is always approximately value
        if value < (2 ** 48 - 1):
            assert bitsShifted == 0
            assert unpacked == value
        else:
            maxPrecisionLoss = 2 ** bitsShifted
            assert value - unpacked < maxPrecisionLoss
            assert (value >> bitsShifted) == (unpacked >> bitsShifted)
