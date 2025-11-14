from typing import Optional, List, Any

def list_by_uv(cursor, table: str, id_uv: Optional[int], join_table: Optional[str] = None, join_on: Optional[str] = None, order_by: Optional[str] = None) -> List[Any]:
    """Return rows from `table` filtered by `id_uv`.

    Logic:
    - If id_uv is None return empty list.
    - If `table` has column `id_uv` -> SELECT * FROM table WHERE id_uv=%s
    - Else, if join_table and join_on provided -> SELECT t.* FROM table t JOIN join_table j ON <join_on> WHERE j.id_uv=%s
    - Else -> return empty list

    NOTE: table/join_table names are expected to be constant strings (no user input) to avoid SQL injection.
    """
    if id_uv is None:
        return []

    # Check if table has id_uv column
    try:
        cursor.execute(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = 'id_uv'",
            (table,)
        )
        has_col = cursor.fetchone() is not None
    except Exception:
        has_col = False

    if has_col:
        sql = f"SELECT * FROM {table} WHERE id_uv = %s"
        if order_by:
            sql += f" ORDER BY {order_by}"
        cursor.execute(sql, (id_uv,))
        return cursor.fetchall() or []

    # If no id_uv column, try join
    if join_table and join_on:
        sql = f"SELECT t.* FROM {table} t JOIN {join_table} j ON {join_on} WHERE j.id_uv = %s"
        if order_by:
            sql += f" ORDER BY {order_by}"
        cursor.execute(sql, (id_uv,))
        return cursor.fetchall() or []

    return []
