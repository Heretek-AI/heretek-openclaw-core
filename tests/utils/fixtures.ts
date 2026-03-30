/**
 * Heretek OpenClaw — Test Fixtures
 * ==============================================================================
 * Test fixtures: ALL_AGENTS, SAMPLE_A2A_MESSAGE, and other test data
 */

import type { Agent, Message, A2AMessage } from '../../web-interface/src/lib/types';

/**
 * Fixture: All 11 agents in the collective
 */
export const ALL_AGENTS: Agent[] = [
    {
        id: 'steward',
        name: 'Steward',
        role: 'Orchestrator',
        status: 'online',
        port: 8001,
        description: 'Orchestrator agent that coordinates collective operations'
    },
    {
        id: 'alpha',
        name: 'Alpha',
        role: 'Triad',
        status: 'online',
        port: 8002,
        description: 'First member of the triad decision-making body'
    },
    {
        id: 'beta',
        name: 'Beta',
        role: 'Triad',
        status: 'online',
        port: 8003,
        description: 'Second member of the triad decision-making body'
    },
    {
        id: 'charlie',
        name: 'Charlie',
        role: 'Triad',
        status: 'online',
        port: 8004,
        description: 'Third member of the triad decision-making body'
    },
    {
        id: 'examiner',
        name: 'Examiner',
        role: 'Interrogator',
        status: 'online',
        port: 8005,
        description: 'Questions proposals and identifies potential issues'
    },
    {
        id: 'explorer',
        name: 'Explorer',
        role: 'Scout',
        status: 'online',
        port: 8006,
        description: 'Discovers new information and patterns'
    },
    {
        id: 'sentinel',
        name: 'Sentinel',
        role: 'Guardian',
        status: 'online',
        port: 8007,
        description: 'Security and risk assessment agent'
    },
    {
        id: 'coder',
        name: 'Coder',
        role: 'Artisan',
        status: 'online',
        port: 8008,
        description: 'Implementation and code generation agent'
    },
    {
        id: 'dreamer',
        name: 'Dreamer',
        role: 'Visionary',
        status: 'online',
        port: 8009,
        description: 'Creative and abstract thinking agent'
    },
    {
        id: 'empath',
        name: 'Empath',
        role: 'Diplomat',
        status: 'online',
        port: 8010,
        description: 'User experience and emotional intelligence agent'
    },
    {
        id: 'historian',
        name: 'Historian',
        role: 'Archivist',
        status: 'online',
        port: 8011,
        description: 'Memory and historical context agent'
    }
];

/**
 * Fixture: Sample A2A message
 */
export const SAMPLE_A2A_MESSAGE: A2AMessage = {
    from: 'steward',
    to: 'alpha',
    content: 'Test message content',
    timestamp: new Date()
};

/**
 * Fixture: Sample conversation history
 */
export const SAMPLE_CONVERSATION: Message[] = [
    {
        id: '1',
        fromAgent: 'user',
        toAgent: 'steward',
        content: 'Hello',
        timestamp: new Date(),
        messageType: 'text'
    },
    {
        id: '2',
        fromAgent: 'steward',
        toAgent: 'user',
        content: 'Hi there!',
        timestamp: new Date(),
        messageType: 'response'
    }
];

/**
 * Fixture: Triad members subset
 */
export const TRIAD_AGENTS: Agent[] = ALL_AGENTS.filter(a => a.role === 'Triad');

/**
 * Fixture: Online agents (all online)
 */
export const ONLINE_AGENTS: Agent[] = ALL_AGENTS.map(agent => ({
    ...agent,
    status: 'online' as const
}));

/**
 * Fixture: Offline agents (all offline)
 */
export const OFFLINE_AGENTS: Agent[] = ALL_AGENTS.map(agent => ({
    ...agent,
    status: 'offline' as const
}));

/**
 * Fixture: Mixed status agents
 */
export const MIXED_STATUS_AGENTS: Agent[] = [
    ...ALL_AGENTS.slice(0, 5).map(agent => ({ ...agent, status: 'online' as const })),
    ...ALL_AGENTS.slice(5, 8).map(agent => ({ ...agent, status: 'busy' as const })),
    ...ALL_AGENTS.slice(8).map(agent => ({ ...agent, status: 'offline' as const }))
];

/**
 * Fixture: Sample broadcast message
 */
export const SAMPLE_BROADCAST_MESSAGE = {
    from: 'steward',
    type: 'broadcast',
    content: 'Broadcast to all agents',
    timestamp: new Date(),
    recipients: ALL_AGENTS.map(a => a.id)
};

/**
 * Fixture: Sample ping response
 */
export const SAMPLE_PING_RESPONSE = {
    from: 'alpha',
    type: 'pong',
    timestamp: new Date(),
    latency: 5
};

