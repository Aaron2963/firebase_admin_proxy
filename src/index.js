const process = require("process");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { resolve } = require("path");
const { program } = require("commander");
const fs = require("fs");
const Auth = require("./auth.js");

const storagePath = resolve(__dirname, "config.json");

function init() {
  let config = fs.readFileSync(storagePath, "utf8");
  if (!config) {
    throw new Error("Please set the credential path by running credentials <path>");
  }
  config = JSON.parse(config);
  if (!config.credentialPath) {
    throw new Error("Please set the credential path by running credentials <path>");
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = config.credentialPath;
  initializeApp({
    credential: applicationDefault(),
  });
}

program
  .command('credentials <path>')
  .description('Set the credential key path')
  .action((path) => {
    fs.writeFileSync(storagePath, JSON.stringify({ credentialPath: path }));
  });

program
  .command("getUser <uid>")
  .description("Get user by uid")
  .action(async (uid) => {
    init();
    const user = await Auth.getUser(uid);
    console.log(user);
  });

program
  .command("listUsers")
  .description("List all users")
  .action(async () => {
    init();
    const users = await Auth.listUsers();
    console.log(users);
  });

program
  .command("createUser <email> [uid]")
  .description("Create a user")
  .action(async (email, uid) => {
    init();
    const userId = await Auth.createUser(email, uid);
    console.log(userId);
  });

program
  .command("deleteUser <uid>")
  .description("Delete a user")
  .action(async (uid) => {
    init();
    await Auth.deleteUser(uid);
    console.log("User deleted");
  });

program
  .command("verifyIdToken <idToken>")
  .description("Verify an id token")
  .action(async (idToken) => {
    init();
    const decodedToken = await Auth.verifyIdToken(idToken);
    console.log(decodedToken);
  });

program.parse();
