import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'open_domains_bot';

let client;

async function getClient() {
  if (!uri) {
    throw new Error('MONGO_URI must be set in the environment.');
  }

  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }

  return client;
}

export async function getCollection(name) {
  const activeClient = await getClient();
  return activeClient.db(dbName).collection(name);
}
