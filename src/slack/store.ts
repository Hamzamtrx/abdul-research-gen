import { MongoClient, Collection } from "mongodb";
import type { SlackHistoryEntry, SlackConversationState } from "./types";

const DEFAULT_DB_NAME = "claude";
const DEFAULT_COLLECTION = "slack_threads";

type PersistedSlackConversation = {
  threadTs: string;
  channel: string;
  outputDir: string;
  history: SlackHistoryEntry[];
  knownFiles: string[];
  downloadedFileIds: string[];
  downloadedFilePaths: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

let mongoClient: MongoClient | null = null;
let collection: Collection<PersistedSlackConversation> | null = null;
let connectionPromise: Promise<void> | null = null;

function getMongoUri(): string | undefined {
  const { MONGO_URI } = process.env;
  return MONGO_URI?.trim() || undefined;
}

export function isSlackPersistenceEnabled(): boolean {
  return Boolean(getMongoUri());
}

async function ensureConnection(logger?: Console): Promise<void> {
  if (collection) {
    return;
  }
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = getMongoUri();
  if (!uri) {
    throw new Error("MONGO_URI is not configured; Slack persistence disabled.");
  }

  connectionPromise = (async () => {
    console.log("[MongoDB] Connecting to MongoDB for Slack persistence...");
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    console.log("[MongoDB] Successfully connected to MongoDB!");

    const dbName = process.env.MONGO_DB_NAME?.trim() || DEFAULT_DB_NAME;
    const db = mongoClient.db(dbName);
    const collectionName =
      process.env.MONGO_SLACK_COLLECTION?.trim() || DEFAULT_COLLECTION;

    console.log(`[MongoDB] Using database: "${dbName}", collection: "${collectionName}"`);

    collection = db.collection<PersistedSlackConversation>(collectionName);
    await collection.createIndex({ threadTs: 1 }, { unique: true });
    console.log("[MongoDB] Created index on threadTs field.");
    
    // Verify connection by counting documents
    const count = await collection.countDocuments();
    console.log(`[MongoDB] Slack persistence enabled. Found ${count} existing thread(s).`);
  })();

  try {
    await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    console.error("[MongoDB] Failed to connect to MongoDB for Slack persistence:", error);
    logger?.error?.("Failed to connect to MongoDB for Slack persistence:", error);
    throw error;
  }
}

export async function loadSlackThread(
  threadTs: string,
  logger?: Console,
): Promise<PersistedSlackConversation | null> {
  if (!isSlackPersistenceEnabled()) {
    return null;
  }
  await ensureConnection(logger);
  if (!collection) {
    return null;
  }
  const result = await collection.findOne({ threadTs });
  if (result) {
    console.log(`[MongoDB] Loaded thread ${threadTs} from database (${result.history.length} messages).`);
  } else {
    console.log(`[MongoDB] Thread ${threadTs} not found in database (new conversation).`);
  }
  return result;
}

export async function saveSlackThread(
  state: SlackConversationState,
  logger?: Console,
): Promise<void> {
  if (!isSlackPersistenceEnabled()) {
    return;
  }
  await ensureConnection(logger);
  if (!collection) {
    return;
  }

  const doc: PersistedSlackConversation = {
    threadTs: state.threadTs,
    channel: state.channel,
    outputDir: state.outputDir,
    history: state.history,
    knownFiles: Array.from(state.knownFiles ?? []),
    downloadedFileIds: Array.from(state.downloadedFileIds ?? []),
    downloadedFilePaths: Object.fromEntries(
      state.downloadedFilePaths ? Array.from(state.downloadedFilePaths.entries()) : [],
    ),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.updateOne(
    { threadTs: state.threadTs },
    {
      $set: {
        channel: doc.channel,
        outputDir: doc.outputDir,
        history: doc.history,
        knownFiles: doc.knownFiles,
        downloadedFileIds: doc.downloadedFileIds,
        downloadedFilePaths: doc.downloadedFilePaths,
        updatedAt: doc.updatedAt,
      },
      $setOnInsert: { createdAt: doc.createdAt, threadTs: doc.threadTs },
    },
    { upsert: true },
  );

  console.log(
    `[MongoDB] Saved thread ${state.threadTs} to database. ` +
    `(matched: ${result.matchedCount}, modified: ${result.modifiedCount}, upserted: ${result.upsertedCount})`,
  );
}

export async function testMongoConnection(): Promise<void> {
  if (!isSlackPersistenceEnabled()) {
    throw new Error("MongoDB persistence is not enabled (MONGO_URI not set)");
  }
  
  await ensureConnection();
  
  if (!mongoClient) {
    throw new Error("Failed to establish MongoDB connection");
  }
  
  // Test the connection by running a ping command
  await mongoClient.db("admin").command({ ping: 1 });
  console.log("[MongoDB] Connection test successful!");
}

export async function closeSlackStore(): Promise<void> {
  if (mongoClient) {
    console.log("[MongoDB] Closing MongoDB connection...");
    await mongoClient.close();
    mongoClient = null;
    collection = null;
    connectionPromise = null;
    console.log("[MongoDB] Connection closed.");
  }
}

