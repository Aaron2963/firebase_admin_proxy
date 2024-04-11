import bcrypt from "bcrypt";

class Client {
  constructor(id, secret, scopes = []) {
    this.id = id;
    this.secret = secret;
    this.scopes = scopes;
  }

  authenticate(secret) {
    return bcrypt.compareSync(secret, this.secret);
  }
}

export default Client;