/**
 * ==============================================================================
 * SQL Utilities Module
 * ==============================================================================
 * 
 * Provides utilities for safe SQL query construction and identifier handling
 * to prevent SQL injection attacks.
 * 
 * @module sql-utils
 */

/**
 * Regex pattern for validating SQL identifiers
 * Only allows alphanumeric characters, underscores, and must start with letter or underscore
 */
const VALID_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Maximum length for SQL identifiers (PostgreSQL limit)
 */
const MAX_IDENTIFIER_LENGTH = 63;

/**
 * Reserved SQL keywords that should not be used as identifiers
 */
const RESERVED_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'DROP',
  'CREATE', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'FUNCTION',
  'TRIGGER', 'PROCEDURE', 'AND', 'OR', 'NOT', 'NULL',
  'TRUE', 'FALSE', 'IS', 'IN', 'BETWEEN', 'LIKE', 'ILIKE',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
  'UNION', 'INTERSECT', 'EXCEPT', 'DISTINCT', 'ALL',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS',
  'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
]);

/**
 * Validates a SQL identifier (table name, column name, etc.)
 * Throws an error if the identifier is invalid
 * 
 * @param identifier - The identifier to validate
 * @throws Error if identifier is invalid
 * 
 * @example
 * ```typescript
 * validateIdentifier('users'); // OK
 * validateIdentifier('user_data'); // OK
 * validateIdentifier('123users'); // Throws: Invalid SQL identifier
 * validateIdentifier('user-data'); // Throws: Invalid SQL identifier
 * validateIdentifier('SELECT'); // Throws: Invalid SQL identifier
 * ```
 */
export function validateIdentifier(identifier: string): void {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error(`Invalid SQL identifier: ${identifier} (must be a non-empty string)`);
  }

  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(
      `Invalid SQL identifier: ${identifier} (exceeds maximum length of ${MAX_IDENTIFIER_LENGTH})`
    );
  }

  if (!VALID_IDENTIFIER_REGEX.test(identifier)) {
    throw new Error(
      `Invalid SQL identifier: ${identifier} (must start with letter or underscore, contain only alphanumeric characters and underscores)`
    );
  }

  const upperIdentifier = identifier.toUpperCase();
  if (RESERVED_KEYWORDS.has(upperIdentifier)) {
    throw new Error(
      `Invalid SQL identifier: ${identifier} (is a reserved SQL keyword)`
    );
  }
}

/**
 * Escapes a SQL identifier by wrapping it in double quotes and escaping any double quotes
 * This is the standard PostgreSQL identifier escaping method
 * 
 * @param identifier - The identifier to escape
 * @returns The escaped identifier
 * 
 * @example
 * ```typescript
 * escapeIdentifier('user_name'); // Returns: "user_name"
 * escapeIdentifier('user"name'); // Returns: "user""name"
 * ```
 */
