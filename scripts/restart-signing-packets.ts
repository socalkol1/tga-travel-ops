import { restartLegacySigningPackets } from "@/modules/documents/service";

async function main() {
  const restarted = await restartLegacySigningPackets();
  console.log(`Restarted ${restarted} legacy signing packet(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
