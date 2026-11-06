import fs from 'fs';
import { Paths } from './paths';
import { env } from './env';

interface PolicyJson {
    envs: Record<string, { features?: Record<string, boolean> }>;
}

/**
 * Reads `config/test-policy.json` and answers "is feature X enabled in the
 * current env?".
 *
 * A feature missing from the matrix is NOT silently treated as disabled —
 * `isDeclared` returns false and the gate raises an error, so a typo in a
 * feature tag fails loudly instead of quietly skipping a test.
 */
export class PolicyEngine {
    private readonly features: Record<string, boolean>;

    constructor() {
        const raw = fs.readFileSync(Paths.testPolicyFile, 'utf-8');
        const parsed: PolicyJson = JSON.parse(raw);
        const envEntry = parsed.envs[env.testEnv];
        if (!envEntry) {
            const known = Object.keys(parsed.envs).join(', ');
            throw new Error(
                `TEST_ENV="${env.testEnv}" is not defined in config/test-policy.json. ` +
                    `Known envs: ${known}.`,
            );
        }
        this.features = envEntry.features ?? {};
    }

    /** True when the feature is mentioned in the matrix for the current env. */
    isDeclared(featureName: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.features, featureName);
    }

    /** True only when the feature is declared *and* enabled. */
    isEnabled(featureName: string): boolean {
        return this.isDeclared(featureName) && this.features[featureName] === true;
    }

    /** Message used when the feature is disabled for this env. */
    skipReason(featureName: string): string {
        return `Feature "${featureName}" is disabled in ${env.testEnv}.`;
    }

    /** Every feature declared for the current env. */
    declaredFeatures(): string[] {
        return Object.keys(this.features);
    }
}

/** Shared engine instance — the policy file is read once per worker. */
export const policy = new PolicyEngine();
