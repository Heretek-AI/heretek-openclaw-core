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
        
        // Coverage settings
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: [
                'web-interface/src/lib/server/**/*.ts',
                'modules/**/*.js'
            ],
            exclude: [
                '**/*.test.ts',
                '**/*.spec.ts',
                '**/node_modules/**'
            ]
        },
        
        // Test timeouts
        testTimeout: 10000,
        
        // Watch mode for development
        watch: process.env.NODE_ENV !== 'test'
    }
});

// Re-export test utilities
export * from './test-utils';