import { program } from "commander";
import bcrypt from "bcrypt";

program.command('encrypt-password')
  .description('Encrypt a password')
  .argument('<password>', 'Password to encrypt')
  .action((password) => {
    const rs = bcrypt.hashSync(password, 10);
    console.log('Encrypted password:\n', rs);
  });

program.command('compare-password')
  .description('Compare a password with an encrypted password')
  .argument('<password>', 'Password to compare')
  .argument('<encryptedPassword>', 'Encrypted password')
  .action((password, encryptedPassword) => {
    const rs = bcrypt.compareSync(password, encryptedPassword);
    console.log('Password is correct:', rs);
  });

program.parse();
