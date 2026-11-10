/**
 * PostgreSQL 数据库模块
 * 使用 pg 库连接 Vercel Postgres (Neon)
 */

import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { databasePoolOptions } from './db-config';

// 获取数据库连接字符串
function getConnectionString(): string {
  // Vercel Postgres / Neon 使用不同的环境变量名
  const url = process.env.POSTGRES_URL
    || process.env.POSTGRES_URL_NO_SSL
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL;

  if (!url) {
    throw new Error('数据库连接字符串未配置');
  }
  return url;
}

// 创建连接池（延迟初始化）
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
    pool = new Pool({
      ...databasePoolOptions(connectionString),
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    // 监听连接错误
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }
  return pool;
}

// 标记是否已初始化表
let tablesInitialized = false;

/**
 * 执行 SQL 查询
 */
async function query(text: string, params?: any[]): Promise<any> {
  const p = getPool();
  try {
    const result = await p.query(text, params);
    return result;
  } catch (error: any) {
    console.error('Database query error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      query: text.substring(0, 100),
    });
    throw error;
  }
}

/**
 * 初始化数据库表
 */
async function initTables(): Promise<void> {
  if (tablesInitialized) return;

  console.log('Initializing database tables...');

  try {
    // 用户表
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 错题表
    await query(`
      CREATE TABLE IF NOT EXISTS mistakes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        image_data TEXT NOT NULL,
        analysis TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        sync_status TEXT DEFAULT 'synced'
      )
    `);

    // 搜索历史表
    await query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        subject TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 学习进度表
    await query(`
      CREATE TABLE IF NOT EXISTS study_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        mastery_level INTEGER DEFAULT 0,
        times_studied INTEGER DEFAULT 0,
        times_correct INTEGER DEFAULT 0,
        times_wrong INTEGER DEFAULT 0,
        last_studied_at TIMESTAMPTZ,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, subject, topic)
      )
    `);

    // AI导师会话表
    await query(`
      CREATE TABLE IF NOT EXISTS tutor_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        topic TEXT,
        session_type TEXT DEFAULT 'learn',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 对话消息表
    await query(`
      CREATE TABLE IF NOT EXISTS tutor_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'chat',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    tablesInitialized = true;
    console.log('Database tables initialized successfully');
  } catch (error: any) {
    console.error('Failed to initialize tables:', error.message);
    throw error;
  }
}

/**
 * 数据库操作类 - 提供统一的数据库访问接口
 */
class Database {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initTables();
      this.initialized = true;
    }
  }

  // ============ 用户相关 ============

  async getUserByUsername(username: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  async getUserById(id: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  async createUser(id: string, username: string, passwordHash: string): Promise<void> {
    await this.ensureInitialized();
    await query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
      [id, username, passwordHash]
    );
  }

  // ============ 错题相关 ============

  async getMistakes(userId: string, subject?: string, limit = 20, offset = 0): Promise<any[]> {
    await this.ensureInitialized();
    if (subject) {
      const result = await query(
        'SELECT * FROM mistakes WHERE user_id = $1 AND subject = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
        [userId, subject, limit, offset]
      );
      return result.rows;
    }
    const result = await query(
      'SELECT * FROM mistakes WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows;
  }

  async getMistakeById(id: string, userId: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query('SELECT * FROM mistakes WHERE id = $1 AND user_id = $2', [id, userId]);
    return result.rows[0];
  }

  async getMistakesCount(userId: string, subject?: string): Promise<number> {
    await this.ensureInitialized();
    if (subject) {
      const result = await query('SELECT COUNT(*) as count FROM mistakes WHERE user_id = $1 AND subject = $2', [userId, subject]);
      return parseInt(result.rows[0].count);
    }
    const result = await query('SELECT COUNT(*) as count FROM mistakes WHERE user_id = $1', [userId]);
    return parseInt(result.rows[0].count);
  }

  async getMistakesStats(userId: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN subject = 'math' THEN 1 END) as math,
        COUNT(CASE WHEN subject = 'physics' THEN 1 END) as physics,
        COUNT(CASE WHEN subject = 'chemistry' THEN 1 END) as chemistry,
        COUNT(CASE WHEN subject = 'chinese' THEN 1 END) as chinese,
        COUNT(CASE WHEN subject = 'english' THEN 1 END) as english,
        COUNT(CASE WHEN subject = 'politics' THEN 1 END) as politics
      FROM mistakes WHERE user_id = $1
    `, [userId]);
    return result.rows[0];
  }

  async createMistake(id: string, userId: string, subject: string, imageData: string, analysis: string, tags: string): Promise<void> {
    await this.ensureInitialized();
    await query(
      'INSERT INTO mistakes (id, user_id, subject, image_data, analysis, tags) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, userId, subject, imageData, analysis, tags]
    );
  }

  async deleteMistake(id: string): Promise<void> {
    await this.ensureInitialized();
    await query('DELETE FROM mistakes WHERE id = $1', [id]);
  }

  // ============ 搜索历史 ============

  async getSearchHistory(userId: string, limit = 20): Promise<any[]> {
    await this.ensureInitialized();
    const result = await query(
      'SELECT * FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  }

  async createSearchHistory(id: string, userId: string, queryText: string, subject: string | null): Promise<void> {
    await this.ensureInitialized();
    await query(
      'INSERT INTO search_history (id, user_id, query, subject) VALUES ($1, $2, $3, $4)',
      [id, userId, queryText, subject]
    );
  }

  async clearSearchHistory(userId: string): Promise<void> {
    await this.ensureInitialized();
    await query('DELETE FROM search_history WHERE user_id = $1', [userId]);
  }

  // ============ 学习进度 ============

  async getStudyProgress(userId: string, subject?: string): Promise<any[]> {
    await this.ensureInitialized();
    if (subject) {
      const result = await query(
        'SELECT * FROM study_progress WHERE user_id = $1 AND subject = $2 ORDER BY mastery_level ASC',
        [userId, subject]
      );
      return result.rows;
    }
    const result = await query(
      'SELECT * FROM study_progress WHERE user_id = $1 ORDER BY mastery_level ASC',
      [userId]
    );
    return result.rows;
  }

  async getWeakTopics(userId: string, subject: string, limit = 10): Promise<string[]> {
    await this.ensureInitialized();
    const result = await query(
      'SELECT topic FROM study_progress WHERE user_id = $1 AND subject = $2 AND mastery_level < 60 ORDER BY mastery_level ASC LIMIT $3',
      [userId, subject, limit]
    );
    return result.rows.map((r: any) => r.topic);
  }

  // ============ AI导师会话 ============

  async getTutorSession(sessionId: string, userId: string): Promise<any> {
    await this.ensureInitialized();
    const result = await query(
      'SELECT * FROM tutor_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    return result.rows[0];
  }

  async createTutorSession(id: string, userId: string, subject: string, topic: string | null, sessionType: string): Promise<void> {
    await this.ensureInitialized();
    await query(
      `INSERT INTO tutor_sessions (id, user_id, subject, topic, session_type, status) VALUES ($1, $2, $3, $4, $5, 'active')`,
      [id, userId, subject, topic, sessionType]
    );
  }

  async getTutorMessages(sessionId: string, limit = 10): Promise<any[]> {
    await this.ensureInitialized();
    const result = await query(
      'SELECT * FROM tutor_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2',
      [sessionId, limit]
    );
    return result.rows;
  }

  async createTutorMessage(id: string, sessionId: string, role: string, content: string, messageType: string): Promise<void> {
    await this.ensureInitialized();
    await query(
      'INSERT INTO tutor_messages (id, session_id, role, content, message_type) VALUES ($1, $2, $3, $4, $5)',
      [id, sessionId, role, content, messageType]
    );
  }
}

// 单例数据库实例
const db = new Database();

/**
 * 获取数据库实例
 */
export function getDatabase(): Database {
  return db;
}

/**
 * 生成 UUID
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
