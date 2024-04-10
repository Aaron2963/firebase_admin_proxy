import { env } from "process";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import server from "bunrest";
import Auth from "./auth.js";
import clients from "./assets/clients.json";
import { readdirSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysPath = resolve(__dirname, "keys");
const port = 3000;
const app = server();
const projects = {};
const credentials = {};

function init() {
  clients.forEach((client) => {
    projects[client.projectId] = client;
    credentials[client.projectId] = "";
  });
  readdirSync(keysPath).forEach((file) => {
    const projectId = file.split(".")[0];
    credentials[projectId] = `${keysPath}/${file}`;
  });
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

function initializaApp(req, res, next) {
  const projectId = req.headers["x-project-id"];
  if (!projectId || !projects[projectId]) {
    res.status(400).send("Project ID not found");
    return;
  }
  const key = credentials[projectId];
  if (!key || key.length === 0) {
    res.status(401).send("Credentials not found for project");
    return;
  }
  env.GOOGLE_APPLICATION_CREDENTIALS = key;
  initializeApp({
    credential: applicationDefault(),
  });
  next();
}

app.post("/credentials", (req, res) => {
  const { key } = req.body;
  const projectId = req.headers["x-project-id"];
  if (!projectId || !projects[projectId]) {
    res.status(400).send("Project ID not found");
    return;
  }
  const path = resolve(keysPath, `${projectId}.json`)
  try {
    const json = JSON.parse(key);
    writeFileSync(path, JSON.stringify(json, null, 2));
    credentials[projectId] = path;
    res.status(204).send();
  } catch (error) {
    console.log('error', error)
    res.status(400).send("Key must be a valid JSON");
  }
});

app.get("/user", initializaApp, async (req, res) => {
  const users = await Auth.listUsers();
  res.json(users);
});

app.get("/user/:uid", initializaApp, async (req, res) => {
  const user = await Auth.getUser(req.params.uid);
  res.json(user);
});

app.post("/user", initializaApp, async (req, res) => {
  const { email, uid } = req.body;
  const userId = await Auth.createUser(email, uid);
  res.json({ userId });
});

app.delete("/user/:uid", initializaApp, async (req, res) => {
  await Auth.deleteUser(req.params.uid);
  res.status(204);
});

app.get("/custom-token/:uid", initializaApp, async (req, res) => {
  const token = await Auth.createCustomToken(req.params.uid);
  res.json({ token });
});

app.post("/id-token/verify", initializaApp, async (req, res) => {
  const { idToken } = req.body;
  try {
    const token = await Auth.verifyIdToken(idToken);
    res.json(token);
  } catch (error) {
    res.status(401);
  }
});

init();
