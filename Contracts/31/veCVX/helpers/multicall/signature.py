# Credit: https://github.com/banteg/multicall.py/blob/master/multicall/signature.py

from eth_abi import encode_single, decode_single
from eth_utils import function_signature_to_4byte_selector


def parse_signature(signature):
    """
    Breaks 'func(address)(uint256)' into ['func', '(address)', '(uint256)']
    """
    parts = []
    stack = []
    start = 0
    for end, letter in enumerate(signature):
        if letter == "(":
            stack.append(letter)
            if not parts:
                parts.append(signature[start:end])
                start = end
        if letter == ")":
            stack.pop()
            if not stack:  # we are only interested in outermost groups
                parts.append(signature[start : end + 1])
                start = end + 1
    return parts


class Signature:
    def __init__(self, signature):
        self.signature = signature
        self.parts = parse_signature(signature)
        self.input_types = self.parts[1]
        self.output_types = self.parts[2]
        self.function = "".join(self.parts[:2])
        self.fourbyte = function_signature_to_4byte_selector(self.function)

    def encode_data(self, args=None):
        return (
            self.fourbyte + encode_single(self.input_types, args)
            if args
            else self.fourbyte
        )

    def decode_data(self, output):
        return decode_single(self.output_types, output)
