import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypeBadge, type ActivityType } from '../src/ui/TypeBadge';

const LABEL: Record<ActivityType, string> = {
  oral: 'Oral',
  spotlight: 'Spotlight',
  poster: 'Poster',
  workshop: 'Workshop',
  challenge: 'Challenge',
  tutorial: 'Tutorial',
};

const ALL_TYPES = Object.keys(LABEL) as ActivityType[];

describe('TypeBadge', () => {
  it.each(ALL_TYPES)('renders its own text label for type "%s" — colour is never the only cue', (type) => {
    render(<TypeBadge type={type} />);
    expect(screen.getByText(LABEL[type])).toBeInTheDocument();
  });

  it('gives oral and spotlight (both "talk") the same colour classes, distinct from poster', () => {
    const { container: oral } = render(<TypeBadge type="oral" />);
    const { container: spotlight } = render(<TypeBadge type="spotlight" />);
    const { container: poster } = render(<TypeBadge type="poster" />);
    const oralClass = oral.querySelector('span')!.className;
    const spotlightClass = spotlight.querySelector('span')!.className;
    const posterClass = poster.querySelector('span')!.className;

    expect(oralClass).toBe(spotlightClass);
    expect(oralClass).not.toBe(posterClass);
  });

  it('gives workshop, challenge and tutorial (all "satellite") the same colour classes', () => {
    const { container: workshop } = render(<TypeBadge type="workshop" />);
    const { container: challenge } = render(<TypeBadge type="challenge" />);
    const { container: tutorial } = render(<TypeBadge type="tutorial" />);
    const workshopClass = workshop.querySelector('span')!.className;
    const challengeClass = challenge.querySelector('span')!.className;
    const tutorialClass = tutorial.querySelector('span')!.className;

    expect(workshopClass).toBe(challengeClass);
    expect(workshopClass).toBe(tutorialClass);
  });

  it('gives all three colour groups (talk, poster, satellite) mutually distinct colour classes', () => {
    const groups: ActivityType[] = ['oral', 'poster', 'workshop'];
    const classNames = groups.map((type) => {
      const { container } = render(<TypeBadge type={type} />);
      return container.querySelector('span')!.className;
    });
    const distinct = new Set(classNames);
    expect(distinct.size).toBe(3);
  });

  it('carries the colour via CSS custom-property tokens (theme-aware), not a hard-coded hex value', () => {
    render(<TypeBadge type="oral" />);
    const badge = screen.getByText('Oral');
    expect(badge.className).toMatch(/var\(--type-talk\)/);
    expect(badge.className).toMatch(/var\(--type-talk-bg\)/);
    expect(badge.className).toMatch(/var\(--type-talk-border\)/);
  });
});
