import process from "process";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import express from "express";
import https from "https";
import Client from "./model/client.js";
import OAuthCredentials from "./oauth-credentials.js";
import Auth from "./auth.js";
import Document from "./document.js";
import logger from "./logger.js";

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
const ipWhitelist = [];
const apps = {};
let auth;

// middleware: handle json and urlencoded data body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// middleware: log requests
app.use((req, res, next) => {
  const ip = req.socket.remoteAddress;
  logger.info(`Received a ${req.method} request for ${req.url} from ${ip}`);
  next();
});

// middleware: check ip whitelist
app.use((req, res, next) => {
  const ip = req.socket.remoteAddress;
  if (ipWhitelist.length === 0) next();
  let pass = false;
  ipWhitelist.forEach((allowed) => {
    const re = new RegExp(allowed);
    if (re.test(ip)) pass = true;
  });
  if (pass) {
    next();
    return;
  } else {
    logger.warn(`Unauthorized access from ${ip}`);
    res.status(401).send("Unauthorized");
    return;
  }
});

// middleware: initialize firebase app
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
  process.env.GOOGLE_APPLICATION_CREDENTIALS = key;
  if (!apps[projectId]) {
    apps[projectId] = initializeApp({
      credential: applicationDefault(),
    });
  }
  req.query.projectId = projectId;
  next();
}

// middleware: authorize requests
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
    res.status(401).json({ error: error.message });
    return;
  }
}

// handle exit
function exitHandler(options, exitCode) {
  if (options.exit) {
    logger.warn(`Shutting down server: ${exitCode}`);
    process.exit();
  }
}

function startHandler(port, isHttps) {
  if (isHttps) {
    logger.info(`Starting server on port ${port} with HTTPS`);
  } else {
    logger.info(`Starting server on port ${port} with HTTP`);
  }
  logger.info(`IP Whitelist: ${ipWhitelist}`);
}

// initialize the server
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
  auth = new OAuthCredentials(clients, readFileSync(privateKeyPath, "utf-8"));
  // load firebase credentials
  readdirSync(keysPath).forEach((file) => {
    const projectId = file.split(".")[0];
    credentials[projectId] = `${keysPath}/${file}`;
  });
  // load ip whitelist
  if (config.ipWhitelist && config.ipWhitelist.length > 0) {
    ipWhitelist.push(...config.ipWhitelist);
  }
  // handle exit
  process.stdin.resume();
  process.on("exit", exitHandler.bind(null, { cleanup: true }));
  process.on("SIGINT", exitHandler.bind(null, { exit: true }));
  process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
  process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));
  process.on("uncaughtException", exitHandler.bind(null, { exit: true }));
  // start server
  const port = config.port || 3000;
  try {
    const server = https.createServer(
      {
        key: readFileSync(config.ssl.key),
        cert: readFileSync(config.ssl.cert),
      },
      app
    );
    server.listen(port, () => startHandler(port, true));
  } catch (error) {
    logger.warn(`Failed to start server with HTTPS: ${error.message}`);
    app.listen(port, () => startHandler(port, false));
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
    res.status(400).json({ error: "Key must be a valid JSON" });
  }
});

app.get("/auth/user", [authorize, initializaApp], async (req, res) => {
  const users = await new Auth(apps[req.query.projectId]).listUsers();
  res.json(users);
});

app.get("/auth/user/:uid", [authorize, initializaApp], async (req, res) => {
  try {
    const user = await new Auth(apps[req.query.projectId]).getUser(
      req.params.uid
    );
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.post("/auth/user", [authorize, initializaApp], async (req, res) => {
  const { email, uid } = req.body;
  const userId = await new Auth(apps[req.query.projectId]).createUser(
    email,
    uid
  );
  res.status(201).json({ uid: userId });
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
      res.status(401).json({ error: error.message });
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
    res.status(404).json({ error: error.message });
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
    res.status(404).json({ error: error.message });
  }
});

init();
