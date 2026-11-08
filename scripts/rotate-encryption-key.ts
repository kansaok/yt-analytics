import { prisma } from "@/lib/db/prisma";
import { decryptTokenPair, encryptionKeyVersion, encryptTokenPair } from "@/lib/crypto/tokens";

/** Putar seluruh grant ke ENCRYPTION_KEY_VERSION aktif. Kunci lama harus diisi saat skrip dijalankan. */
async function main() {
  const target = encryptionKeyVersion();
  const tokens = await prisma.oAuthToken.findMany();
  let rotated = 0;
  for (const token of tokens) {
    if (token.keyVersion === target) continue;
    const { accessToken, refreshToken } = decryptTokenPair(token);
    const result = await prisma.oAuthToken.updateMany({
      where: { id: token.id, keyVersion: token.keyVersion },
      data: encryptTokenPair(accessToken, refreshToken),
    });
    rotated += result.count;
  }
  console.log(JSON.stringify({ action: "rotate-encryption-key", targetVersion: target, rotated, total: tokens.length }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
