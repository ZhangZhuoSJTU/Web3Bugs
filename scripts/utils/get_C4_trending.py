import sys
import os

if __name__ == "__main__":
    if len(sys.argv) != 2 and len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <web3bugs.dir> [window.size]")
        exit(1)

    if len(sys.argv) == 3:
        window_size = int(sys.argv[2])
    else:
        window_size = 3

    web3bugs_dir = sys.argv[1].strip()
    results_dir = os.path.join(web3bugs_dir, "results")
    contests_file = os.path.join(results_dir, "contests.csv")

    dates = set()
    wardens = {}
    awards = {}

    with open(contests_file) as f:
        for lid, line in enumerate(f):
            if lid == 0:
                continue  # title line

            data = list(map(lambda s: s.strip(), line.split(",")))

            award = int(data[3][1:])
            warden = int(data[4])
            date = data[5]

            dates.add(date)

            if date not in awards:
                awards[date] = []
            awards[date].append(award)

            if date not in wardens:
                wardens[date] = []
            wardens[date].append(warden)

    dates = list(dates)
    dates.sort()

    left_half_window_size = window_size // 2
    right_half_window_size = window_size // 2 + window_size % 2

    ave_awards = []
    ave_wardens = []

    for id, date in enumerate(dates):
        warden_rv = []
        award_rv = []

        id_lb = max(id - left_half_window_size, 0)
        id_ub = min(id + right_half_window_size, len(dates))

        for sub_id in range(id_lb, id_ub):
            warden_rv.extend(wardens[dates[sub_id]])
            award_rv.extend(awards[dates[sub_id]])

        ave_wardens.append(f"{sum(warden_rv) / len(warden_rv): 10.2f}")
        ave_awards.append(f"{sum(award_rv) / len(award_rv): 10.2f}")

    print("\t".join(map(lambda x: f"{x:>10s}", dates)))
    print("\t".join(ave_wardens))
    print("\t".join(ave_awards))
