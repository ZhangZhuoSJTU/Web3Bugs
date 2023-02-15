const { execSync } = require("child_process");
const { writeFileSync } = require("fs");
const path = require("path");

const commitHash = execSync("git rev-parse HEAD", { encoding: "ascii" });
writeFileSync(path.join("artifacts", "version"), commitHash);
