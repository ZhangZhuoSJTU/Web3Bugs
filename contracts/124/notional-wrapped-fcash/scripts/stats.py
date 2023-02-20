import json
import os
from subprocess import CalledProcessError, check_output


def get_code_stats():
    try:
        out = check_output(
            ["scc", "--by-file", "--count-as", "sol:js", "--format", "json", "contracts"]
        )
        outJson = json.loads(out)
    except CalledProcessError as e:
        print(e.cmd)
        print(e.output)

    solidityFiles = [lang for lang in outJson if lang["Name"] == "JavaScript"][0]
    # pythonFiles = [lang for lang in outJson if lang["Name"] == "Python"][0]

    header = ["Module", "File", "Code", "Comments", "Total Lines", "Complexity / Line"]
    alignments = [":-----", ":----", "----:", "---:", "---:", "---:"]
    solidityTableLines = []
    for f in solidityFiles["Files"]:
        (path, _) = os.path.split(f["Location"])
        module = os.path.split(path)[1]
        if module == "mocks":
            continue
        elif module == "internal" or module == "external":
            (subpath, _) = os.path.split(module)
            if subpath != "":
                module = subpath

        solidityTableLines.append(
            [
                module.capitalize(),
                f["Filename"],
                str(f["Code"]),
                str(f["Comment"]),
                str(f["Lines"]),
                "{:0.1f}".format(f["Complexity"] / f["Code"] * 100),
            ]
        )

    print("|", "|".join(header), "|")
    print("|", "|".join(alignments), "|")
    for line in sorted(solidityTableLines):
        print("|", "|".join(line), "|")

def main():
    get_code_stats()
