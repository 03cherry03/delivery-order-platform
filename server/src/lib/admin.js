export const ACTIVE_RESTRICTION_SQL = (alias = "r") => `${alias}.RSTR_TYPE_CD = 'REVIEW_WRITE'
  AND (${alias}.RSTR_END_DTTM IS NULL OR ${alias}.RSTR_END_DTTM > datetime('now', 'localtime'))`;

export const CANCELABLE_ORDER_STATES = ["WAIT", "COOKING", "READY", "DELIVERING"];
