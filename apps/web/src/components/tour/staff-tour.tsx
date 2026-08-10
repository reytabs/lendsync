'use client';

import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import posthog from 'posthog-js';

const STORAGE_PREFIX = 'lms_staff_tour_v2';

function storageKey(email: string) {
  return `${STORAGE_PREFIX}:${email.toLowerCase()}`;
}

export function isStaffTourDone(email: string) {
  if (typeof window === 'undefined' || !email) return true;
  return localStorage.getItem(storageKey(email)) === '1';
}

export function markStaffTourDone(email: string) {
  if (typeof window === 'undefined' || !email) return;
  localStorage.setItem(storageKey(email), '1');
}

function isAdminRole(role: string) {
  return role === 'admin' || role === 'owner';
}

function isOfficerRole(role: string) {
  return role === 'loan_officer' || role === 'officer';
}

function isCollectorRole(role: string) {
  return role === 'collector';
}

type TourOpts = {
  email: string;
  role: string;
  force?: boolean;
  ensureExpanded?: () => void;
};

function capture(event: string, props: Record<string, string>) {
  try {
    posthog.capture(event, props);
  } catch {
    // PostHog may be unset
  }
}

function buildSteps(role: string): DriveStep[] {
  const officer = isOfficerRole(role) && !isAdminRole(role);
  const collector = isCollectorRole(role);

  const steps: DriveStep[] = [
    {
      element: '[data-tour="brand"]',
      popover: {
        title: 'Quick tour of LendSync',
        description:
          'A short walk through your lending workspace — skip anytime.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="org-switcher"]',
      popover: {
        title: 'Your workspace',
        description:
          'Switch organizations here when you belong to more than one.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-dashboard"]',
      popover: {
        title: 'Dashboard',
        description: 'See portfolio KPIs and recent activity at a glance.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-applications"]',
      popover: {
        title: 'Loan Applications',
        description: officer
          ? 'Review the application queue for your borrowers.'
          : 'Review, approve, or reject loan requests.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-borrowers"]',
      popover: {
        title: 'Borrowers',
        description: 'Manage borrower profiles and credit details.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-collections"]',
      popover: {
        title: 'Collections',
        description: collector
          ? 'Your overdue queue — assign follow-ups, set promises to pay, and log outreach.'
          : 'Work overdue installments: assign collectors, set promises to pay, and log calls or visits.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="nav-repayments"]',
      popover: {
        title: 'Repayments',
        description: 'Disburse approved loans and record borrower payments.',
        side: 'right',
        align: 'start',
      },
    },
  ];

  if (isAdminRole(role)) {
    steps.push({
      element: '[data-tour="nav-admin"]',
      popover: {
        title: 'Admin Panel',
        description:
          'Configure loan products, invite your team, and org settings.',
        side: 'right',
        align: 'start',
      },
    });
  }

  steps.push({
    element: '[data-tour="notifications"]',
    popover: {
      title: 'Notifications',
      description: 'Approvals and payment alerts appear here in real time.',
      side: 'bottom',
      align: 'end',
    },
  });

  return steps;
}

let activeDriver: ReturnType<typeof driver> | null = null;
let completedViaDone = false;

export function startStaffTour(opts: TourOpts) {
  const { email, role, force = false, ensureExpanded } = opts;
  if (!email) return;
  if (!force && isStaffTourDone(email)) return;

  ensureExpanded?.();

  window.setTimeout(() => {
    if (activeDriver) {
      activeDriver.destroy();
      activeDriver = null;
    }

    completedViaDone = false;
    capture('staff_tour_started', { role });

    const d = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 8,
      allowClose: true,
      smoothScroll: true,
      skipMissingElement: true,
      popoverClass: 'lendsync-tour-popover',
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Got it',
      progressText: '{{current}} of {{total}}',
      steps: buildSteps(role),
      onPopoverRender: (popover) => {
        // Sample A uses "Skip" instead of a bare close glyph when possible
        if (popover.closeButton) {
          popover.closeButton.setAttribute('aria-label', 'Skip');
          popover.closeButton.title = 'Skip';
        }
      },
      onCloseClick: (_el, _step, { driver: drv }) => {
        capture('staff_tour_skipped', { role });
        drv.destroy();
      },
      onNextClick: (_el, _step, { driver: drv }) => {
        if (drv.isLastStep()) {
          completedViaDone = true;
          capture('staff_tour_completed', { role });
          drv.destroy();
          return;
        }
        drv.moveNext();
      },
      onPrevClick: (_el, _step, { driver: drv }) => {
        drv.movePrevious();
      },
      onDestroyed: () => {
        markStaffTourDone(email);
        if (!completedViaDone) {
          // Closed via overlay / Esc without finishing
          // (skip already captured in onCloseClick when close btn used)
        }
        activeDriver = null;
      },
    });

    activeDriver = d;
    d.drive();
  }, force ? 80 : 500);
}
