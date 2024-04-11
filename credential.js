import Client from "./model/client.js";
import jwt from "jsonwebtoken";

class Credential {
  /**
   *
   * @param {Client[]} clients
   */
  constructor(clients, privateKey) {
    this.privateKey = privateKey;
    this.clientMapping = {};
    clients.forEach((client) => {
      this.clientMapping[client.id] = client;
    });
  }

  issueToken(clientId, clientSecret) {
    const client = this.clientMapping[clientId];
    if (!client) {
      console.log("Invalid client ID");
      throw new Error("Invalid client ID");
    }
    if (!client.authenticate(clientSecret)) {
      console.log("Invalid client secret");
      throw new Error("Invalid client secret");
    }
    const jwtid = `${clientId}-${Date.now()}`;
    //TODO: cache jwtid
    const token = jwt.sign({ scope: client.scopes.join(' ') }, this.privateKey, {
      algorithm: "RS256",
      expiresIn: "30d",
      audience: clientId,
      subject: clientId,
      issuer: 'com.dearsoft.firebase-admin-proxy',
      jwtid,
    });
    return token;
  }

  authenticate(token, scope) {
    try {
      const decoded = jwt.verify(token, this.privateKey);
      if (scope && !decoded.scope.split(' ').includes(scope)) {
        return null;
      }
      return decoded;
    } catch (err) {
      return null;
    }
  }
}

export default Credential;
