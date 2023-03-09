import sys
import os

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <web3bugs.dir>")
        exit(1)

    web3bugs_dir = sys.argv[1].strip()

    results_dir = os.path.join(web3bugs_dir, "results")

    contests_file = os.path.join(results_dir, "contests.csv")
    bugs_file = os.path.join(results_dir, "bugs.csv")

    contest2type = {}
    with open(contests_file) as f:
        for lid, line in enumerate(f):
            if lid == 0:
                continue

            data = line.strip().split(",")
            id = int(data[0])
            type_s = data[2].strip()
            if "(" in type_s:
                type_s = type_s.split("(")[0].strip()

            assert id not in contest2type
            contest2type[id] = type_s

    distribution = {}
    bug_types = set()
    with open(bugs_file) as f:
        for lid, line in enumerate(f):
            if lid == 0:
                continue

            data = line.strip().split(",")

            id = int(data[0])
            bug_type = data[2].strip().split("-")[0]
            if bug_type.startswith("L"):
                bug_type = "L"
            elif bug_type.startswith("O"):
                bug_type = "O"

            bug_types.add(bug_type)

            contest_type = contest2type[id]
            if contest_type not in distribution:
                distribution[contest_type] = {}

            if bug_type not in distribution[contest_type]:
                distribution[contest_type][bug_type] = 0
            distribution[contest_type][bug_type] += 1

    bug_types = list(bug_types)
    bug_types.sort()
    while not bug_types[0].startswith("S"):
        tmp = bug_types.pop(0)
        bug_types.append(tmp)

    contest_types = list(distribution.keys())
    contest_types.sort()

    title = "Categories"
    print(f"{title:25s}\t" + "\t".join(bug_types))
    for contest_type in contest_types:
        out = f"{contest_type:25s}"
        for bug_type in bug_types:
            if bug_type in distribution[contest_type]:
                out += f"\t{distribution[contest_type][bug_type]}"
            else:
                out += f"\t0"
        print(out)
