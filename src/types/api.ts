// Shared type definitions for FutureCraft API

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface User {
  id: string;
  username: string;
  type: 'regular' | 'guest' | 'pro';
  credits: number;
  createdAt?: number;
}

export interface AuthResponse {
  userId: string;
  username: string;
  token: string;
  type: string;
}

export interface SoulScanResult {
  stats: {
    creativity: number;
    logic: number;
    leadership: number;
    stamina: number;
  };
  archetype: string;
  careers: CareerMatch[];
}

export interface CareerMatch {
  title: string;
  description: string;
  matchScore: number;
  growth: number;
  salary: string;
}

export interface SessionData {
  userId: string;
  createdAt: number;
  expiresAt?: number;
}

export interface SkillTreeNode {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  unlocked: boolean;
  prerequisites: string[];
}

export interface SimulationResult {
  title: string;
  score: number;
  feedback: string;
  recommendations: string[];
}
