import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { query } from "./db.js";

const server = new McpServer({ name: "learnhub", version: "1.0.0" });

const asResult = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const asError = (e: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
});

function safe<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return asResult(await fn(args));
    } catch (e) {
      return asError(e);
    }
  };
}

server.tool(
  "list_tables",
  "List all tables in the LearnHub database with approximate row counts.",
  {},
  safe(async () =>
    query(
      "SELECT table_name AS tableName, table_rows AS approxRows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name"
    )
  )
);

server.tool(
  "describe_table",
  "Describe the columns of a LearnHub table.",
  { table: z.string().regex(/^[A-Za-z0-9_]+$/) },
  safe(async ({ table }: { table: string }) =>
    query(
      "SELECT column_name AS name, column_type AS type, is_nullable AS nullable, column_key AS keyType FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position",
      [table]
    )
  )
);

const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|truncate|replace|grant|revoke|call|do|handler|load|into|outfile|dumpfile|lock|set|sleep|benchmark)\b/i;

server.tool(
  "run_select_query",
  "Run a single read-only SELECT (or WITH ... SELECT) statement. Results are capped by `limit`.",
  {
    sql: z.string().min(1),
    limit: z.number().int().min(1).max(1000).default(100),
  },
  safe(async ({ sql, limit }: { sql: string; limit: number }) => {
    const text = sql.trim().replace(/;+\s*$/, "");
    if (text.includes(";")) throw new Error("Only a single statement is allowed.");
    if (!/^(select|with)\b/i.test(text)) throw new Error("Only SELECT/WITH statements are allowed.");
    if (FORBIDDEN.test(text)) throw new Error("Statement contains a forbidden keyword.");
    return query(`SELECT * FROM (${text}) AS q LIMIT ${Number(limit)}`);
  })
);

server.tool(
  "audit_refunds",
  "Find refunds that violate policy: refunded more than `max_days` days after purchase, or the student had completed more than `max_progress` percent of the course. One row per violating refunded course line.",
  {
    max_days: z.number().default(7),
    max_progress: z.number().default(30),
  },
  safe(async ({ max_days, max_progress }: { max_days: number; max_progress: number }) =>
    query(
      `SELECT r.id AS refundId, o.id AS orderId, o.student_id AS studentId, ol.course_id AS courseId,
              o.created_at AS purchasedAt, r.refunded_at AS refundedAt,
              TIMESTAMPDIFF(HOUR, o.created_at, r.refunded_at) / 24 AS daysAfterPurchase,
              r.amount AS amount,
              ROUND(100 * COALESCE(p.done, 0) / NULLIF(l.total, 0), 1) AS progressPercent
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       JOIN order_lines ol ON ol.order_id = o.id
       LEFT JOIN (SELECT course_id, COUNT(*) AS total FROM lessons GROUP BY course_id) l ON l.course_id = ol.course_id
       LEFT JOIN (SELECT student_id, course_id, COUNT(*) AS done FROM lesson_progress GROUP BY student_id, course_id) p
              ON p.student_id = o.student_id AND p.course_id = ol.course_id
       WHERE TIMESTAMPDIFF(HOUR, o.created_at, r.refunded_at) > ? * 24
          OR 100 * COALESCE(p.done, 0) / NULLIF(l.total, 0) > ?
       ORDER BY r.id`,
      [max_days, max_progress]
    )
  )
);

server.tool(
  "audit_coupon_usage",
  "Find coupon abuse: coupons used on more orders than max_uses, coupons whose used_count disagrees with orders, and students who used the same coupon more than once.",
  {},
  safe(async () => ({
    overLimit: await query(
      `SELECT c.code, c.max_uses AS maxUses, c.used_count AS usedCount, COUNT(o.id) AS ordersUsingCoupon
       FROM coupons c LEFT JOIN orders o ON o.coupon_code = c.code
       GROUP BY c.id HAVING COUNT(o.id) > c.max_uses OR COUNT(o.id) <> c.used_count`
    ),
    repeatUsers: await query(
      `SELECT coupon_code AS code, student_id AS studentId, COUNT(*) AS uses
       FROM orders WHERE coupon_code IS NOT NULL
       GROUP BY coupon_code, student_id HAVING COUNT(*) > 1 ORDER BY uses DESC`
    ),
  }))
);

server.tool(
  "instructor_payout",
  "Compute an instructor's payout for a month (YYYY-MM): 70% of net sales (order line final prices minus refunded orders), by order date.",
  {
    instructor_id: z.number().int(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  },
  safe(async ({ instructor_id, month }: { instructor_id: number; month: string }) =>
    query(
      `SELECT c.id AS courseId, c.title,
              COALESCE(SUM(ol.final_price), 0) AS grossSales,
              COALESCE(SUM(CASE WHEN o.status = 'Refunded' THEN ol.final_price END), 0) AS refundedSales,
              COALESCE(SUM(CASE WHEN o.status = 'Paid' THEN ol.final_price END), 0) AS netSales,
              ROUND(0.7 * COALESCE(SUM(CASE WHEN o.status = 'Paid' THEN ol.final_price END), 0), 2) AS payout
       FROM courses c
       LEFT JOIN order_lines ol ON ol.course_id = c.id
       LEFT JOIN orders o ON o.id = ol.order_id AND DATE_FORMAT(o.created_at, '%Y-%m') = ?
       WHERE c.instructor_id = ?
       GROUP BY c.id, c.title ORDER BY c.id`,
      [month, instructor_id]
    )
  )
);

server.tool(
  "get_course_summary",
  "Summary for one course: instructor, price, enrollments, paid revenue, refunded revenue, average rating.",
  { course_id: z.number().int() },
  safe(async ({ course_id }: { course_id: number }) =>
    query(
      `SELECT c.id, c.title, c.price, i.full_name AS instructor,
              (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS enrollments,
              (SELECT COALESCE(SUM(ol.final_price), 0) FROM order_lines ol JOIN orders o ON o.id = ol.order_id
                WHERE ol.course_id = c.id AND o.status = 'Paid') AS paidRevenue,
              (SELECT COALESCE(SUM(ol.final_price), 0) FROM order_lines ol JOIN orders o ON o.id = ol.order_id
                WHERE ol.course_id = c.id AND o.status = 'Refunded') AS refundedRevenue,
              (SELECT ROUND(AVG(stars), 2) FROM reviews WHERE course_id = c.id) AS avgStars
       FROM courses c JOIN instructors i ON i.id = c.instructor_id WHERE c.id = ?`,
      [course_id]
    )
  )
);

await server.connect(new StdioServerTransport());
console.error("LearnHub MCP server running on stdio");
