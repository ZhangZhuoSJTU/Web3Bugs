import sys
import os

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <web3bugs.dir>")
        exit(1)

    web3bugs_dir = sys.argv[1].strip()

    report_dir = os.path.join(web3bugs_dir, "reports")
    contest_csv = os.path.join(web3bugs_dir, "results/contests.csv")

    all_reports = os.listdir(report_dir)
    all_contests = set()
    all_pass = True

    with open(contest_csv) as f:
        for lid, line in enumerate(f):
            if lid == 0:
                continue

            contest_id = line.split(",")[0].strip()
            if f"{contest_id}.md" not in all_reports:
                print(f"Additional contest in contests.csv: {contest_id}.md")
                all_pass = False

            all_contests.add(f"{contest_id}.md")

    for report in all_reports:
        if report not in all_contests:
            print(f"Missing contest in contests.csv: {report}")
            all_pass = False

    if all_pass:
        print(f"Check passed!\n\n\t`{contest_csv}` is consistant with `{report_dir}`")
    else:
        exit(1)
