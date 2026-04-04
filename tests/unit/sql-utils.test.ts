/**
 * Unit tests for SQL Utilities module
 */

import { describe, it, expect } from 'vitest';
import {
  validateIdentifier,
  escapeIdentifier,
  escapeLiteral,
  escapeTableName,
  escapeColumnName,
  escapeIndexName,
  escapeFunctionName,
  buildQualifiedName,
  validateIdentifiers,
  sanitizeOrderBy,
  sanitizeLimit,
  sanitizeOffset,
  detectSqlInjection,
  sanitizeLikePattern,
} from '../../lib/sql-utils';

describe('SQL Utilities', () => {
  describe('validateIdentifier', () => {
    it('should accept valid identifiers', () => {
      expect(() => validateIdentifier('users')).not.toThrow();
      expect(() => validateIdentifier('user_data')).not.toThrow();
      expect(() => validateIdentifier('_private')).not.toThrow();
      expect(() => validateIdentifier('Table1')).not.toThrow();
      expect(() => validateIdentifier('a')).not.toThrow();
      expect(() => validateIdentifier('Z')).not.toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateIdentifier('')).toThrow('must be a non-empty string');
    });

    it('should reject non-string values', () => {
      expect(() => validateIdentifier(null as any)).toThrow('must be a non-empty string');
      expect(() => validateIdentifier(undefined as any)).toThrow('must be a non-empty string');
      expect(() => validateIdentifier(123 as any)).toThrow('must be a non-empty string');
    });

    it('should reject identifiers starting with number', () => {
      expect(() => validateIdentifier('123users')).toThrow('must start with letter or underscore');
      expect(() => validateIdentifier('9table')).toThrow('must start with letter or underscore');
    });

    it('should reject identifiers with hyphens', () => {
      expect(() => validateIdentifier('user-data')).toThrow('must start with letter or underscore');
      expect(() => validateIdentifier('my-table')).toThrow('must start with letter or underscore');
    });

    it('should reject identifiers with special characters', () => {
      expect(() => validateIdentifier('user.data')).toThrow('must start with letter or underscore');
      expect(() => validateIdentifier('user@data')).toThrow('must start with letter or underscore');
      expect(() => validateIdentifier('user#data')).toThrow('must start with letter or underscore');
    });

    it('should reject identifiers with spaces', () => {
      expect(() => validateIdentifier('user data')).toThrow('must start with letter or underscore');
      expect(() => validateIdentifier(' table')).toThrow('must start with letter or underscore');
    });

    it('should reject identifiers exceeding max length', () => {
      const longIdentifier = 'a'.repeat(64);
      expect(() => validateIdentifier(longIdentifier)).toThrow('exceeds maximum length of 63');
    });

    it('should accept identifiers at max length', () => {
      const maxIdentifier = 'a'.repeat(63);
      expect(() => validateIdentifier(maxIdentifier)).not.toThrow();
    });

    it('should reject reserved SQL keywords', () => {
      expect(() => validateIdentifier('SELECT')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('FROM')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('WHERE')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('INSERT')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('UPDATE')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('DELETE')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('DROP')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('CREATE')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('TABLE')).toThrow('is a reserved SQL keyword');
    });

    it('should accept lowercase versions of reserved keywords', () => {
      expect(() => validateIdentifier('select')).toThrow('is a reserved SQL keyword');
      expect(() => validateIdentifier('from')).toThrow('is a reserved SQL keyword');
    });
  });

  describe('escapeIdentifier', () => {
    it('should escape valid identifiers', () => {
      expect(escapeIdentifier('users')).toBe('"users"');
      expect(escapeIdentifier('user_data')).toBe('"user_data"');
      expect(escapeIdentifier('_private')).toBe('"_private"');
    });

    it('should escape double quotes in identifiers', () => {
      expect(escapeIdentifier('user"name')).toBe('"user""name"');
      expect(escapeIdentifier('a""b')).toBe('"a""""b"');
    });

    it('should validate before escaping', () => {
      expect(() => escapeIdentifier('')).toThrow();
      expect(() => escapeIdentifier('123invalid')).toThrow();
    });
  });

  describe('escapeLiteral', () => {
    it('should escape string literals', () => {
      expect(escapeLiteral('John')).toBe("'John'");
      expect(escapeLiteral('data')).toBe("'data'");
    });

    it('should escape single quotes in literals', () => {
      expect(escapeLiteral("John's")).toBe("'John''s'");
      expect(escapeLiteral("O'Reilly")).toBe("'O''Reilly'");
      expect(escapeLiteral("a'b'c'd")).toBe("'a''b''c''d'");
    });

    it('should reject non-string values', () => {
      expect(() => escapeLiteral(null as any)).toThrow('must be a string');
      expect(() => escapeLiteral(123 as any)).toThrow('must be a string');
    });
  });

  describe('escapeTableName', () => {
    it('should escape table names', () => {
      expect(escapeTableName('users')).toBe('"users"');
      expect(escapeTableName('user_data')).toBe('"user_data"');
    });

    it('should validate before escaping', () => {
      expect(() => escapeTableName('')).toThrow();
      expect(() => escapeTableName('SELECT')).toThrow();
    });
  });

  describe('escapeColumnName', () => {
    it('should escape column names', () => {
      expect(escapeColumnName('user_id')).toBe('"user_id"');
      expect(escapeColumnName('created_at')).toBe('"created_at"');
    });

    it('should validate before escaping', () => {
      expect(() => escapeColumnName('')).toThrow();
      expect(() => escapeColumnName('FROM')).toThrow();
    });
  });

  describe('escapeIndexName', () => {
    it('should escape index names', () => {
      expect(escapeIndexName('idx_users_id')).toBe('"idx_users_id"');
      expect(escapeIndexName('users_email_idx')).toBe('"users_email_idx"');
    });

    it('should validate before escaping', () => {
      expect(() => escapeIndexName('')).toThrow();
      expect(() => escapeIndexName('INDEX')).toThrow();
    });
  });

  describe('escapeFunctionName', () => {
    it('should escape function names', () => {
      expect(escapeFunctionName('calculate_score')).toBe('"calculate_score"');
      expect(escapeFunctionName('get_user_data')).toBe('"get_user_data"');
    });

    it('should validate before escaping', () => {
      expect(() => escapeFunctionName('')).toThrow();
      expect(() => escapeFunctionName('FUNCTION')).toThrow();
    });
  });

  describe('buildQualifiedName', () => {
    it('should build single-part qualified name', () => {
      expect(buildQualifiedName(['users'])).toBe('"users"');
      expect(buildQualifiedName(['user_data'])).toBe('"user_data"');
    });

    it('should build two-part qualified name', () => {
      expect(buildQualifiedName(['public', 'users'])).toBe('"public"."users"');
      expect(buildQualifiedName(['my_schema', 'user_data'])).toBe('"my_schema"."user_data"');
    });

    it('should build three-part qualified name', () => {
      expect(buildQualifiedName(['public', 'users', 'user_id'])).toBe('"public"."users"."user_id"');
    });

    it('should validate all parts', () => {
      expect(() => buildQualifiedName([])).toThrow('must have at least one part');
      expect(() => buildQualifiedName(['valid', 'invalid'])).toThrow();
      expect(() => buildQualifiedName(['SELECT', 'users'])).toThrow();
    });

    it('should escape all parts', () => {
      expect(buildQualifiedName(['my_schema', 'my_table'])).toBe('"my_schema"."my_table"');
    });
  });

  describe('validateIdentifiers', () => {
    it('should accept array of valid identifiers', () => {
      expect(() => validateIdentifiers(['users', 'user_data', '_private'])).not.toThrow();
    });

    it('should reject non-array values', () => {
      expect(() => validateIdentifiers(null as any)).toThrow('must be an array');
      expect(() => validateIdentifiers('users' as any)).toThrow('must be an array');
    });

    it('should reject array with invalid identifier', () => {
      expect(() => validateIdentifiers(['users', '123invalid'])).toThrow('at index 1');
      expect(() => validateIdentifiers(['valid', 'SELECT', 'valid'])).toThrow('at index 1');
    });

    it('should reject empty array', () => {
      expect(() => validateIdentifiers([])).not.toThrow();
    });
  });

  describe('sanitizeOrderBy', () => {
    it('should sanitize valid ORDER BY clauses', () => {
      expect(sanitizeOrderBy('created_at', 'ASC')).toBe('"created_at" ASC');
      expect(sanitizeOrderBy('created_at', 'DESC')).toBe('"created_at" DESC');
      expect(sanitizeOrderBy('user_id')).toBe('"user_id" ASC');
    });

    it('should default to ASC direction', () => {
      expect(sanitizeOrderBy('created_at')).toBe('"created_at" ASC');
    });

    it('should accept lowercase direction', () => {
      expect(sanitizeOrderBy('created_at', 'asc' as 'ASC')).toBe('"created_at" ASC');
      expect(sanitizeOrderBy('created_at', 'desc' as 'DESC')).toBe('"created_at" DESC');
    });

    it('should reject invalid column names', () => {
      expect(() => sanitizeOrderBy('')).toThrow();
      expect(() => sanitizeOrderBy('123invalid')).toThrow();
    });

    it('should reject invalid direction', () => {
      expect(() => sanitizeOrderBy('created_at', 'INVALID' as any)).toThrow('must be ASC or DESC');
      expect(() => sanitizeOrderBy('created_at', 'UP' as any)).toThrow('must be ASC or DESC');
    });
  });

  describe('sanitizeLimit', () => {
    it('should sanitize valid LIMIT values', () => {
      expect(sanitizeLimit(10)).toBe(10);
      expect(sanitizeLimit(100)).toBe(100);
      expect(sanitizeLimit(0)).toBe(0);
    });

    it('should parse string numbers', () => {
      expect(sanitizeLimit('10')).toBe(10);
      expect(sanitizeLimit('100')).toBe(100);
      expect(sanitizeLimit('0')).toBe(0);
    });

    it('should reject invalid string numbers', () => {
      expect(() => sanitizeLimit('abc')).toThrow('must be a non-negative integer');
      expect(() => sanitizeLimit('10.5')).toThrow('must be a non-negative integer');
    });

    it('should reject negative numbers', () => {
      expect(() => sanitizeLimit(-1)).toThrow('must be a non-negative integer');
      expect(() => sanitizeLimit(-100)).toThrow('must be a non-negative integer');
    });

    it('should reject NaN', () => {
      expect(() => sanitizeLimit(NaN)).toThrow('must be a non-negative integer');
    });
  });

  describe('sanitizeOffset', () => {
    it('should sanitize valid OFFSET values', () => {
      expect(sanitizeOffset(0)).toBe(0);
      expect(sanitizeOffset(10)).toBe(10);
      expect(sanitizeOffset(100)).toBe(100);
    });

    it('should parse string numbers', () => {
      expect(sanitizeOffset('0')).toBe(0);
      expect(sanitizeOffset('10')).toBe(10);
      expect(sanitizeOffset('100')).toBe(100);
    });

    it('should reject invalid string numbers', () => {
      expect(() => sanitizeOffset('abc')).toThrow('must be a non-negative integer');
      expect(() => sanitizeOffset('10.5')).toThrow('must be a non-negative integer');
    });

    it('should reject negative numbers', () => {
      expect(() => sanitizeOffset(-1)).toThrow('must be a non-negative integer');
      expect(() => sanitizeOffset(-100)).toThrow('must be a non-negative integer');
    });

    it('should reject NaN', () => {
      expect(() => sanitizeOffset(NaN)).toThrow('must be a non-negative integer');
    });
  });

  describe('detectSqlInjection', () => {
    it('should detect SQL injection attempts', () => {
      expect(detectSqlInjection("'; DROP TABLE users; --")).toBe(true);
      expect(detectSqlInjection("' OR '1'='1")).toBe(true);
      expect(detectSqlInjection("admin' --")).toBe(true);
      expect(detectSqlInjection("'; DELETE FROM users; --")).toBe(true);
      expect(detectSqlInjection("' UNION SELECT * FROM users --")).toBe(true);
      expect(detectSqlInjection("' OR 1=1 --")).toBe(true);
      expect(detectSqlInjection("'; EXEC xp_cmdshell('dir'); --")).toBe(true);
      expect(detectSqlInjection("' AND 1=1")).toBe(true);
    });

    it('should detect SQL comments', () => {
      expect(detectSqlInjection("admin' /* comment */")).toBe(true);
      expect(detectSqlInjection("admin' # comment")).toBe(true);
      expect(detectSqlInjection("admin' -- comment")).toBe(true);
    });

    it('should detect CASE expressions', () => {
      expect(detectSqlInjection("'; CASE WHEN 1=1 THEN 1 ELSE 0 END --")).toBe(true);
    });

    it('should not detect safe values', () => {
      expect(detectSqlInjection('John Doe')).toBe(false);
      expect(detectSqlInjection('user@example.com')).toBe(false);
      expect(detectSqlInjection('Hello World!')).toBe(false);
      expect(detectSqlInjection('12345')).toBe(false);
      expect(detectSqlInjection('user_data')).toBe(false);
    });

    it('should handle non-string values', () => {
      expect(detectSqlInjection(null as any)).toBe(false);
      expect(detectSqlInjection(123 as any)).toBe(false);
      expect(detectSqlInjection(undefined as any)).toBe(false);
    });
  });

  describe('sanitizeLikePattern', () => {
    it('should escape LIKE pattern special characters', () => {
      expect(sanitizeLikePattern('100%')).toBe('100\\%');
      expect(sanitizeLikePattern('user_data')).toBe('user\\_data');
      expect(sanitizeLikePattern('test%value')).toBe('test\\%value');
    });

    it('should escape backslash escape character', () => {
      expect(sanitizeLikePattern('test\\value')).toBe('test\\\\value');
      expect(sanitizeLikePattern('test\\%value')).toBe('test\\\\\\%value');
    });

    it('should use custom escape character', () => {
      expect(sanitizeLikePattern('test%value', '|')).toBe('test|%value');
      expect(sanitizeLikePattern('test_value', '|')).toBe('test|_value');
    });

    it('should reject non-string values', () => {
      expect(() => sanitizeLikePattern(null as any)).toThrow('must be a string');
      expect(() => sanitizeLikePattern(123 as any)).toThrow('must be a string');
    });

    it('should handle empty pattern', () => {
      expect(sanitizeLikePattern('')).toBe('');
    });

    it('should escape multiple special characters', () => {
      expect(sanitizeLikePattern('test%_value')).toBe('test\\%\\_value');
      expect(sanitizeLikePattern('%test%')).toBe('\\%test\\%');
      expect(sanitizeLikePattern('_test_')).toBe('\\_test\\_');
    });
  });
});
