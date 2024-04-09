const { getAuth } = require("firebase-admin/auth");

class Auth {
  static get auth() {
    return getAuth();
  }

  static async createUser(email, uid = "") {
    const params = { email };
    if (uid && uid.length > 0) {
      params.uid = uid;
    }
    const user = await this.auth.createUser(params);
    return user.uid;
  }

  static async deleteUser(uid) {
    await this.auth.deleteUser(uid);
  }

  static async getUser(uid) {
    console.log("uid", uid);
    const user = await this.auth.getUser(uid);
    return user.toJSON();
  }

  static async listUsers() {
    const users = await this.auth.listUsers();
    return users.users.map((user) => user.toJSON());
  }

  static async verifyIdToken(idToken) {
    const decodedToken = await this.auth.verifyIdToken(idToken);
    return decodedToken.toJSON();
  }
}

module.exports = Auth;