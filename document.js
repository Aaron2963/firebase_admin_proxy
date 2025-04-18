import { getFirestore } from "firebase-admin/firestore";

class Document {
  constructor(firebaseApp) {
    this.app = firebaseApp;
    this.db = getFirestore(firebaseApp);
  }

  async getCollection(path) {
    const ref = this.db.collection(path);
    const snapshot = await ref.get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async getDoc(path) {
    const ref = this.db.doc(path);
    const doc = await ref.get();
    return doc.data();
  }

  async setDocument(path, data) {
    const ref = this.db.doc(path);
    await ref.set(data);
  }

  async deleteDocument(path) {
    const ref = this.db.doc(path);
    await ref.delete();
  }

  async queryCollectionWhere(collectionPath, field, operator, value) {
    const ref = this.db.collection(collectionPath);
    const snapshot = await ref.where(field, operator, value).get();
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map((doc) => doc.data());
  }
}

export default Document;
