import sys
import os

NO_CONTRACT = set(["11", "50"])

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <web3bugs_dir>")
        exit(1)

    web3bugs_dir = sys.argv[1].strip()

    report_dir = os.path.join(web3bugs_dir, "reports")
    contract_dir = os.path.join(web3bugs_dir, "contracts")

    all_reports = os.listdir(report_dir)
    all_contests = os.listdir(contract_dir)

    all_pass = True

    for report in all_reports:
        if not report.endswith(".md"):
            print(f"Invalid report name: {report}")
            exit(1)

        contest_id = report[:-3]

        if contest_id in NO_CONTRACT:
            continue

        if contest_id not in all_contests:
            print(f"Missing contract code: {contest_id}")
            all_pass = False

    for contest_id in all_contests:
        contest_dir = os.path.join(contract_dir, contest_id)

        find_sol = False
        for root, dirs, files in os.walk(contest_dir):
            for file_name in files:
                if file_name.endswith(".sol"):
                    find_sol = True
                    break

            if find_sol:
                break

        if not find_sol:
            print(f"No solidity file found: {contest_dir}")
            all_pass = False

    if all_pass:
        print(f"Check passed!\n\n\t`{contract_dir}` is consistant with `{report_dir}`")
    else:
        exit(1)
