import { createHash, randomBytes } from "node:crypto";

const accessKey = `vfp_${randomBytes(32).toString("base64url")}`;
const accessKeyHash = createHash("sha256").update(accessKey).digest("hex");

process.stdout.write([
  "Personal Access Key baru (simpan di password manager dan masukkan sekali ke aplikasi):",
  accessKey,
  "",
  "Script Property yang harus disimpan di Apps Script:",
  `VINN_MOBILE_ACCESS_KEY_SHA256=${accessKeyHash}`,
  "",
  "Jangan simpan access key mentah di source, .env, screenshot, atau execution log.",
  "",
].join("\n"));
