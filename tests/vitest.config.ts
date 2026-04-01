/**
 * Heretek OpenClaw — Testing Framework Setup
 * ==============================================================================
 * Vitest configuration and test utilities
 * ==============================================================================
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Use Vitest globals for easier test writing
        globals: true,
        environment: 'node',
        
        // Test file patterns
        include: [
            'tests/unit/**/*.test.ts',
            'tests/integration/**/*.test.ts',
            'tests/e2e/**/*.test.ts',
            'tests/skills/**/*.test.js',
            'tests/**/*.test.ts',
            'tests/**/*.test.js'
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/test-results/**',
            '**/coverage/**',
            '**/fixtures/**',
            '**/mocks/**',
            '**/utils/**'
        ],
        
        // Coverage settings
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov', 'clover'],
            include: [
                'gateway/**/*.js',
                'modules/**/*.js',
                'agents/**/*.js',
                'skills/**/*.js',
                'plugins/**/*.js',
                'web-interface/src/lib/server/**/*.ts'
            ],
            exclude: [
                '**/*.test.ts',
                '**/*.test.js',
                '**/*.spec.ts',
                '**/*.spec.js',
                '**/node_modules/**',
                '**/test-utils/**',
                '**/fixtures/**',
                '**/mocks/**',
                '**/tests/**',
                'scripts/**',
                'dist/**',
                'build/**'
            ],
            thresholds: {
                global: {
                    statements: 80,
                    branches: 70,
                    functions: 80,
                    lines: 80
                }
            },
            all: true,
            clean: true,
            reportOnFailure: true
        },
        
        // Test timeouts
        testTimeout: 10000,
        hookTimeout: 5000,
        
        // Retry settings for flaky tests
        retry: 1,
        
        // Isolation settings
        isolate: true,
        sequence: {
            concurrent: false,
            shuffle: false
        },
        
        // Pool settings
        pool: 'threads',
        poolOptions: {
            threads: {
                minThreads: 1,
                maxThreads: 4
            }
        },
        
        // Reporting
        reporters: ['default', 'junit'],
        outputFile: {
            junit: 'test-results/junit.xml'
        },
        
        // Watch mode settings
        watch: process.env.NODE_ENV !== 'test',
        watchExclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/test-results/**',
            '**/*.log',
            '**/sessions/**'
        ],
        
        // Setup files
        setupFiles: [
            './tests/utils/fixtures.ts'
        ],
        
        // Environment options
        environmentOptions: {
            happyDOM: {
                url: 'http://localhost:3000'
            }
        },
        
        // Server options for integration tests
        server: {
            port: 8787
        }
    },
    
    // Resolve aliases for cleaner imports
    resolve: {
        alias: {
            '@gateway': '/gateway',
            '@modules': '/modules',
            '@agents': '/agents',
            '@skills': '/skills',
            '@plugins': '/plugins',
            '@tests': '/tests',
            '@test-utils': '/tests/test-utils'
        }
    }
});

// Re-export test utilities
export * from './test-utils';
