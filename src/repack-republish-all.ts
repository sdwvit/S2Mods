import { validMods } from "./base-paths.mts";
import { cmd, node } from "./cmd.mts";

import fs from "node:fs";

validMods.forEach((mod) => {
  cmd(["git", "checkout", mod].join(" "));
  const fn = `./zip${Date.now()}.mts`;
  fs.writeFileSync(fn, `import { createModZip } from "./zip.mts"; await createModZip();`);
  node(fn);
  fs.rmSync(fn);
  // spawnNode("./publish-modio.mts", { CHANGENOTE: "Initial release" });
});
