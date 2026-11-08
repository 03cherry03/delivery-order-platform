import db from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const result = db.prepare(
    "SELECT sqlite_version() AS version"
  ).get();

  return Response.json({
    message: "DB 연결 성공",
    sqliteVersion: result.version
  });
}