export function escapeIdentifier(identifier: string): string {
  validateIdentifier(identifier);
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Escapes a SQL string literal by wrapping it in single quotes and escaping any single quotes
 * 
 * WARNING: This function is provided for reference only.
 * Parameterized queries should be used instead to prevent SQL injection.
 * 
 * @param literal - The string literal to escape
 * @returns The escaped string literal
 * 
 * @example
 * ```typescript
 * escapeLiteral("John's data"); // Returns: 'John''s data'
 * ```
 */
export function escapeLiteral(literal: string): string {
  if (typeof literal !== 'string') {
    throw new Error(`Invalid SQL literal: ${literal} (must be a string)`);
  }
  return `'${literal.replace(/'/g, "''")}'`;
}

/**
 * Validates and escapes a table name
 * 
 * @param tableName - The table name to validate and escape
 * @returns The escaped table name
 */
export function escapeTableName(tableName: string): string {
  validateIdentifier(tableName);
  return escapeIdentifier(tableName);
}

/**
 * Validates and escapes a column name
 * 
 * @param columnName - The column name to validate and escape
 * @returns The escaped column name
 */
export function escapeColumnName(columnName: string): string {
  validateIdentifier(columnName);
  return escapeIdentifier(columnName);
}

/**
 * Validates and escapes an index name
 * 
 * @param indexName - The index name to validate and escape
 * @returns The escaped index name
 */
export function escapeIndexName(indexName: string): string {
  validateIdentifier(indexName);
  return escapeIdentifier(indexName);
}

/**
 * Validates and escapes a function name
 * 
 * @param functionName - The function name to validate and escape
 * @returns The escaped function name
 */
export function escapeFunctionName(functionName: string): string {
  validateIdentifier(functionName);
  return escapeIdentifier(functionName);
}

/**
 * Builds a qualified identifier (schema.table or table.column)
 * 
 * @param parts - The parts of the qualified identifier
 * @returns The escaped qualified identifier
 * 
 * @example
 * ```typescript
 * buildQualifiedName(['public', 'users']); // Returns: "public"."users"
 * buildQualifiedName(['users', 'user_id']); // Returns: "users"."user_id"
 * buildQualifiedName(['public', 'users', 'user_id']); // Returns: "public"."users"."user_id"
 * ```
 */
export function buildQualifiedName(parts: string[]): string {
  if (!parts || parts.length === 0) {
    throw new Error('Qualified identifier must have at least one part');
  }

  return parts.map((part) => escapeIdentifier(part)).join('.');
}

/**
 * Validates a list of identifiers
 * 
 * @param identifiers - The identifiers to validate
 * @throws Error if any identifier is invalid
 */
export function validateIdentifiers(identifiers: string[]): void {
  if (!Array.isArray(identifiers)) {
    throw new Error('Identifiers must be an array');
  }

  identifiers.forEach((identifier, index) => {
    try {
      validateIdentifier(identifier);
    } catch (error) {
      throw new Error(
        `Invalid SQL identifier at index ${index}: ${identifier}. ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Sanitizes an ORDER BY clause to prevent SQL injection
 * Only allows valid column names and direction keywords
 * 
 * @param column - The column name to order by
 * @param direction - The sort direction (ASC or DESC)
 * @returns The sanitized ORDER BY clause
 * 
 * @example
 * ```typescript
 * sanitizeOrderBy('created_at', 'DESC'); // Returns: "created_at" DESC
 * ```
 */
export function sanitizeOrderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): string {
  validateIdentifier(column);
  
  const upperDirection = direction.toUpperCase();
  if (upperDirection !== 'ASC' && upperDirection !== 'DESC') {
    throw new Error(`Invalid ORDER BY direction: ${direction} (must be ASC or DESC)`);
  }
  
  return `${escapeIdentifier(column)} ${upperDirection}`;
}

/**
 * Sanitizes a LIMIT clause to ensure it's a valid integer
 * 
 * @param limit - The limit value
 * @returns The sanitized LIMIT value
 */
export function sanitizeLimit(limit: number | string): number {
  const numLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  
  if (isNaN(numLimit) || numLimit < 0) {
    throw new Error(`Invalid LIMIT value: ${limit} (must be a non-negative integer)`);
  }
  
  return numLimit;
}

/**
 * Sanitizes an OFFSET clause to ensure it's a valid integer
 * 
 * @param offset - The offset value
 * @returns The sanitized OFFSET value
 */
export function sanitizeOffset(offset: number | string): number {
  const numOffset = typeof offset === 'string' ? parseInt(offset, 10) : offset;
  
  if (isNaN(numOffset) || numOffset < 0) {
    throw new Error(`Invalid OFFSET value: ${offset} (must be a non-negative integer)`);
  }
  
  return numOffset;
}

/**
 * Checks if a value looks like it might be a SQL injection attempt
 * This is a heuristic check and should not be relied upon as the only defense
 * 
 * @param value - The value to check
 * @returns True if the value looks suspicious
 */
export function detectSqlInjection(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/i,
    /(\/\*|\*\/|--|#)/, // SQL comments
    /(;|\sOR\s|\sAND\s)/i, // SQL operators
    /(\bUNION\b|\bINTERSECT\b|\bEXCEPT\b)/i, // Set operations
    /(EXEC\s*\(|xp_cmdshell|sp_oacreate)/i, // SQL Server specific
    /(\bCASE\b|\bWHEN\b|\bTHEN\b|\bELSE\b|\bEND\b)/i, // CASE expression
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(value));
}

/**
 * Sanitizes user input for use in LIKE/ILIKE patterns
 * Escapes special characters used in pattern matching
 * 
 * @param pattern - The pattern to sanitize
 * @param escapeChar - The escape character to use (default: backslash)
 * @returns The sanitized pattern
 * 
 * @example
 * ```typescript
 * sanitizeLikePattern('100%'); // Returns: '100\%'
 * sanitizeLikePattern('user_data'); // Returns: 'user\_data'
 * ```
 */
export function sanitizeLikePattern(pattern: string, escapeChar = '\\'): string {
  if (typeof pattern !== 'string') {
    throw new Error('LIKE pattern must be a string');
  }

  // Escape special LIKE pattern characters
  const specialChars = ['%', '_', escapeChar];
  let result = '';
  
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (specialChars.includes(char)) {
      result += escapeChar + char;
    } else {
      result += char;
    }
  }
  
  return result;
}
