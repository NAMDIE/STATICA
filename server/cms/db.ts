import { Pool } from 'pg'

export interface DbResult<Row = Record<string, unknown>> {
  rows: Row[]
  rowCount: number
}

export interface DbClient {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<DbResult<Row>>
}

export function createPgPool(connectionString: string): DbClient {
  const pool = new Pool({ connectionString })
  return {
    async query<Row = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<DbResult<Row>> {
      const result = await pool.query(sql, params)
      return { rows: result.rows as Row[], rowCount: result.rowCount ?? 0 }
    },
  }
}
