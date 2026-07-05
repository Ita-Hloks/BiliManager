import { execFileSync } from "node:child_process";

const protectedBranches = new Set(["master", "main"]);
const branch = execFileSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
}).trim();

if (protectedBranches.has(branch)) {
  console.error("");
  console.error("============ CHINESE VERSION =================");
  console.error(` 停！不要往 ${branch} 里直接提交代码！`);
  console.error(" 你需要创建一个新分支，然后根据你的修改命名");
  console.error(" 最后在 Github 上合并这个新分支");
  console.error("");
  console.error("============ ENGLISH VERSION =================");
  console.error("Commit stopped: protected branch");
  console.error(` Stop! Don't commit code directly to ${branch}! `);
  console.error(" You need to create a new branch and name it according to your modifications");
  console.error(" Finally merge this new branch on Github");
  console.error("");
  console.error("========================================");
  console.error("");
  process.exit(1);
}
