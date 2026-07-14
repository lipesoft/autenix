const bcrypt = require("bcryptjs");

const senha = process.argv.slice(2).join(" ");
const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

if (!senha) {
  console.error("Uso: npm run hash:password -- sua-senha-forte");
  process.exit(1);
}

bcrypt
  .hash(senha, rounds)
  .then((hash) => {
    console.log(hash);
  })
  .catch((err) => {
    console.error("Erro ao gerar hash:", err.message);
    process.exit(1);
  });
