/**
 * 健康检查 API - 用于诊断问题
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import { databasePoolOptions } from '../lib/db-config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 尝试连接数据库
    let dbStatus = 'not_tested';

    const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NO_SSL || process.env.DATABASE_URL;

    if (connectionString) {
        let pool: Pool | undefined;
        try {
            pool = new Pool({
                ...databasePoolOptions(connectionString),
                connectionTimeoutMillis: 5000,
            });

            await pool.query('SELECT NOW() as time');
            dbStatus = 'connected';
        } catch {
            dbStatus = 'error';
        } finally {
            try { await pool?.end(); } catch { dbStatus = 'error'; }
        }
    } else {
        dbStatus = 'no_connection_string';
    }

    const healthy = dbStatus === 'connected';
    return res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'unavailable',
        timestamp: new Date().toISOString(),
        database: {
            status: dbStatus,
        },
    });
}

