import glob
import json
from os import path

import argparse

import web3

BUILD_PATH = path.join(path.dirname(path.dirname(__file__)), "build")
CONTRACTS_PATH = path.join(BUILD_PATH, "contracts")
DEFAULT_OUTPUT = path.join(BUILD_PATH, "4byte_signatures.json")

parser = argparse.ArgumentParser(prog="generate_4byte_json")
parser.add_argument("--output", "-o", type=str, default=DEFAULT_OUTPUT)


def encode_argument(component):
    if component["type"] == "tuple":
        return "(" + encode_arguments(component["components"]) + ")"
    return component["type"]


def encode_arguments(components):
    return ",".join([encode_argument(component) for component in components])


def encode_function(func_abi):
    return func_abi["name"] + "(" + encode_arguments(func_abi["inputs"]) + ")"


def generate_abi_signatures(abi):
    signatures = {}
    for func in abi:
        if func["type"] != "function":
            continue
        signature = encode_function(func)
        selector = web3.Web3.keccak(text=signature)[:4].hex()[2:]
        signatures[selector] = signature
    return signatures


def generate_all_signatures(files):
    signatures = {}
    for contract in files:
        with open(contract) as f:
            abi = json.load(f)["abi"]
            signatures.update(generate_abi_signatures(abi))
    return signatures


def main():
    args = parser.parse_args()
    files = glob.glob(path.join(CONTRACTS_PATH, "**", "*.json"), recursive=True)
    signatures = generate_all_signatures(files)
    with open(args.output, "w") as f:
        json.dump(signatures, f, indent=2)


if __name__ == "__main__":
    main()
