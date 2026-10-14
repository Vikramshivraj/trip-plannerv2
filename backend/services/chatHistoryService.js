const db = require("../config/db");

let schemaPromise = null;

const ensureChatSchema = () => {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await db.promise().query(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY chat_conversations_user_updated (user_id, updated_at),
        CONSTRAINT chat_conversations_user_fk FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await db.promise().query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        conversation_id BIGINT UNSIGNED NOT NULL,
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY chat_messages_conversation_id (conversation_id, id),
        CONSTRAINT chat_messages_conversation_fk FOREIGN KEY (conversation_id)
          REFERENCES chat_conversations (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
};

const createConversation = async (userId) => {
  await ensureChatSchema();
  const [result] = await db.promise().query(
    "INSERT INTO chat_conversations (user_id) VALUES (?)",
    [userId]
  );
  return Number(result.insertId);
};

const assertConversationOwner = async (userId, conversationId) => {
  await ensureChatSchema();
  const [rows] = await db.promise().query(
    "SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?",
    [conversationId, userId]
  );
  return rows.length > 0;
};

const getRecentMessages = async (userId, conversationId, limit = 8) => {
  if (!(await assertConversationOwner(userId, conversationId))) return null;
  const [rows] = await db.promise().query(
    "SELECT role, content AS text FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
    [conversationId, Math.max(1, Math.min(limit, 20))]
  );
  return rows.reverse();
};

const loadConversation = async (userId, conversationId, limit = 50) => {
  if (!(await assertConversationOwner(userId, conversationId))) return null;
  const [rows] = await db.promise().query(
    "SELECT role, content AS text FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
    [conversationId, Math.max(1, Math.min(limit, 100))]
  );
  return rows.reverse();
};

const saveTurn = async (userId, conversationId, userText, assistantText) => {
  await ensureChatSchema();
  const connection = await db.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [owners] = await connection.query(
      "SELECT id FROM chat_conversations WHERE id = ? AND user_id = ? FOR UPDATE",
      [conversationId, userId]
    );
    if (!owners.length) throw new Error("Conversation not found or unauthorized.");
    await connection.query(
      "INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, 'user', ?), (?, 'assistant', ?)",
      [conversationId, userText, conversationId, assistantText]
    );
    await connection.query(
      "UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      [conversationId, userId]
    );
    await connection.query(
      "DELETE FROM chat_messages WHERE conversation_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 200) AS retained_messages)",
      [conversationId, conversationId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const saveAssistantMessage = async (userId, conversationId, content) => {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return;
  await ensureChatSchema();
  if (!(await assertConversationOwner(userId, conversationId))) return;
  await db.promise().query(
    "INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)",
    [conversationId, content]
  );
  await db.promise().query("UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [conversationId, userId]);
};

module.exports = {
  createConversation,
  assertConversationOwner,
  getRecentMessages,
  loadConversation,
  saveTurn,
  saveAssistantMessage,
};