/**
 * Fixture: Sample health check response
 */
export const SAMPLE_HEALTH_CHECK = {
    agentId: 'steward',
    status: 'online',
    latency: 10,
    timestamp: new Date().toISOString(),
    details: {
        memory: '512MB',
        cpu: '10%',
        uptime: '24h'
    }
};

/**
 * Fixture: Sample deliberation proposal
 */
export const SAMPLE_PROPOSAL = {
    id: 'proposal-123',
    from: 'explorer',
    content: 'New pattern detected in user behavior',
    priority: 'high',
    timestamp: new Date(),
    context: {
        source: 'analysis',
        confidence: 0.85
    }
};

/**
 * Fixture: Sample triad votes
 */
export const SAMPLE_VOTES_AGREE = {
    alpha: 'agree',
    beta: 'agree',
    charlie: 'agree'
};

/**
 * Fixture: Sample triad votes (split)
 */
export const SAMPLE_VOTES_SPLIT = {
    alpha: 'agree',
    beta: 'disagree',
    charlie: 'abstain'
};

/**
 * Fixture: Sample deliberation state
 */
export const SAMPLE_DELIBERATION_STATE = {
    proposalId: 'proposal-123',
    stage: 'triad_vote',
    votes: SAMPLE_VOTES_AGREE,
    consensus: true,
    startTime: new Date().toISOString(),
    stages: [
        { name: 'triad_vote', completed: true, timestamp: new Date().toISOString() },
        { name: 'examiner_review', completed: false, timestamp: null },
        { name: 'sentinel_review', completed: false, timestamp: null },
        { name: 'coder_implementation', completed: false, timestamp: null }
    ]
};

/**
 * Fixture: Sample WebSocket message
 */
export const SAMPLE_WS_MESSAGE = {
    type: 'a2a',
    from: 'user',
    to: 'steward',
    content: 'Hello via WebSocket',
    messageId: 'ws-123',
    timestamp: new Date().toISOString()
};

/**
 * Fixture: Sample error response
 */
export const SAMPLE_ERROR_RESPONSE = {
    success: false,
    error: 'Agent not found',
    code: 'AGENT_NOT_FOUND',
    timestamp: new Date().toISOString()
};

/**
 * Fixture: Sample success response
 */
export const SAMPLE_SUCCESS_RESPONSE = {
    success: true,
    messageId: 'msg-123',
    timestamp: new Date().toISOString()
};

/**
 * Fixture: Agent port mapping
 */
export const AGENT_PORTS: Record<string, number> = {
    steward: 8001,
    alpha: 8002,
    beta: 8003,
    charlie: 8004,
    examiner: 8005,
    explorer: 8006,
    sentinel: 8007,
    coder: 8008,
    dreamer: 8009,
    empath: 8010,
    historian: 8011
};

/**
 * Fixture: Agent role mapping
 */
export const AGENT_ROLES: Record<string, string> = {
    steward: 'Orchestrator',
    alpha: 'Triad',
    beta: 'Triad',
    charlie: 'Triad',
    examiner: 'Interrogator',
    explorer: 'Scout',
    sentinel: 'Guardian',
    coder: 'Artisan',
    dreamer: 'Visionary',
    empath: 'Diplomat',
    historian: 'Archivist'
};

/**
 * Get agent by ID from fixtures
 * @param agentId Agent ID
 * @returns Agent or undefined
 */
export function getAgentById(agentId: string): Agent | undefined {
    return ALL_AGENTS.find(agent => agent.id === agentId);
}

/**
 * Get agents by role from fixtures
 * @param role Agent role
 * @returns Array of agents with the specified role
 */
export function getAgentsByRole(role: string): Agent[] {
    return ALL_AGENTS.filter(agent => agent.role === role);
}

/**
 * Get triad agents from fixtures
 * @returns Array of triad agents
 */
export function getTriadAgents(): Agent[] {
    return TRIAD_AGENTS;
}

/**
 * Create a mock message with overrides
 * @param overrides Message overrides
 * @returns Mock message
 */
export function createMockMessage(overrides: Partial<Message> = {}): Message {
    return {
        id: `msg-${Date.now()}`,
        fromAgent: 'user',
        toAgent: 'steward',
        content: 'Test message',
        timestamp: new Date(),
        messageType: 'text',
        ...overrides
    };
}

/**
 * Create a mock A2A message with overrides
 * @param overrides A2A message overrides
 * @returns Mock A2A message
 */
export function createMockA2AMessage(overrides: Partial<A2AMessage> = {}): A2AMessage {
    return {
        from: 'steward',
        to: 'alpha',
        content: 'Test A2A message',
        timestamp: new Date(),
        ...overrides
    };
}
