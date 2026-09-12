import type { FeeBreakdown } from './types';
export declare function calculateStampDuty(state: string, authorizedCapital: number): number;
export declare function calculateIncorporationCost(state?: string, directorCount?: number, authorizedCapital?: number): FeeBreakdown;
export declare function getAvailableStates(): string[];
export declare function calculateLlpStampDuty(contribution: number): number;
export declare function calculateLlpCost(partnerCount?: number, contribution?: number): FeeBreakdown;
export declare function toDisplayName(state: string): string;
