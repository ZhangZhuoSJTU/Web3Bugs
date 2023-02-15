import random

import pytest
from brownie.test import given, strategy


@pytest.mark.math
class TestBitmap:
    @pytest.fixture(scope="module", autouse=True)
    def mockBitmap(self, MockBitmap, accounts):
        return accounts[0].deploy(MockBitmap)

    @given(bitmap=strategy("bytes32"))
    def test_is_bit_set(self, mockBitmap, bitmap):
        index = random.randint(1, 256)
        bitmask = list("".zfill(256))
        bitmask[index - 1] = "1"
        bitmask = "".join(bitmask)

        result = mockBitmap.isBitSet(bitmap, index)
        computedResult = (int(bitmask, 2) & int(bitmap.hex(), 16)) != 0
        assert result == computedResult

    @given(bitmap=strategy("bytes32"))
    def test_set_bit_on(self, mockBitmap, bitmap):
        index = random.randint(1, 256)
        newBitmap = mockBitmap.setBit(bitmap, index, True)
        assert mockBitmap.isBitSet(newBitmap, index)

    @given(bitmap=strategy("bytes32"))
    def test_set_bit_off(self, mockBitmap, bitmap):
        index = random.randint(1, 256)
        newBitmap = mockBitmap.setBit(bitmap, index, False)
        assert not mockBitmap.isBitSet(newBitmap, index)

    @given(bitmap=strategy("bytes32"))
    def test_total_bits_set(self, mockBitmap, bitmap):
        total = mockBitmap.totalBitsSet(bitmap)
        bitstring = "{:08b}".format(int(bitmap.hex(), 16))
        computedTotal = len([x for x in filter(lambda x: x == "1", list(bitstring))])

        assert total == computedTotal

    @given(bitmap=strategy("bytes32"))
    def test_msb_and_bit_num(self, mockBitmap, bitmap):
        msb = mockBitmap.getMSB(bitmap)
        bitNum = mockBitmap.getNextBitNum(bitmap)

        bitstring = "{:0256b}".format(int(bitmap.hex(), 16))
        indexes = [i for (i, b) in enumerate(list(bitstring)) if b == "1"]
        if len(indexes) == 0:
            assert msb == 0
            assert bitNum == 0
        else:
            assert msb == (255 - min(indexes))
            assert bitNum == (min(indexes) + 1)
