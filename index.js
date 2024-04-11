import { env } from "process";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import express from "express";
import winston from "winston";
import Client from "./model/client.js";
import Credential from "./credential.js";
import Auth from "./auth.js";
import Document from "./document.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keysPath = resolve(__dirname, "keys");
const privateKeyPath = resolve(
  __dirname,
  "keys",
  "firebase_admin_proxy_auth.key"
);
const app = express();
const projects = [];
const credentials = {};
const apps = {};
let auth;

const logger = winston.createLogger({
  // Log only if level is less than (meaning more severe) or equal to this
  level: "info",
  // Use timestamp and printf to create a standard log format
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  // Log to the console and a file
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/app.log" }),
  ],
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  //record user ip
  const ip = req.socket.remoteAddress;
  logger.info(`Received a ${req.method} request for ${req.url} from ${ip}`);
  next();
});

function init() {
  let config = readFileSync(resolve(__dirname, "config.json"), "utf-8");
  config = JSON.parse(config);
  // load projects
  config.projects.forEach((projectId) => {
    projects.push(projectId);
    credentials[projectId] = "";
  });
  // load oauth clients
  const clients = [];
  config.clients.forEach((client) => {
    const { id, secret, scopes } = client;
    clients.push(new Client(id, secret, scopes));
  });
  auth = new Credential(clients, readFileSync(privateKeyPath, "utf-8"));
  // load firebase credentials
  readdirSync(keysPath).forEach((file) => {
    const projectId = file.split(".")[0];
    credentials[projectId] = `${keysPath}/${file}`;
  });
  const port = config.port || 3000;
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

function authorize(req, res, next) {
  if (auth == null) {
    res.status(500).send("Auth not initialized");
    return;
  }
  try {
    const token = req.headers.authorization,
      projectId = req.headers["x-project-id"];
    if (!token) {
      throw new Error("Bearer token not found");
    }
    const parts = token.split(" ");
    if (parts.length !== 2) {
      throw new Error("Invalid token format");
    }
    const decoded = auth.authenticate(parts[1], projectId);
    if (!decoded) {
      throw new Error("Invalid token");
    }
    next();
  } catch (error) {
    console.log("authorize failed:", error);
    res.status(401).send("Unauthorized");
    return;
  }
}

app.post("/token", (req, res) => {
  const { client_id, client_secret, grant_type } = req.body;
  if (!client_id || !client_secret || !grant_type) {
    res.status(400).json({ error: "invalid_request" });
  }
  if (grant_type !== "client_credentials") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }
  try {
    const token = auth.issueToken(client_id, client_secret);
    res.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: 30 * 24 * 60 * 60,
    });
  } catch (error) {
    console.log("error", error);
    res.status(400).json({ error: "invalid_client" });
  }
});

app.post("/credentials", [authorize], (req, res) => {
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

app.get("/auth/user", [authorize, initializaApp], async (req, res) => {
  const users = await new Auth(apps[req.query.projectId]).listUsers();
  res.json(users);
});

app.get("/auth/user/:uid", [authorize, initializaApp], async (req, res) => {
  const user = await new Auth(apps[req.query.projectId]).getUser(
    req.params.uid
  );
  res.json(user);
});

app.post("/auth/user", [authorize, initializaApp], async (req, res) => {
  const { email, uid } = req.body;
  const userId = await new Auth(apps[req.query.projectId]).createUser(
    email,
    uid
  );
  res.json({ userId });
});

app.delete("/auth/user/:uid", [authorize, initializaApp], async (req, res) => {
  await new Auth(apps[req.query.projectId]).deleteUser(req.params.uid);
  res.status(204).send();
});

app.get(
  "/auth/custom-token/:uid",
  [authorize, initializaApp],
  async (req, res) => {
    const token = await new Auth(apps[req.query.projectId]).createCustomToken(
      req.params.uid
    );
    res.json({ token });
  }
);

app.post(
  "/auth/id-token/verify",
  [authorize, initializaApp],
  async (req, res) => {
    const { idToken } = req.body;
    try {
      const token = await new Auth(apps[req.query.projectId]).verifyIdToken(
        idToken
      );
      res.json(token);
    } catch (error) {
      res.status(401).send(error.message);
    }
  }
);

app.get("/fs/doc", [authorize, initializaApp], async (req, res) => {
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

app.post("/fs/doc", [authorize, initializaApp], async (req, res) => {
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
