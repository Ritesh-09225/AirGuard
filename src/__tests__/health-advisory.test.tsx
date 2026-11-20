// @vitest-environment jsdom
/**
 * Component test: the personalised advisory renders accessible, correct
 * content for a household and responds to profile changes.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HealthAdvisory } from '@/components/airguard/health-advisory';
import { DEFAULT_PROFILE, buildAdvisories } from '@/lib/aqi';

afterEach(cleanup);

describe('HealthAdvisory component', () => {
  it('renders a labelled card with the advisory bullets for the given AQI', () => {
    render(<HealthAdvisory aqi={210} profile={DEFAULT_PROFILE} />);

    expect(screen.getByText(/your household advisory/i)).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();

    const expected = buildAdvisories(210, DEFAULT_PROFILE);
    expect(expected.length).toBeGreaterThan(2);
    for (const advisory of expected) {
      expect(screen.getByText(advisory)).toBeInTheDocument();
    }
  });

  it('updates content when the profile changes', () => {
    render(
      <HealthAdvisory
        aqi={160}
        profile={{ ...DEFAULT_PROFILE, commuteMode: 'cycle', respiratoryConditions: true }}
      />,
    );
    const text = document.body.textContent ?? '';
    expect(text).toContain('cycle');
  });
});
