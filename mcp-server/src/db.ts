import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.LEARNHUB_DB_HOST ?? "127.0.0.1",
  port: Number(process.env.LEARNHUB_DB_PORT ?? 3306),
  user: process.env.LEARNHUB_DB_USER ?? "root",
  password: process.env.LEARNHUB_DB_PASSWORD ?? "LearnHub!23",
  database: process.env.LEARNHUB_DB_NAME ?? "learnhub",
  connectionLimit: 4,
  dateStrings: true,
});

/** Runs a query inside a READ ONLY transaction so nothing can be modified. */
export async function query(
  sql: string,
  params: unknown[] = []
): Promise<Record<string, unknown>[]> {
  const conn = await pool.getConnection();
  try {
    await conn.query("START TRANSACTION READ ONLY");
    const [rows] = await conn.query(sql, params);
    return rows as Record<string, unknown>[];
  } finally {
    try {
      await conn.query("ROLLBACK");
    } finally {
      conn.release();
    }
  }
}
