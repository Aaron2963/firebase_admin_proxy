import { env } from "process";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import express from "express";
import Auth from "./auth.js";
import Document from "./document.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysPath = resolve(__dirname, "keys");
const port = 3000;
const app = express();
const projects = [];
const credentials = {};
const apps = {};

function init() {
  let config = readFileSync(resolve(__dirname, "config.json"), "utf-8");
  config = JSON.parse(config);
  config.projects.forEach((projectId) => {
    projects.push(projectId);
    credentials[projectId] = "";
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
  if (!projectId || !projects.includes(projectId)) {
    res.status(400).send("Project ID not found");
    return;
  }
  const key = credentials[projectId];
  if (!key || key.length === 0) {
    res.status(401).send("Credentials not found for project");
    return;
  }
  env.GOOGLE_APPLICATION_CREDENTIALS = key;
  if (!apps[projectId]) {
    apps[projectId] = initializeApp({
      credential: applicationDefault(),
    });
  }
  req.query.projectId = projectId;
  next();
}

app.post("/credentials", (req, res) => {
  const { key } = req.body;
  const projectId = req.headers["x-project-id"];
  if (!projectId || !projects.includes(projectId)) {
    res.status(400).send("Project ID not found");
    return;
  }
  const path = resolve(keysPath, `${projectId}.json`);
  try {
    const json = JSON.parse(key);
    writeFileSync(path, JSON.stringify(json, null, 2));
    credentials[projectId] = path;
    res.status(204).send();
  } catch (error) {
    console.log("error", error);
    res.status(400).send("Key must be a valid JSON");
  }
});

app.get("/user", initializaApp, async (req, res) => {
  const users = await new Auth(apps[req.query.projectId]).listUsers();
  res.json(users);
});

app.get("/user/:uid", initializaApp, async (req, res) => {
  const user = await new Auth(apps[req.query.projectId]).getUser(
    req.params.uid
  );
  res.json(user);
});

app.post("/user", initializaApp, async (req, res) => {
  const { email, uid } = req.body;
  const userId = await new Auth(apps[req.query.projectId]).createUser(
    email,
    uid
  );
  res.json({ userId });
});

app.delete("/user/:uid", initializaApp, async (req, res) => {
  await new Auth(apps[req.query.projectId]).deleteUser(req.params.uid);
  res.status(204);
});

app.get("/custom-token/:uid", initializaApp, async (req, res) => {
  const token = await new Auth(apps[req.query.projectId]).createCustomToken(
    req.params.uid
  );
  res.json({ token });
});

app.post("/id-token/verify", initializaApp, async (req, res) => {
  const { idToken } = req.body;
  try {
    const token = await new Auth(apps[req.query.projectId]).verifyIdToken(
      idToken
    );
    res.json(token);
  } catch (error) {
    res.status(401);
  }
});

app.get("/doc", initializaApp, async (req, res) => {
  try {
    const doc = await new Document(apps[req.query.projectId]).getDoc(
      req.query.path
    );
    res.json(doc);
  } catch (error) {
    console.log("error", error);
    res.status(404).send(error.message);
  }
});

app.post("/doc", initializaApp, async (req, res) => {
  try {
    await new Document(apps[req.query.projectId]).setDocument(
      req.query.path,
      req.body
    );
    res.status(204).send();
  } catch (error) {
    console.log("error", error);
    res.status(404).send(error.message);
  }
});

init();
